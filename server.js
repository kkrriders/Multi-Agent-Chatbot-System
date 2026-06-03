'use strict';

const dotenv = require('dotenv');
dotenv.config();

const validateEnv = require('./src/utils/validateEnv');
validateEnv();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const cookieParser = require('cookie-parser');

const { logger } = require('./src/shared/logger');
const { connectDB } = require('./src/config/database');

const authRoutes      = require('./src/routes/auth');
const oauthRoutes     = require('./src/routes/oauth');
const cvRoutes        = require('./src/routes/cv');
const interviewRoutes = require('./src/routes/interview');
const progressRoutes  = require('./src/routes/progress');
const questionRoutes  = require('./src/routes/questions');

const { authenticate } = require('./src/middleware/auth');
const { auditLog }     = require('./src/middleware/auditLog');
const {
  generalLimiter,
  authLimiter,
  messageLimiter,
} = require('./src/middleware/rateLimiter');

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);

// ── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:3002'],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:'],
      frameSrc:   ["'none'"],
      objectSrc:  ["'none'"],
    },
  },
  hsts:           { maxAge: 31536000, includeSubDomains: true },
  frameguard:     { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false,
}));

// Redirect HTTP → HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.hostname}${req.url}`);
    }
    next();
  });
}

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3002')
  .split(',')
  .map(o => o.trim().replace(/\/$/, ''));

app.use(cors({
  origin: (origin, cb) => {
    // allow server-to-server and same-origin requests
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

// ── CSRF protection ───────────────────────────────────────────────────────────
function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const allowed = process.env.FRONTEND_URL || 'http://localhost:3002';
  let source = req.headers.origin;
  if (!source && req.headers.referer) {
    try { source = new URL(req.headers.referer).origin; } catch (_) { /* ignore */ }
  }
  if (!source || source !== allowed) {
    logger.warn(`CSRF: blocked ${req.method} ${req.path} from origin="${source}"`);
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  next();
}

// ── Database ──────────────────────────────────────────────────────────────────
connectDB().catch(err => logger.error('MongoDB connection failed:', err));

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', generalLimiter, (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',      authLimiter,    csrfProtection, auditLog, authRoutes);
app.use('/api/auth',      authLimiter,    oauthRoutes);   // OAuth callbacks skip CSRF (use state param instead)
app.use('/api/cv',        generalLimiter, csrfProtection, cvRoutes);
app.use('/api/interview', messageLimiter, csrfProtection, interviewRoutes);
app.use('/api/progress',  generalLimiter, csrfProtection, progressRoutes);
app.use('/api/questions', generalLimiter, csrfProtection, questionRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ success: false, error: 'An unexpected error occurred' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  logger.info(`MockPrep API running on port ${PORT}`);
});

module.exports = { app, server };
