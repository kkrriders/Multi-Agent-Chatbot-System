/**
 * Centralized retry utility with exponential backoff and full jitter.
 *
 * Problem: retry logic was duplicated across ollama.js (2 retries, 1 s linear)
 * and agent-base.js (3 retries, linear). Neither applied jitter, so concurrent
 * retries fired at the same millisecond — recreating the thundering herd.
 *
 * Algorithm: "full jitter" exponential backoff (AWS architecture blog)
 *   delay = random(0, min(maxDelayMs, baseDelayMs * 2^attempt))
 *
 * This spreads retry storms across the full window rather than clustering them
 * at the base interval. Expected average delay is half the capped window.
 *
 * Usage:
 *   const result = await withRetry(() => axios.post(...), {
 *     maxAttempts: 3,
 *     baseDelayMs: 500,
 *     maxDelayMs: 10_000,
 *     retryOn: (err) => ['ECONNRESET','ETIMEDOUT'].includes(err.code),
 *   })
 */

'use strict';

const { logger } = require('./logger');

// Error codes that indicate a transient infrastructure fault (safe to retry)
const DEFAULT_RETRYABLE_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'ETIMEDOUT',
  'ENETUNREACH',
  'EAI_AGAIN',
]);

/**
 * @param {() => Promise<T>}  fn
 * @param {object}            [opts]
 * @param {number}            [opts.maxAttempts=3]
 * @param {number}            [opts.baseDelayMs=500]
 * @param {number}            [opts.maxDelayMs=15000]
 * @param {(err: Error) => boolean} [opts.retryOn]  custom predicate; defaults to transient network errors
 * @returns {Promise<T>}
 */
async function withRetry(fn, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelay   = opts.baseDelayMs ?? 500;
  const maxDelay    = opts.maxDelayMs  ?? 15_000;
  const retryOn     = opts.retryOn ?? ((err) => DEFAULT_RETRYABLE_CODES.has(err.code));

  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const isLast = attempt === maxAttempts - 1;
      if (isLast || !retryOn(err)) throw err;

      const cap   = Math.min(maxDelay, baseDelay * 2 ** attempt);
      const delay = Math.random() * cap; // full jitter: spread across [0, cap]

      logger.warn(
        `[retry] attempt ${attempt + 1}/${maxAttempts} failed (${err.code ?? err.message}) — ` +
        `retrying in ${Math.round(delay)}ms`
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { withRetry };
