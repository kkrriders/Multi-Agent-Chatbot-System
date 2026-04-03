const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');

// No fallback — validateEnv() guarantees JWT_SECRET is set before this module loads.
// If JWT_SECRET is missing here, something has bypassed startup validation.
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

// Parse expiry string into seconds so callers can compute remaining TTL.
function parseExpireSeconds(expireStr) {
  const units = { s: 1, m: 60, h: 3600, d: 86400, w: 604800, y: 31536000 };
  const match = String(expireStr).match(/^(\d+)([smhdw]?)$/);
  if (!match) return 7 * 86400; // fallback: 7 days
  const n = parseInt(match[1], 10);
  const unit = match[2] || 's';
  return n * (units[unit] || 1);
}

/** Lifetime of a token in seconds (used by the blacklist TTL). */
const JWT_EXPIRE_SECONDS = parseExpireSeconds(JWT_EXPIRE);

/**
 * Generate JWT token for a user
 * @param {Object} user - User object with _id
 * @returns {String} JWT token
 */
const generateToken = (user) => {
  const payload = {
    id: user._id.toString(),
    email: user.email,
    jti: randomUUID(),   // unique token ID — required for logout blacklisting
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRE,
  });
};

/**
 * Verify JWT token
 * @param {String} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

/**
 * Decode JWT token without verification (useful for debugging)
 * @param {String} token - JWT token to decode
 * @returns {Object} Decoded token payload
 */
const decodeToken = (token) => {
  return jwt.decode(token);
};

module.exports = {
  generateToken,
  verifyToken,
  decodeToken,
  JWT_EXPIRE_SECONDS,
};
