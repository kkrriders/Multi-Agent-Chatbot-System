/**
 * JWT logout blacklist.
 *
 * When a user logs out we store their token's `jti` in Redis with a TTL equal
 * to the token's remaining lifetime. Tokens without a `jti` (issued before this
 * feature was added) are silently allowed — they'll naturally expire.
 *
 * Fails open: if Redis is unavailable the blacklist check is skipped and the
 * logout still clears the cookie (best-effort security, not a hard block).
 */

'use strict';

const redisClient = require('../config/redis');
const { logger } = require('../shared/logger');

const BLACKLIST_PREFIX = 'jwt:bl:';

/**
 * Add a token's jti to the blacklist.
 * @param {string} jti  - Token ID from the JWT payload
 * @param {number} exp  - Token expiry (Unix timestamp in seconds)
 */
async function blacklistToken(jti, exp) {
  if (!jti) return; // legacy token without jti — skip
  if (!redisClient) return; // Redis unavailable — best effort

  const ttl = exp - Math.floor(Date.now() / 1000);
  if (ttl <= 0) return; // already expired

  try {
    await redisClient.set(`${BLACKLIST_PREFIX}${jti}`, '1', 'EX', ttl);
  } catch (err) {
    logger.warn(`tokenBlacklist: failed to blacklist jti=${jti}: ${err.message}`);
  }
}

/**
 * Check whether a jti has been blacklisted (i.e. the token was revoked).
 * @param {string} jti
 * @returns {Promise<boolean>} true if the token is revoked
 */
async function isBlacklisted(jti) {
  if (!jti) return false;
  if (!redisClient) return false;

  try {
    const result = await redisClient.exists(`${BLACKLIST_PREFIX}${jti}`);
    return result === 1;
  } catch (err) {
    logger.warn(`tokenBlacklist: Redis error during blacklist check: ${err.message}`);
    return false; // fail open — don't lock out users on Redis hiccup
  }
}

module.exports = { blacklistToken, isBlacklisted };
