const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const { body, param } = require('express-validator');
const User = require('../models/User');
const Centre = require('../models/Centre');
const { protect, adminOnly } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');
const { sendVerificationEmail, sendPasswordReset } = require('../utils/email');

const router = express.Router();

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

// Cookie options — httpOnly so JavaScript cannot read the token
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days — matches JWT expiry
  path: '/',
});

function setAuthCookie(res, token) {
  res.cookie('token', token, cookieOptions());
}

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

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    await User.create({
      name, email, password, postcode, assignedCentre,
      role: safeRole, farmName, farmDescription, farmLocation,
      emailVerified: false,
      emailVerificationToken: hashedToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:4200';
    await sendVerificationEmail(email, `${clientOrigin}/verify-email/${rawToken}`);

    res.status(201).json({ requiresVerification: true });
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

    // Strict false check so existing users without the field are unaffected
    if (user.emailVerified === false) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
      user.emailVerificationToken = hashedToken;
      user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await user.save({ validateBeforeSave: false });

      const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:4200';
      await sendVerificationEmail(user.email, `${clientOrigin}/verify-email/${rawToken}`);

      return res.json({ requiresVerification: true });
    }

    const token = signToken(user);
    setAuthCookie(res, token);

    res.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role, farmName: user.farmName },
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed' });
  }
});

// GET /api/users/verify-email/:token
router.get('/verify-email/:token', [
  param('token').isHexadecimal().isLength({ min: 64, max: 64 }).withMessage('Invalid token'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Verification link is invalid or has expired.' });
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    res.json({ message: 'Email verified successfully. You can now sign in.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not verify email' });
  }
});

// POST /api/users/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ message: 'Logged out' });
});

// GET /api/users/me
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -resetPasswordToken -resetPasswordExpires -passwordChangedAt')
      .populate('assignedCentre');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch profile' });
  }
});

// PATCH /api/users/me — update own profile
router.patch('/me', protect, [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be blank').isLength({ max: 100 }),
  body('postcode').optional().trim().isLength({ max: 10 }).withMessage('Postcode too long')
    .matches(/^[A-Z0-9 ]*$/i).withMessage('Postcode contains invalid characters'),
  body('farmName').optional().trim().isLength({ max: 100 }).withMessage('Farm name too long'),
  body('farmDescription').optional().trim().isLength({ max: 1000 }).withMessage('Farm description too long'),
  body('farmLocation').optional().trim().isLength({ max: 200 }).withMessage('Farm location too long'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { name, postcode, farmName, farmDescription, farmLocation } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (postcode !== undefined) update.postcode = postcode;
    if (req.user.role === 'farm') {
      if (farmName !== undefined) update.farmName = farmName;
      if (farmDescription !== undefined) update.farmDescription = farmDescription;
      if (farmLocation !== undefined) update.farmLocation = farmLocation;
    }

    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true, runValidators: true })
      .select('name email role postcode farmName farmDescription farmLocation');

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Could not update profile' });
  }
});

// POST /api/users/forgot-password
router.post('/forgot-password', [
  body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    // Always respond 200 — never reveal whether an email is registered
    if (!user) {
      return res.json({ message: 'If an account exists for that email, a reset link has been sent.' });
    }

    // Generate a secure random token; store only the hash in the DB
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save({ validateBeforeSave: false });

    const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:4200';
    const resetUrl = `${clientOrigin}/reset-password/${rawToken}`;

    await sendPasswordReset(user.email, resetUrl);

    res.json({ message: 'If an account exists for that email, a reset link has been sent.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not process request' });
  }
});

// POST /api/users/reset-password/:token
router.post('/reset-password/:token', [
  param('token').isHexadecimal().isLength({ min: 64, max: 64 }).withMessage('Invalid reset token'),
  body('password').isLength({ min: 6, max: 128 }).withMessage('Password must be 6–128 characters'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Reset link is invalid or has expired.' });
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    // Record when the password changed so protect() can reject older tokens
    user.passwordChangedAt = new Date();
    await user.save();

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not reset password' });
  }
});

// GET /api/users — admin: list all users
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password -resetPasswordToken -resetPasswordExpires -passwordChangedAt')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch users' });
  }
});

// PATCH /api/users/:id/role — admin: change a user's role
router.patch('/:id/role', protect, adminOnly, [
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('role').isIn(['customer', 'farm', 'admin']).withMessage('Invalid role'),
  handleValidationErrors,
], async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(403).json({ message: 'Cannot change your own role' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role: req.body.role },
      { new: true }
    ).select('-password -resetPasswordToken -resetPasswordExpires -passwordChangedAt');

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Could not update role' });
  }
});

// DELETE /api/users/:id — admin: delete a user
router.delete('/:id', protect, adminOnly, [
  param('id').isMongoId().withMessage('Invalid user ID'),
  handleValidationErrors,
], async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(403).json({ message: 'Cannot delete your own account' });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete user' });
  }
});

module.exports = router;
