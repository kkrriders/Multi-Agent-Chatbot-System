/**
 * Redis client singleton (ioredis).
 *
 * Provides a single shared connection used by the rate limiter and any future
 * caching layer. Fails open: if Redis is unreachable the app continues without
 * it (rate limiters fall back to in-memory storage).
 *
 * Set REDIS_URL in .env to enable (e.g. redis://localhost:6379).
 * If REDIS_URL is absent, this module exports null and callers degrade gracefully.
 */

'use strict';

const Redis = require('ioredis');
const { logger } = require('../shared/logger');

let client = null;

if (process.env.REDIS_URL) {
  client = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,     // fail fast — don't block the request path
    enableReadyCheck: true,
    lazyConnect: false,
    connectTimeout: 3000,
  });

  client.on('connect', () => logger.info('Redis connected'));
  client.on('error',   (err) => logger.warn(`Redis error (rate limits falling back to in-memory): ${err.message}`));

  // Suppress unhandled rejection — errors are handled by the 'error' event above
  client.on('close', () => logger.warn('Redis connection closed'));
} else {
  logger.warn('REDIS_URL not set — rate limiters will use in-memory storage (not suitable for multi-instance deployments)');
}

module.exports = client;
