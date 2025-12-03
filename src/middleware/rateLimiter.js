const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for general API endpoints
 * Allows 100 requests per 15 minutes per IP
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

/**
 * Strict rate limiter for authentication endpoints
 * Allows 5 requests per 15 minutes per IP to prevent brute force attacks
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login/signup requests per windowMs
  skipSuccessfulRequests: true, // Don't count successful requests
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many authentication attempts',
      message: 'Please wait before trying again.',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

/**
 * Rate limiter for message/chat endpoints
 * Allows 30 requests per minute per IP
 */
const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 messages per minute
  message: {
    error: 'Too many messages sent, please slow down.',
    retryAfter: '1 minute'
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Message rate limit exceeded',
      message: 'Please wait a moment before sending more messages.',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

/**
 * Rate limiter for PDF export endpoints
 * Allows 5 exports per hour per IP
 */
const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 exports per hour
  message: {
    error: 'Too many export requests, please try again later.',
    retryAfter: '1 hour'
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Export rate limit exceeded',
      message: 'You can only export 5 conversations per hour.',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

/**
 * Rate limiter for conversation creation
 * Allows 20 new conversations per hour per IP
 */
const createConversationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 new conversations per hour
  message: {
    error: 'Too many conversations created, please try again later.',
    retryAfter: '1 hour'
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Conversation creation rate limit exceeded',
      message: 'You can only create 20 conversations per hour.',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

module.exports = {
  generalLimiter,
  authLimiter,
  messageLimiter,
  exportLimiter,
  createConversationLimiter
};
