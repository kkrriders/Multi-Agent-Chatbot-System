const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redisClient = require('../config/redis');

/**
 * Build a RedisStore if Redis is available, otherwise return undefined
 * so express-rate-limit uses its default in-memory store.
 */
function buildStore(prefix) {
  if (!redisClient) return undefined;
  return new RedisStore({
    prefix: `rl:${prefix}:`,
    // ioredis uses the 'call' method signature expected by rate-limit-redis
    sendCommand: (...args) => redisClient.call(...args),
  });
}

/**
 * Rate limiter for general API endpoints
 * Allows 100 requests per 15 minutes per IP
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore('general'),
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests', message: 'You have exceeded the rate limit. Please try again later.', retryAfter: req.rateLimit.resetTime });
  }
});

/**
 * Strict rate limiter for authentication endpoints
 * Allows 5 requests per 15 minutes per IP to prevent brute force attacks
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  store: buildStore('auth'),
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many authentication attempts', message: 'Please wait before trying again.', retryAfter: req.rateLimit.resetTime });
  }
});

/**
 * Rate limiter for message/chat endpoints
 * Allows 30 requests per minute, keyed on authenticated user ID when available
 * (avoids blocking all users behind a shared NAT IP).
 */
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?.id?.toString() || ipKeyGenerator(req),
  store: buildStore('message'),
  handler: (req, res) => {
    res.status(429).json({ error: 'Message rate limit exceeded', message: 'Please wait a moment before sending more messages.', retryAfter: req.rateLimit.resetTime });
  }
});

/**
 * Rate limiter for PDF export endpoints
 * Allows 5 exports per hour, keyed on user ID (export route requires auth).
 */
const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.user?.id?.toString() || ipKeyGenerator(req),
  store: buildStore('export'),
  handler: (req, res) => {
    res.status(429).json({ error: 'Export rate limit exceeded', message: 'You can only export 5 conversations per hour.', retryAfter: req.rateLimit.resetTime });
  }
});

/**
 * Rate limiter for conversation creation
 * Allows 20 new conversations per hour per IP
 */
const createConversationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  store: buildStore('createConv'),
  handler: (req, res) => {
    res.status(429).json({ error: 'Conversation creation rate limit exceeded', message: 'You can only create 20 conversations per hour.', retryAfter: req.rateLimit.resetTime });
  }
});

module.exports = {
  generalLimiter,
  authLimiter,
  messageLimiter,
  exportLimiter,
  createConversationLimiter
};
