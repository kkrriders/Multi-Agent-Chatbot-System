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

const groq = require('./providers/groq-provider');
const openrouter = require('./providers/openrouter-provider');
const { withRetry } = require('../../shared/retry');
const { logger } = require('../../shared/logger');
const AiUsageLog = require('../../models/AiUsageLog');
const responseCache = require('./response-cache');

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

// $ per 1K tokens (input+output combined). Every model in use today is on a free
// tier, so this is honestly 0 — the table exists so a paid model only needs a
// rate added here, not a new cost-tracking mechanism built later.
const COST_PER_1K_TOKENS = {
  'llama-3.1-8b-instant': 0,
  'llama-3.3-70b-versatile': 0,
  'qwen/qwen3-32b': 0,
  'meta-llama/llama-3.1-8b-instruct:free': 0,
  'meta-llama/llama-3.3-70b-instruct:free': 0,
};

function estimateCostUsd(model, inputTokens, outputTokens) {
  const rate = COST_PER_1K_TOKENS[model] ?? 0;
  return ((inputTokens || 0) + (outputTokens || 0)) / 1000 * rate;
}

function logUsage(entry) {
  // Fire-and-forget — usage logging must never slow down or break an AI call.
  // Never includes prompt/response text: CV and JD content is PII.
  AiUsageLog.create(entry).catch(err => logger.warn(`[provider-manager] usage log failed: ${err.message}`));
}

const RETRYABLE = (err) => {
  const type = err.providerErrorType;
  return !type || type === 'transient';
};

async function _callWithFallback(method, tier, prompt, options) {
  const { callSite = 'unknown', ...providerOptions } = options;
  const errors = [];
  const startedAt = Date.now();

  for (const provider of PROVIDERS) {
    const model = MODELS[tier]?.[provider.name] || MODELS.fast[provider.name];
    let attempts = 0;
    try {
      const result = await withRetry(
        () => { attempts++; return provider[method](model, prompt, providerOptions); },
        { maxAttempts: 2, baseDelayMs: 500, maxDelayMs: 5_000, retryOn: RETRYABLE }
      );
      if (errors.length > 0) {
        logger.info(`[provider-manager] fell through to ${provider.name} after ${errors.length} provider(s) failed`);
      }
      logUsage({
        callSite, tier, provider: provider.name, model,
        inputTokens: result.inputTokens || 0,
        outputTokens: result.outputTokens || 0,
        latencyMs: Date.now() - startedAt,
        retries: attempts - 1 + errors.length,
        success: true,
        estimatedCostUsd: estimateCostUsd(model, result.inputTokens, result.outputTokens),
      });
      return result;
    } catch (err) {
      const type = err.providerErrorType || 'transient';
      logger.warn(`[provider-manager] ${provider.name} failed (${type}): ${err.message}`);
      errors.push({ provider: provider.name, type, message: err.message });
      if (type === 'unrecoverable') break;
    }
  }

  const summary = errors.map(e => `${e.provider}:${e.type}`).join(', ');
  logUsage({
    callSite, tier, provider: PROVIDERS[PROVIDERS.length - 1].name,
    model: MODELS[tier]?.[PROVIDERS[PROVIDERS.length - 1].name] || 'unknown',
    latencyMs: Date.now() - startedAt,
    retries: errors.length,
    success: false,
    errorType: errors[errors.length - 1]?.type || 'unknown',
  });
  throw new Error(`All AI providers exhausted — ${summary}`);
}

/**
 * Generate text. Returns { text, inputTokens, outputTokens, provider }
 * @param {string} prompt
 * @param {'fast'|'balanced'|'quality'} [tier='balanced']
 * @param {object} [options]
 * @param {string} [options.callSite] - tag for usage logs, e.g. 'answer-scorer:score'
 */
function generate(prompt, tier = 'balanced', options = {}) {
  return _callWithFallback('generate', tier, prompt, options);
}

/**
 * Generate a response where the model may choose to call one or more tools
 * instead of (or in addition to) answering directly. Returns
 * { toolCalls: [{name, arguments}], text, inputTokens, outputTokens, provider }.
 *
 * This is native function-calling (Groq/OpenRouter's OpenAI-compatible `tools`
 * param) — the model picks which tool(s) to invoke and with what arguments;
 * the caller is responsible for actually executing them.
 *
 * Supports the same exact-match cacheTtlSeconds option as generateJson.
 *
 * @param {string} prompt
 * @param {'fast'|'balanced'|'quality'} [tier='fast']
 * @param {Array<object>} tools - OpenAI-format tool definitions
 * @param {object} [options]
 * @param {string} [options.callSite] - tag for usage logs
 * @param {number} [options.cacheTtlSeconds]
 */
async function generateWithTools(prompt, tier = 'fast', tools, options = {}) {
  const { cacheTtlSeconds, callSite = 'unknown', ...rest } = options;

  if (cacheTtlSeconds) {
    const cached = await responseCache.get(callSite, tier, prompt);
    if (cached) {
      logUsage({
        callSite: `${callSite}:cache-hit`, tier, provider: 'cache', model: 'cache',
        inputTokens: 0, outputTokens: 0, latencyMs: 0, retries: 0, success: true, estimatedCostUsd: 0,
      });
      return cached;
    }
  }

  const result = await _callWithFallback('generateWithTools', tier, prompt, { callSite, tools, ...rest });

  if (cacheTtlSeconds) await responseCache.set(callSite, tier, prompt, result, cacheTtlSeconds);

  return result;
}

