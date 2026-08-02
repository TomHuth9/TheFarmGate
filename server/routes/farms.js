const express = require('express');
const { param, query } = require('express-validator');
const User = require('../models/User');
const Product = require('../models/Product');
const { handleValidationErrors } = require('../middleware/validate');

const router = express.Router();

// GET /api/farms — list all farm accounts (public)
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const farms = await User.find({ role: 'farm' })
      .select('farmName farmDescription farmLocation postcode name createdAt')
      .sort({ farmName: 1 })
      .skip(skip)
      .limit(limit);
    res.json(farms);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch farms' });
  }
});

// GET /api/farms/:id — farm profile + their products (public)
router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid farm ID'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const farm = await User.findOne({ _id: req.params.id, role: 'farm' })
      .select('farmName farmDescription farmLocation name createdAt');

    if (!farm) return res.status(404).json({ message: 'Farm not found' });

    const products = await Product.find({ farm: farm._id }).sort({ category: 1, name: 1 });

    res.json({ farm, products });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch farm' });
  }
});

module.exports = router;
