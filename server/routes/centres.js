const express = require('express');
const { query, param } = require('express-validator');
const Centre = require('../models/Centre');
const { handleValidationErrors } = require('../middleware/validate');

const router = express.Router();

// GET /api/centres
router.get('/', async (req, res) => {
  try {
    const centres = await Centre.find().sort({ name: 1 });
    res.json(centres);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch centres' });
  }
});

// GET /api/centres/lookup?postcode=SW16
router.get('/lookup', [
  query('postcode')
    .trim()
    .notEmpty().withMessage('Postcode required')
    .isLength({ max: 10 }).withMessage('Postcode too long')
    .matches(/^[A-Z0-9 ]+$/i).withMessage('Invalid postcode format'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const prefix = req.query.postcode.trim().toUpperCase().split(' ')[0];
    const centre = await Centre.findOne({ servedPostcodes: prefix });
    if (!centre) return res.status(404).json({ message: 'No centre found for this postcode' });
    res.json(centre);
  } catch (err) {
    res.status(500).json({ message: 'Could not look up centre' });
  }
});

// GET /api/centres/:id
router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid centre ID'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const centre = await Centre.findById(req.params.id);
    if (!centre) return res.status(404).json({ message: 'Centre not found' });
    res.json(centre);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch centre' });
  }
});

module.exports = router;
