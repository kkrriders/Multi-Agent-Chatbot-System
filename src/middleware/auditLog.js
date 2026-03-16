/**
 * Audit Logging Middleware
 *
 * Records every authenticated API action to a dedicated audit.log file.
 * The audit log is separate from the application log and must never be
 * mixed with debug output or printed to the console.
 *
 * Log format (newline-delimited JSON):
 *   { timestamp, userId, email, method, path, ip, statusCode, userAgent, durationMs }
 *
 * Apply AFTER authenticate middleware so req.user is populated.
 * For auth routes (login/signup) that run before authenticate, call
 * auditEvent() directly inside the route handler.
 */

'use strict';

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

// Dedicated audit logger — append-only, JSON, no console output
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'audit.log'),
      // Never rotate automatically — use logrotate on the OS level in production
      maxsize: undefined,
    }),
  ],
});

/**
 * Write a single audit event. Use this for inline events (login, logout)
 * where the Express middleware pattern doesn't apply.
 *
 * @param {object} fields
 * @param {string} fields.userId
 * @param {string} fields.email
 * @param {string} fields.action  - e.g. 'login.success', 'signup.attempt'
 * @param {string} fields.ip
 * @param {string} [fields.userAgent]
 * @param {boolean} [fields.success]
 * @param {string} [fields.detail] - optional extra context
 */
function auditEvent({ userId, email, action, ip, userAgent, success = true, detail }) {
  auditLogger.info({
    userId: userId || 'anonymous',
    email:  email  || 'unknown',
    action,
    ip,
    userAgent,
    success,
    detail,
  });
}

/**
 * Express middleware that logs every request handled by an authenticated route.
 * Captures the status code via res.on('finish') so the full round-trip is recorded.
 *
 * Usage in manager/index.js:
 *   app.use('/api/conversations', generalLimiter, csrfProtection, authenticate, auditLog, conversationRoutes);
 */
function auditLog(req, res, next) {
  const startMs = Date.now();

  res.on('finish', () => {
    auditLogger.info({
      userId:     req.user?.id    || 'anonymous',
      email:      req.user?.email || 'unknown',
      method:     req.method,
      path:       req.path,
      ip:         req.ip || req.socket?.remoteAddress,
      statusCode: res.statusCode,
      userAgent:  req.headers['user-agent'],
      durationMs: Date.now() - startMs,
    });
  });

  next();
}

module.exports = { auditLog, auditEvent };
