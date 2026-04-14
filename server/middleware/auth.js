const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT (from httpOnly cookie or Authorization header) and attach decoded
// payload to req.user.  Also rejects tokens issued before a password change.
const protect = async (req, res, next) => {
  // 1. Extract token — cookie takes precedence over Authorization header
  let token = req.cookies?.token;
  if (!token) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token, authorisation denied' });
    }
    token = header.split(' ')[1];
  }

  try {
    // 2. Verify signature and expiry
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Reject tokens issued before the user last changed their password.
    //    This invalidates all sessions the moment a password reset completes.
    const user = await User.findById(decoded.id).select('passwordChangedAt');
    if (!user) {
      return res.status(401).json({ message: 'Token invalid or expired' });
    }
    if (user.passwordChangedAt) {
      const changedAt = Math.floor(user.passwordChangedAt.getTime() / 1000);
      if (changedAt > decoded.iat) {
        return res.status(401).json({ message: 'Token invalid or expired' });
      }
    }

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Token invalid or expired' });
  }
};

// Restrict to admin role only
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Allow farm accounts or admins through
const farmOrAdmin = (req, res, next) => {
  if (req.user?.role !== 'farm' && req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Farm or admin access required' });
  }
  next();
};

module.exports = { protect, adminOnly, farmOrAdmin };
