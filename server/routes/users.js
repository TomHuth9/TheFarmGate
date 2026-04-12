const express = require('express');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const User = require('../models/User');
const Centre = require('../models/Centre');
const { protect } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');

const router = express.Router();

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

// Validation chains
const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }).withMessage('Name too long'),
  body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').isLength({ min: 6, max: 128 }).withMessage('Password must be 6–128 characters'),
  body('postcode').optional().trim().isLength({ max: 10 }).withMessage('Postcode too long')
    .matches(/^[A-Z0-9 ]*$/i).withMessage('Postcode contains invalid characters'),
  body('role').optional().isIn(['customer', 'farm']).withMessage('Invalid role'),
  body('farmName')
    .if(body('role').equals('farm'))
    .trim().notEmpty().withMessage('Farm name is required')
    .isLength({ max: 100 }).withMessage('Farm name too long'),
  body('farmDescription').optional().trim().isLength({ max: 1000 }).withMessage('Farm description too long'),
  body('farmLocation').optional().trim().isLength({ max: 200 }).withMessage('Farm location too long'),
];

const loginRules = [
  body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required').isLength({ max: 128 }),
];

// POST /api/users/register
router.post('/register', registerRules, handleValidationErrors, async (req, res) => {
  try {
    const { name, email, password, postcode, role, farmName, farmDescription, farmLocation } = req.body;

    if (await User.findOne({ email })) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const safeRole = role === 'farm' ? 'farm' : 'customer';

    let assignedCentre = null;
    if (postcode && safeRole === 'customer') {
      const prefix = postcode.trim().toUpperCase().split(' ')[0];
      assignedCentre = await Centre.findOne({ servedPostcodes: prefix });
    }

    const user = await User.create({
      name,
      email,
      password,
      postcode,
      assignedCentre,
      role: safeRole,
      farmName,
      farmDescription,
      farmLocation,
    });

    const token = signToken(user);
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, farmName: user.farmName },
    });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed' });
  }
});

// POST /api/users/login
router.post('/login', loginRules, handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = signToken(user);
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, farmName: user.farmName },
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed' });
  }
});

// GET /api/users/me
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password').populate('assignedCentre');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch profile' });
  }
});

module.exports = router;
