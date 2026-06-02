'use strict';

/**
 * Multi-provider AI service with automatic fallback chain.
 *
 * Chain: Groq → OpenRouter (only when OPENROUTER_API_KEY is set)
 * On quota_exhausted or auth_invalid, falls through to the next provider.
 * On transient errors (network, 5xx), the provider's own retry logic handles it.
 *
 * Model strategy for interview workloads:
 *   - Mechanical tasks (scoring rubrics, JSON extraction): small/fast models
 *   - Orchestration (question generation, feedback synthesis): mid-tier models
 *   - Architecture decisions: not handled here, use plannerAgent directly
 */

'use strict';

const groq = require('./providers/groq-provider');
const openrouter = require('./providers/openrouter-provider');
const { withRetry } = require('../../shared/retry');
const { logger } = require('../../shared/logger');

// Ordered fallback chain — OpenRouter only included when key is configured
const PROVIDERS = process.env.OPENROUTER_API_KEY
  ? [groq, openrouter]
  : [groq];

// Model tiers for interview workloads
const MODELS = {
  fast: {
    groq: 'llama-3.1-8b-instant',
    openrouter: 'meta-llama/llama-3.1-8b-instruct:free',
  },
  balanced: {
    groq: process.env.MANAGER_MODEL || 'llama-3.3-70b-versatile',
    openrouter: 'meta-llama/llama-3.3-70b-instruct:free',
  },
  quality: {
    groq: process.env.AGENT_2_MODEL || 'qwen/qwen3-32b',
    openrouter: 'qwen/qwen3-32b',
  },
};

const RETRYABLE = (err) => {
  const type = err.providerErrorType;
  return !type || type === 'transient';
};

async function _callWithFallback(method, tier, prompt, options) {
  const errors = [];

  for (const provider of PROVIDERS) {
    const model = MODELS[tier]?.[provider.name] || MODELS.fast[provider.name];
    try {
      const result = await withRetry(
        () => provider[method](model, prompt, options),
        { maxAttempts: 2, baseDelayMs: 500, maxDelayMs: 5_000, retryOn: RETRYABLE }
      );
      if (errors.length > 0) {
        logger.info(`[provider-manager] fell through to ${provider.name} after ${errors.length} provider(s) failed`);
      }
      return result;
    } catch (err) {
      const type = err.providerErrorType || 'transient';
      logger.warn(`[provider-manager] ${provider.name} failed (${type}): ${err.message}`);
      errors.push({ provider: provider.name, type, message: err.message });
      if (type === 'unrecoverable') break;
    }
  }

  const summary = errors.map(e => `${e.provider}:${e.type}`).join(', ');
  throw new Error(`All AI providers exhausted — ${summary}`);
}

/**
 * Generate text. Returns { text, inputTokens, outputTokens, provider }
 * @param {string} prompt
 * @param {'fast'|'balanced'|'quality'} [tier='balanced']
 * @param {object} [options]
 */
function generate(prompt, tier = 'balanced', options = {}) {
  return _callWithFallback('generate', tier, prompt, options);
}

/**
 * Generate structured JSON. Returns { data, inputTokens, outputTokens, provider }
 * @param {string} prompt
 * @param {'fast'|'balanced'|'quality'} [tier='fast']
 * @param {object} [options]
 */
function generateJson(prompt, tier = 'fast', options = {}) {
  return _callWithFallback('generateJson', tier, prompt, options);
}

/**
 * Verify at least one provider is reachable. Logs results.
 */
async function healthCheck() {
  const results = await Promise.allSettled(PROVIDERS.map(p => p.isAvailable()));
  return PROVIDERS.map((p, i) => ({
    provider: p.name,
    available: results[i].status === 'fulfilled' && results[i].value === true,
  }));
}

module.exports = { generate, generateJson, healthCheck, MODELS };
