const express = require('express');
const { body, param, query } = require('express-validator');
const Product = require('../models/Product');
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
  body('imageUrl').optional({ checkFalsy: true }).trim().isURL().withMessage('Image must be a valid URL'),
  body('stock').optional().isInt({ min: 0, max: 99999 }).withMessage('Stock must be 0–99,999'),
];

const mongoIdParam = [
  param('id').isMongoId().withMessage('Invalid product ID'),
];

// GET /api/products
router.get('/', [
  query('category').optional().isIn(CATEGORIES).withMessage('Invalid category'),
  query('farm').optional().isMongoId().withMessage('Invalid farm ID'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.featured === 'true') filter.featured = true;
    if (req.query.farm) filter.farm = req.query.farm;

    const products = await Product.find(filter)
      .populate('farm', 'farmName farmLocation')
      .sort({ category: 1, name: 1 });
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
router.post('/', protect, farmOrAdmin, productRules, handleValidationErrors, async (req, res) => {
  try {
    const { name, description, price, category, unit, imageUrl, stock } = req.body;
    const data = { name, description, price, category, unit, imageUrl, stock };

    // Farms are always the owner — never trust a farm field from the request body
    if (req.user.role === 'farm') data.farm = req.user.id;

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
  handleValidationErrors,
], async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    if (req.user.role === 'farm' && String(product.farm) !== req.user.id) {
      return res.status(403).json({ message: 'Not authorised to edit this product' });
    }

    // Only allow safe fields — never let a client reassign the farm owner
    const { name, description, price, category, unit, imageUrl, stock, featured } = req.body;
    const updates = { name, description, price, category, unit, imageUrl, stock, featured };
    // Remove undefined keys so Mongoose doesn't overwrite with undefined
    Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k]);

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
