const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');

const productRoutes = require('./routes/products');
const userRoutes = require('./routes/users');
const orderRoutes = require('./routes/orders');
const centreRoutes = require('./routes/centres');
const farmRoutes = require('./routes/farms');

const app = express();

// --- Security headers (XSS, clickjacking, MIME sniffing, HSTS, etc.)
app.use(helmet());

// --- CORS — origin from env so it works in production without code changes
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:4200',
  credentials: true,
}));

// --- Body parsing with a size limit to prevent payload flooding
app.use(express.json({ limit: '10kb' }));

// --- Strip $ and . from request body/params to prevent NoSQL injection
app.use(mongoSanitize());

// --- Rate limiters (disabled in test environment to avoid flaky tests)
const isTest = process.env.NODE_ENV === 'test';

// Strict limiter for auth endpoints — 10 attempts per 15 min per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 1000 : 10,
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

// --- Routes
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/centres', centreRoutes);
app.use('/api/farms', farmRoutes);

// --- Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// --- Global error handler — never leak stack traces or Mongoose internals
app.use((err, req, res, _next) => {
  const isDev = process.env.NODE_ENV === 'development';
  console.error(err);
  res.status(err.status || 500).json({
    message: isDev ? err.message : 'An unexpected error occurred',
  });
});

module.exports = app;
