const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const { sanitizeInputs } = require('./middleware/sanitize');

const productRoutes = require('./routes/products');
const userRoutes = require('./routes/users');
const orderRoutes = require('./routes/orders');
const centreRoutes = require('./routes/centres');
const farmRoutes = require('./routes/farms');

const app = express();

// --- Security headers (XSS, clickjacking, MIME sniffing, HSTS, etc.)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      baseUri:        ["'self'"],
      fontSrc:        ["'self'", 'https:', 'data:'],
      formAction:     ["'self'"],
      frameAncestors: ["'self'"],
      imgSrc:         ["'self'", 'data:', 'https://res.cloudinary.com'],
      objectSrc:      ["'none'"],
      scriptSrc:      ["'self'"],
      scriptSrcAttr:  ["'none'"],
      styleSrc:       ["'self'", 'https:', "'unsafe-inline'"],
      connectSrc:     ["'self'", 'https://api.cloudinary.com'],
      upgradeInsecureRequests: [],
    },
  },
}));

// --- CORS — origin from env so it works in production without code changes
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:4200',
  credentials: true,
}));

// --- Reject excessively long query strings
app.use((req, res, next) => {
  const q = req.originalUrl.indexOf('?');
  if (q !== -1 && req.originalUrl.length - q > 500) {
    return res.status(400).json({ message: 'Query string too long' });
  }
  next();
});

// --- Enforce application/json Content-Type on mutating requests
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const ct = req.headers['content-type'] || '';
    if (!ct.includes('application/json')) {
      return res.status(415).json({ message: 'Content-Type must be application/json' });
    }
  }
  next();
});

// --- Parse cookies (required for httpOnly JWT cookie auth)
app.use(cookieParser());

// --- Body parsing with a size limit to prevent payload flooding
app.use(express.json({ limit: '10kb' }));

// --- Catch malformed JSON before it reaches routes
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Malformed JSON' });
  }
  next(err);
});

// --- Strip $ and . from request body/params to prevent NoSQL injection
app.use(mongoSanitize());

// --- Trim strings and strip null bytes / control characters from all inputs
app.use(sanitizeInputs);

// --- Rate limiters (disabled in test environment to avoid flaky tests)
const isTest = process.env.NODE_ENV === 'test';

// Strict limiter for auth endpoints — 5 attempts per 15 min per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 1000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again in 15 minutes' },
});

// General API limiter — 200 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTest ? 10000 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please slow down' },
});

app.use('/api/', apiLimiter);
app.use('/api/users/login', authLimiter);
app.use('/api/users/register', authLimiter);
app.use('/api/users/forgot-password', authLimiter);
app.use('/api/users/reset-password', authLimiter);
app.use('/api/users/verify-email', authLimiter);

// --- Routes
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/centres', centreRoutes);
app.use('/api/farms', farmRoutes);

// --- Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// --- Unmatched /api routes → 404 JSON (must come before the SPA fallback)
app.use('/api/*', (req, res) => res.status(404).json({ message: 'Not found' }));

// --- Serve Angular build in production (with SSR)
if (process.env.NODE_ENV === 'production') {
  const BROWSER = path.join(__dirname, '..', 'client', 'dist', 'client', 'browser');
  const SERVER_BUNDLE = path.join(__dirname, '..', 'client', 'dist', 'client', 'server', 'server.mjs');

  app.use(express.static(BROWSER, { index: false }));

  // Lazily initialise the Angular SSR handler (promise cached after first load)
  let ssrHandlerPromise = null;
  const getSSRHandler = () => {
    if (!ssrHandlerPromise) {
      ssrHandlerPromise = import(SERVER_BUNDLE).then(({ app: ngApp }) => ngApp());
    }
    return ssrHandlerPromise;
  };

  app.get('*', async (req, res, next) => {
    try {
      const handler = await getSSRHandler();
      handler(req, res, next);
    } catch (err) {
      next(err);
    }
  });
}

// --- Global error handler — never leak stack traces or Mongoose internals
app.use((err, req, res, _next) => {
  const isDev = process.env.NODE_ENV === 'development';
  console.error(err);
  res.status(err.status || 500).json({
    message: isDev ? err.message : 'An unexpected error occurred',
  });
});

module.exports = app;
