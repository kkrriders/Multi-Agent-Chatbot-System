'use strict';

// ── Environment ─────────────────────────────────────────────────────────────
// Must be set before ANY src/ module is required.
// src/utils/jwt.js captures JWT_SECRET at module-load time, so this block
// must run before the first transitive require of that module.
process.env.JWT_SECRET          = 'e2e-test-jwt-secret-32chars-xxxxxxxx!!';
process.env.MONGODB_URI         = 'mongodb://localhost:27017/test';
process.env.FRONTEND_URL        = 'http://localhost:3002';
process.env.AGENT_SHARED_SECRET = 'e2e-test-agent-secret-32chars-xxxxx!!';
process.env.NODE_ENV            = 'test';

const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');

const ORIGIN = process.env.FRONTEND_URL;

/**
 * Mirrors the CSRF guard from manager/index.js.
 * State-changing requests must carry Origin: <FRONTEND_URL>.
 */
function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const source = req.headers.origin;
  if (!source || source !== ORIGIN) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  next();
}

/**
 * Creates a minimal Express app wiring up all REST routes.
 * No DB connection, Redis, or Socket.IO — callers must mock all models
 * via jest.mock() before calling this function.
 *
 * Routes are required lazily (inside this function) so that jest.mock()
 * factories registered by the calling test file are already in place.
 */
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(cors({ origin: ORIGIN, credentials: true }));

  // Health — public, no auth required
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), circuitBreakers: [] });
  });

  const authRoutes         = require('../../../src/routes/auth');
  const conversationRoutes = require('../../../src/routes/conversations');
  const promptRoutes       = require('../../../src/routes/prompts');

  app.use('/api/auth',          csrfProtection, authRoutes);
  // conversations + prompts routers apply authenticate() internally
  app.use('/api/conversations', csrfProtection, conversationRoutes);
  app.use('/api/prompts',       csrfProtection, promptRoutes);

  return app;
}

module.exports = { createTestApp, ORIGIN };
