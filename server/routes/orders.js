const express = require('express');
const { body, param, query } = require('express-validator');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { protect, adminOnly, farmOrAdmin } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');
const { sendOrderConfirmation, sendOrderReceived, sendStatusUpdate, sendLowStockAlert } = require('../utils/email');

const router = express.Router();

const VALID_TRANSITIONS = {
  pending:    ['confirmed', 'cancelled'],
  confirmed:  ['dispatched', 'cancelled'],
  dispatched: ['delivered', 'cancelled'],
  delivered:  [],
  cancelled:  [],
};

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

// ─── Email helpers (fire-and-forget — never block a response) ─────────────────

async function notifyOrderPlaced(userId, productIds, verifiedItems, order) {
  try {
    const [customer, farmProductDocs] = await Promise.all([
      User.findById(userId).select('name email'),
      Product.find({ _id: { $in: productIds } })
        .select('_id farm')
        .populate('farm', 'name email farmName'),
    ]);

    if (customer) {
      sendOrderConfirmation(customer, order)
        .catch(err => console.error('[Email] Confirmation failed:', err));
    }

    // Group items by farm and notify each farm separately
    const farmItemsMap = new Map(); // farmId -> { farmUser, items }
    for (const fp of farmProductDocs) {
      if (!fp.farm) continue;
      const farmId = String(fp.farm._id);
      if (!farmItemsMap.has(farmId)) {
        farmItemsMap.set(farmId, { farmUser: fp.farm, items: [] });
      }
      const item = verifiedItems.find(i => String(i.product) === String(fp._id));
      if (item) farmItemsMap.get(farmId).items.push(item);
    }

    for (const { farmUser, items } of farmItemsMap.values()) {
      sendOrderReceived(farmUser, items, order)
        .catch(err => console.error('[Email] Farm notification failed:', err));
    }
  } catch (err) {
    console.error('[Email] notifyOrderPlaced failed:', err);
  }
}

async function notifyLowStock(productIds) {
  try {
    const lowStock = await Product.find({
      _id: { $in: productIds },
      stock: { $gt: 0, $lte: 5 },
    }).select('_id name stock farm').populate('farm', 'name email farmName');

    for (const product of lowStock) {
      if (!product.farm) continue;
      sendLowStockAlert(product.farm, product)
        .catch(err => console.error('[Email] Low-stock alert failed:', err));
    }
  } catch (err) {
    console.error('[Email] notifyLowStock failed:', err);
  }
}

async function notifyStatusUpdate(order) {
  try {
    const customer = await User.findById(order.user).select('name email');
    if (customer) {
      sendStatusUpdate(customer, order)
        .catch(err => console.error('[Email] Status update failed:', err));
    }
  } catch (err) {
    console.error('[Email] notifyStatusUpdate failed:', err);
  }
}

// ─── POST /api/orders ─────────────────────────────────────────────────────────

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
      price: priceMap[item.product].price,
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
      statusHistory: [{ status: 'pending', changedAt: new Date() }],
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

    // Email notifications — fire-and-forget after response is sent
    notifyOrderPlaced(req.user.id, productIds, verifiedItems, order);
    notifyLowStock(productIds);
  } catch (err) {
    res.status(400).json({ message: 'Could not place order' });
  }
});

// ─── GET /api/orders/my ───────────────────────────────────────────────────────

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

// ─── GET /api/orders/farm ─────────────────────────────────────────────────────

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

// ─── PATCH /api/orders/:id/status ────────────────────────────────────────────

router.patch('/:id/status', protect, [
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('status')
    .isIn(['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled'])
    .withMessage('Invalid status value'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const { role, id: userId } = req.user;

    if (role === 'customer') {
      // Customers may only cancel their own pending orders
      if (String(order.user) !== userId) {
        return res.status(403).json({ message: 'Not authorised to update this order' });
      }
      if (req.body.status !== 'cancelled') {
        return res.status(403).json({ message: 'Customers can only cancel orders' });
      }
      if (order.status !== 'pending') {
        return res.status(422).json({ message: 'Only pending orders can be cancelled' });
      }
    } else if (role === 'farm') {
      const productIds = order.items.map((i) => i.product);
      const owned = await Product.findOne({ _id: { $in: productIds }, farm: userId });
      if (!owned) return res.status(403).json({ message: 'Not authorised to update this order' });
    }
    // admin: unrestricted

    const allowed = VALID_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(req.body.status)) {
      return res.status(422).json({
        message: `Cannot transition order from "${order.status}" to "${req.body.status}"`,
      });
    }

    if (req.body.status === 'cancelled') {
      await Product.bulkWrite(
        order.items.map((item) => ({
          updateOne: {
            filter: { _id: item.product },
            update: { $inc: { stock: item.quantity } },
          },
        }))
      );
    }

    order.status = req.body.status;
    order.statusHistory.push({ status: req.body.status, changedAt: new Date() });
    await order.save();
    res.json(order);

    // Email notification — fire-and-forget after response is sent
    notifyStatusUpdate(order);
  } catch (err) {
    res.status(500).json({ message: 'Could not update order status' });
  }
});

// ─── GET /api/orders/:id ──────────────────────────────────────────────────────

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

// ─── GET /api/orders (admin) ──────────────────────────────────────────────────

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
