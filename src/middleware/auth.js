const { verifyToken } = require('../utils/jwt');
const { isBlacklisted } = require('../utils/tokenBlacklist');
const User = require('../models/User');
const { logger } = require('../shared/logger');

/**
 * Authentication middleware to protect routes
 * Extracts JWT from cookie or Authorization header
 */
const authenticate = async (req, res, next) => {
  try {
    let token = null;

    // Check for token in cookies first
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // Check for token in Authorization header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route',
      });
    }

    // Verify token
    const decoded = verifyToken(token);

    // Reject tokens that have been explicitly revoked (e.g. via logout)
    if (await isBlacklisted(decoded.jti)) {
      return res.status(401).json({
        success: false,
        error: 'Token has been revoked',
      });
    }

    // Get user from database
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'User account is inactive',
      });
    }

    // Attach user and decoded token payload to request
    req.user = user;
    req.tokenPayload = decoded; // exposes jti/exp to logout handler
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
};

/**
 * Optional authentication middleware
 * Adds user to request if token is valid, but doesn't block request if invalid
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token = null;

    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    if (token) {
      const decoded = verifyToken(token);
      if (!await isBlacklisted(decoded.jti)) {
        const user = await User.findById(decoded.id).select('-password');
        if (user && user.isActive) {
          req.user = user;
        }
      }
    }
  } catch (error) {
    // Silently fail - this is optional auth
    logger.debug('Optional auth failed:', error.message);
  }

  next();
};

module.exports = {
  authenticate,
  optionalAuth,
};
