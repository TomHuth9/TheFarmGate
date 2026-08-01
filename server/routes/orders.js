const express = require('express');
const { body, param, query } = require('express-validator');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { protect, adminOnly, farmOrAdmin } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');

const router = express.Router();

const orderRules = [
  body('items').isArray({ min: 1, max: 50 }).withMessage('Order must contain between 1 and 50 items'),
  body('items.*.product').isMongoId().withMessage('Each item must reference a valid product ID'),
  body('items.*.quantity').isInt({ min: 1, max: 100 }).withMessage('Quantity must be 1–100'),
  body('deliveryAddress.line1').trim().notEmpty().withMessage('Delivery address line 1 is required').isLength({ max: 200 }),
  body('deliveryAddress.city').trim().notEmpty().withMessage('City is required').isLength({ max: 100 }),
  body('deliveryAddress.postcode').trim().notEmpty().withMessage('Postcode is required').isLength({ max: 10 }),
  body('deliveryAddress.line2').optional().trim().isLength({ max: 200 }),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes too long'),
  body('centre').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid centre ID'),
];

// POST /api/orders
router.post('/', protect, orderRules, handleValidationErrors, async (req, res) => {
  try {
    const { items, deliveryAddress, notes, centre } = req.body;

    // Look up current prices and stock from the database — never trust client-supplied values
    const productIds = items.map((i) => i.product);
    const products = await Product.find({ _id: { $in: productIds } }).select('_id name price stock');
    const priceMap = Object.fromEntries(products.map((p) => [String(p._id), p]));

    // Reject if any product ID doesn't exist
    for (const item of items) {
      if (!priceMap[item.product]) {
        return res.status(422).json({ message: `Product not found: ${item.product}` });
      }
    }

    // Reject if any requested quantity exceeds available stock
    for (const item of items) {
      const product = priceMap[item.product];
      if (product.stock < item.quantity) {
        return res.status(422).json({
          message: `Insufficient stock for "${product.name}": only ${product.stock} available`,
        });
      }
    }

    const verifiedItems = items.map((item) => ({
      product: item.product,
      name: priceMap[item.product].name,
      price: priceMap[item.product].price, // server-authoritative price
      quantity: item.quantity,
    }));

    const total = verifiedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const order = await Order.create({
      user: req.user.id,
      items: verifiedItems,
      total,
      deliveryAddress,
      notes,
      centre: centre || undefined,
    });

    // Decrement stock for each ordered item
    await Product.bulkWrite(
      verifiedItems.map((item) => ({
        updateOne: {
          filter: { _id: item.product },
          update: { $inc: { stock: -item.quantity } },
        },
      }))
    );

    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ message: 'Could not place order' });
  }
});

// GET /api/orders/my
router.get('/my', protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .populate('items.product', 'name imageUrl')
      .populate('centre', 'name address')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch orders' });
  }
});

// GET /api/orders/farm — returns orders containing products owned by this farm user
router.get('/farm', protect, farmOrAdmin, async (req, res) => {
  try {
    const farmProducts = await Product.find({ farm: req.user.id }).select('_id');
    const productIds = farmProducts.map((p) => p._id);

    const orders = await Order.find({ 'items.product': { $in: productIds } })
      .populate('user', 'name email')
      .populate('items.product', 'name imageUrl')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch farm orders' });
  }
});

// PATCH /api/orders/:id/status — update order status (farm must own at least one item)
router.patch('/:id/status', protect, farmOrAdmin, [
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('status')
    .isIn(['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled'])
    .withMessage('Invalid status value'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (req.user.role !== 'admin') {
      const productIds = order.items.map((i) => i.product);
      const owned = await Product.findOne({ _id: { $in: productIds }, farm: req.user.id });
      if (!owned) return res.status(403).json({ message: 'Not authorised to update this order' });
    }

    order.status = req.body.status;
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: 'Could not update order status' });
  }
});

// GET /api/orders/:id
router.get('/:id', protect, [
  param('id').isMongoId().withMessage('Invalid order ID'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.product', 'name imageUrl')
      .populate('centre', 'name address');

    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorised' });
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch order' });
  }
});

// GET /api/orders — admin only
router.get('/', protect, adminOnly, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const orders = await Order.find()
      .populate('user', 'name email')
      .populate('centre', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch orders' });
  }
});

module.exports = router;