async function _generateJsonUncached(prompt, tier, callSite, schema, rest) {
  if (!schema) return _callWithFallback('generateJson', tier, prompt, { callSite, ...rest });

  let issues = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const augmentedPrompt = attempt === 0
      ? prompt
      : `${prompt}\n\nYour previous response was invalid JSON for the required schema: ${issues}\nReturn ONLY a JSON object that matches the schema exactly — no extra fields, no missing fields, no explanation text.`;

    const result = await _callWithFallback('generateJson', tier, augmentedPrompt, { callSite, ...rest });
    const parsed = schema.safeParse(result.data);
    if (parsed.success) return { ...result, data: parsed.data };

    issues = parsed.error.issues.map(i => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    logger.warn(`[provider-manager] schema validation failed for ${callSite} (attempt ${attempt + 1}): ${issues}`);
  }

  throw new Error(`AI response failed schema validation after retry — ${issues}`);
}

/**
 * Generate structured JSON. Returns { data, inputTokens, outputTokens, provider }
 *
 * When options.schema (a zod schema) is passed, the parsed JSON is validated
 * against it. An invalid response triggers one re-prompt with the validation
 * issues appended before giving up — this is what actually enforces "structured
 * output" instead of trusting whatever shape the model felt like returning.
 *
 * When options.cacheTtlSeconds is passed, an exact byte-match on
 * (callSite, tier, prompt) is served from Redis instead of calling the model
 * at all — cache hits are logged to AiUsageLog with provider:'cache' so
 * /api/admin/ai-usage shows the hit rate. Only worth setting on prompts that
 * plausibly repeat across candidates (e.g. "same company, same role" research
 * decisions) — most scoring prompts embed a unique answer and will never hit.
 *
 * @param {string} prompt
 * @param {'fast'|'balanced'|'quality'} [tier='fast']
 * @param {object} [options]
 * @param {string} [options.callSite] - tag for usage logs, e.g. 'answer-scorer:score'
 * @param {import('zod').ZodSchema} [options.schema]
 * @param {number} [options.cacheTtlSeconds]
 */
async function generateJson(prompt, tier = 'fast', options = {}) {
  const { schema, cacheTtlSeconds, callSite = 'unknown', ...rest } = options;

  if (cacheTtlSeconds) {
    const cached = await responseCache.get(callSite, tier, prompt);
    if (cached) {
      logUsage({
        callSite: `${callSite}:cache-hit`, tier, provider: 'cache', model: 'cache',
        inputTokens: 0, outputTokens: 0, latencyMs: 0, retries: 0, success: true, estimatedCostUsd: 0,
      });
      return cached;
    }
  }

  const result = await _generateJsonUncached(prompt, tier, callSite, schema, rest);

  if (cacheTtlSeconds) await responseCache.set(callSite, tier, prompt, result, cacheTtlSeconds);

  return result;
}

const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Generate structured JSON on the fast tier, escalating once to the balanced
 * tier if the model itself reports low confidence. This is the "dynamic model
 * routing" piece — cheap tier by default, better tier only when the fast tier
 * says it's unsure, rather than always paying for the bigger model.
 *
 * The escalated call is tagged '<callSite>:escalated' in usage logs so
 * /api/admin/ai-usage shows how often escalation actually fires.
 *
 * Requires options.schema to include a numeric `confidence` field (0-1).
 *
 * @param {string} prompt
 * @param {object} options
 * @param {import('zod').ZodSchema} options.schema
 * @param {string} [options.callSite]
 * @param {number} [options.confidenceThreshold=0.6]
 */
async function generateJsonWithEscalation(prompt, options = {}) {
  const { confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD, callSite = 'unknown', ...rest } = options;

  const first = await generateJson(prompt, 'fast', { callSite, ...rest });
  if (typeof first.data.confidence !== 'number' || first.data.confidence >= confidenceThreshold) {
    return first;
  }

  logger.info(`[provider-manager] low confidence (${first.data.confidence}) on ${callSite} — escalating fast → balanced`);
  return generateJson(prompt, 'balanced', { callSite: `${callSite}:escalated`, ...rest });
}

/**
 * Transcribe audio using Groq Whisper. Groq-only — OpenRouter has no Whisper endpoint.
 * Returns { text, provider }
 * @param {Buffer} audioBuffer
 * @param {string} mimeType
 */
async function transcribeAudio(audioBuffer, mimeType) {
  try {
    return await groq.transcribeAudio(audioBuffer, mimeType);
  } catch (err) {
    logger.warn(`[provider-manager] transcribeAudio failed: ${err.message}`);
    throw err;
  }
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

module.exports = { generate, generateJson, generateJsonWithEscalation, generateWithTools, transcribeAudio, healthCheck, MODELS };
