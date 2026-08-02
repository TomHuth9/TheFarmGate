const express = require('express');
const mongoose = require('mongoose');
const { body, param, query } = require('express-validator');
const Review = require('../models/Review');
const Order  = require('../models/Order');
const { protect } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');

// mergeParams lets us read :id from the parent products router
const router = express.Router({ mergeParams: true });

// ─── GET /api/products/:id/reviews ────────────────────────────────────────────

router.get('/', [
  param('id').isMongoId().withMessage('Invalid product ID'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const productId = new mongoose.Types.ObjectId(req.params.id);
    const page  = Math.max(1, req.query.page  || 1);
    const limit = Math.min(50, req.query.limit || 20);
    const skip  = (page - 1) * limit;

    const [reviews, total, [stats]] = await Promise.all([
      Review.find({ product: productId })
        .populate('user', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Review.countDocuments({ product: productId }),
      Review.aggregate([
        { $match: { product: productId } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      reviews,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      avgRating: stats?.avg   ?? null,
      count:     stats?.count ?? 0,
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch reviews' });
  }
});

// ─── POST /api/products/:id/reviews ───────────────────────────────────────────

router.post('/', protect, [
  param('id').isMongoId().withMessage('Invalid product ID'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('body').optional().trim().isLength({ max: 500 }).withMessage('Review text must be 500 characters or fewer'),
  handleValidationErrors,
], async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ message: 'Only customers can submit reviews' });
    }

    const productId = req.params.id;

    // Require a confirmed/dispatched/delivered order containing this product
    const hasPurchased = await Order.exists({
      user: req.user.id,
      'items.product': productId,
      status: { $in: ['confirmed', 'dispatched', 'delivered'] },
    });

    if (!hasPurchased) {
      return res.status(403).json({ message: 'You can only review products you have purchased' });
    }

    const review = await Review.create({
      product: productId,
      user:    req.user.id,
      rating:  req.body.rating,
      body:    req.body.body || '',
    });

    await review.populate('user', 'name');
    res.status(201).json(review);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'You have already reviewed this product' });
    }
    res.status(400).json({ message: 'Could not submit review' });
  }
});

module.exports = router;
