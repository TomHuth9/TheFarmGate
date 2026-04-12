const jwt = require('jsonwebtoken');

// Verify JWT and attach user payload to req.user
const protect = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token, authorisation denied' });
  }

  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET);
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
