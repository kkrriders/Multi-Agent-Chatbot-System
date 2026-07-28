'use strict';

/**
 * Level 1 (exact-match) AI response cache, backed by the same shared Redis
 * client as the rate limiter — no new infra. Fails open: if Redis is absent
 * or unreachable, every lookup is treated as a miss and nothing breaks.
 *
 * Level 2 (semantic-similarity cache) is a real future upgrade — this only
 * catches byte-identical prompts, not "close enough" ones.
 */

const crypto = require('crypto');
const redis = require('../../config/redis');
const { logger } = require('../../shared/logger');

const PREFIX = 'ai-cache:';

function _key(callSite, tier, prompt) {
  const hash = crypto.createHash('sha256').update(`${tier}:${prompt}`).digest('hex');
  return `${PREFIX}${callSite}:${hash}`;
}

async function get(callSite, tier, prompt) {
  if (!redis) return null;
  try {
    const raw = await redis.get(_key(callSite, tier, prompt));
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.warn(`[response-cache] read failed, treating as a miss: ${err.message}`);
    return null;
  }
}

async function set(callSite, tier, prompt, value, ttlSeconds) {
  if (!redis) return;
  try {
    await redis.set(_key(callSite, tier, prompt), JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    logger.warn(`[response-cache] write failed (non-fatal): ${err.message}`);
  }
}

module.exports = { get, set };
