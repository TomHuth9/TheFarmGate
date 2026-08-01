const express = require('express');
const { body, param, query } = require('express-validator');
const Product = require('../models/Product');
const User = require('../models/User');
const { protect, farmOrAdmin } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');

const router = express.Router();

const CATEGORIES = ['Dairy', 'Beef', 'Pork', 'Vegetables', 'Eggs', 'Poultry'];

const productRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('description').trim().notEmpty().withMessage('Description is required').isLength({ min: 10, max: 2000 }),
  body('price').isFloat({ min: 0.01, max: 10000 }).withMessage('Price must be between £0.01 and £10,000'),
  body('category').isIn(CATEGORIES).withMessage(`Category must be one of: ${CATEGORIES.join(', ')}`),
  body('unit').trim().notEmpty().withMessage('Unit is required').isLength({ max: 50 }),
  body('imageUrl').optional({ checkFalsy: true }).trim().isURL({ protocols: ['http', 'https'], require_protocol: true }).withMessage('Image must be a valid http/https URL'),
  body('stock').optional().isInt({ min: 0, max: 99999 }).withMessage('Stock must be 0–99,999'),
];

const mongoIdParam = [
  param('id').isMongoId().withMessage('Invalid product ID'),
];

// GET /api/products
router.get('/', [
  query('category').optional().isIn(CATEGORIES).withMessage('Invalid category'),
  query('farm').optional().isMongoId().withMessage('Invalid farm ID'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.featured === 'true') filter.featured = true;
    if (req.query.farm) filter.farm = req.query.farm;

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const products = await Product.find(filter)
      .populate('farm', 'farmName farmLocation')
      .sort({ category: 1, name: 1 })
      .skip(skip)
      .limit(limit);
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch products' });
  }
});

// GET /api/products/:id
router.get('/:id', mongoIdParam, handleValidationErrors, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('farm', 'farmName farmLocation _id');
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch product' });
  }
});

// POST /api/products — farm or admin
router.post('/', protect, farmOrAdmin, [
  ...productRules,
  body('farm').optional().isMongoId().withMessage('Invalid farm ID'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { name, description, price, category, unit, imageUrl, stock } = req.body;
    const data = { name, description, price, category, unit, imageUrl, stock };

    if (req.user.role === 'farm') {
      // Farms are always the owner — never trust a farm field from the request body
      data.farm = req.user.id;
    } else {
      // Admins must explicitly assign the product to a farm account
      if (!req.body.farm) {
        return res.status(422).json({ message: 'A farm must be assigned when creating a product as admin' });
      }
      const farm = await User.findOne({ _id: req.body.farm, role: 'farm' });
      if (!farm) return res.status(422).json({ message: 'Farm not found' });
      data.farm = req.body.farm;
    }

    const product = await Product.create(data);
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ message: 'Could not create product' });
  }
});

// PUT /api/products/:id — farm (own) or admin
router.put('/:id', protect, farmOrAdmin, mongoIdParam, [
  body('name').optional().trim().notEmpty().isLength({ max: 100 }),
  body('description').optional().trim().isLength({ min: 10, max: 2000 }),
  body('price').optional().isFloat({ min: 0.01, max: 10000 }),
  body('category').optional().isIn(CATEGORIES),
  body('unit').optional().trim().notEmpty().isLength({ max: 50 }),
  body('imageUrl').optional({ checkFalsy: true }).trim().isURL(),
  body('stock').optional().isInt({ min: 0, max: 99999 }),
  body('featured').optional().isBoolean().withMessage('featured must be a boolean'),
  body('farmFeatured').optional().isBoolean().withMessage('farmFeatured must be a boolean'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    if (req.user.role === 'farm' && String(product.farm) !== req.user.id) {
      return res.status(403).json({ message: 'Not authorised to edit this product' });
    }

    // Only allow safe base fields — never let a client reassign the farm owner
    const { name, description, price, category, unit, imageUrl, stock } = req.body;
    const updates = { name, description, price, category, unit, imageUrl, stock };
    Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k]);

    if (req.user.role === 'farm') {
      // Farms manage their own store-page featured list (max 5), not the homepage flag
      if (req.body.featured !== undefined) {
        return res.status(403).json({ message: 'Only admins can set homepage featured status' });
      }
      if (req.body.farmFeatured !== undefined) {
        if (req.body.farmFeatured === true && !product.farmFeatured) {
          const count = await Product.countDocuments({ farm: req.user.id, farmFeatured: true });
          if (count >= 5) {
            return res.status(422).json({ message: 'You can feature at most 5 products on your store page' });
          }
        }
        updates.farmFeatured = req.body.farmFeatured;
      }
    } else {
      // Admins manage the homepage featured flag; farmFeatured is farm-managed only
      if (req.body.featured !== undefined) updates.featured = req.body.featured;
    }

    const updated = await Product.findByIdAndUpdate(req.params.id, updates, {
      new: true, runValidators: true,
    }).populate('farm', 'farmName farmLocation _id');
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'Could not update product' });
  }
});

// DELETE /api/products/:id — farm (own) or admin
router.delete('/:id', protect, farmOrAdmin, mongoIdParam, handleValidationErrors, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    if (req.user.role === 'farm' && String(product.farm) !== req.user.id) {
      return res.status(403).json({ message: 'Not authorised to delete this product' });
    }

    await product.deleteOne();
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete product' });
  }
});

module.exports = router;
