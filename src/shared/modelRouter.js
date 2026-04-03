/**
 * Model Router
 *
 * Two routing modes:
 *
 * routeModel(message)       — synchronous, keyword-regex only.
 *                             Kept for backward compatibility with BaseAgent
 *                             which calls it during JSON-mode generation.
 *
 * routeModelAsync(message)  — async, uses the three-tier IntentClassifier
 *                             (LLM → TF-IDF → keyword). Use this for all new
 *                             code paths where an await is acceptable.
 *
 * Each Groq model has its own independent rate limit, so routing different
 * query types to different models effectively multiplies total capacity.
 */

'use strict';

const { classifyIntent, keywordClassify } = require('./intentClassifier');
const { logger } = require('./logger');

// Model constants (read from env so deployment can swap without code changes)
const MODELS = {
  'agent-1': process.env.AGENT_1_MODEL || 'llama-3.1-8b-instant',
  'agent-2': process.env.AGENT_2_MODEL || 'qwen/qwen3-32b',
  'agent-3': process.env.AGENT_3_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
  'agent-4': process.env.AGENT_4_MODEL || 'llama-3.3-70b-versatile',
};

// Kept for callers that import ROUTING_RULES directly
const ROUTING_RULES = [
  {
    pattern: /\b(code|function|class|debug|error|bug|stack\s*trace|programming|javascript|python|typescript|sql|api|algorithm|implement|refactor|snippet|script|compile|syntax)\b/i,
    model:   MODELS['agent-4'],
    reason:  'coding task',
  },
  {
    pattern: /\b(story|poem|creative|imagine|fiction|narrative|write\s+me|character|novel|screenplay|lyrics|metaphor|brainstorm)\b/i,
    model:   MODELS['agent-3'],
    reason:  'creative task',
  },
  {
    pattern: /\b(analyze|analysis|research|compare|comparison|data|statistics|report|summarize|review|evaluate|pros\s+and\s+cons|trade.?off)\b/i,
    model:   MODELS['agent-2'],
    reason:  'analytical task',
  },
];

const DEFAULT_MODEL  = MODELS['agent-1'];
const DEFAULT_REASON = 'general task';

/**
 * Synchronous keyword-regex route — zero latency, no network call.
 * Used by BaseAgent.generateAgentResponse() which needs an immediate result.
 *
 * @param {string|{ content: string }} message
 * @returns {{ model: string, reason: string }}
 */
function routeModel(message) {
  const text = typeof message === 'string' ? message : (message?.content || '');
  for (const rule of ROUTING_RULES) {
    if (rule.pattern.test(text)) return { model: rule.model, reason: rule.reason };
  }
  return { model: DEFAULT_MODEL, reason: DEFAULT_REASON };
}

/**
 * Async intelligent route — LLM classification backed by TF-IDF and keyword
 * fallbacks. Returns full classification metadata alongside model and agentId.
 * Use this for the /plan-and-execute and /message endpoints.
 *
 * @param {string|{ content: string }} message
 * @returns {Promise<{ model: string, agentId: string, reason: string, confidence: number, method: string, secondCandidate }>}
 */
async function routeModelAsync(message) {
  const text = typeof message === 'string' ? message : (message?.content || '');
  const classification = await classifyIntent(text);
  // Guard NaN (can occur when TF-IDF produces zero-vector for non-ASCII input)
  const confidence = Number.isFinite(classification.confidence) ? classification.confidence : 0.5;
  logger.debug(`[ModelRouter] async → ${classification.agentId} via ${classification.method} (conf=${confidence.toFixed(2)})`);
  return {
    model:           classification.model,
    agentId:         classification.agentId,
    reason:          classification.reason,
    confidence,
    method:          classification.method,
    secondCandidate: classification.secondCandidate || null,
  };
}

// Confidence threshold below which a second agent is consulted
const LOW_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Route with automatic fallback when confidence is low.
 *
 * Returns the primary route plus a `fallback` field indicating whether a
 * second agent should be consulted. The caller decides how to use it — either
 * run both agents and pick the better response, or surface the uncertainty.
 *
 * @param {string|{ content: string }} message
 * @returns {Promise<{
 *   primary:   { agentId, model, confidence, method, reason },
 *   secondary: { agentId, model, confidence } | null,
 *   isLowConfidence: boolean
 * }>}
 */
async function routeModelWithFallback(message) {
  const route = await routeModelAsync(message);
  const isLowConfidence = route.confidence < LOW_CONFIDENCE_THRESHOLD;

  if (isLowConfidence) {
    logger.info(
      `[ModelRouter] low confidence (${route.confidence.toFixed(2)}) for "${
        (typeof message === 'string' ? message : message?.content || '').slice(0, 60)
      }…" — will consult secondary agent ${route.secondCandidate?.agentId || 'agent-1'}`
    );
  }

  return {
    primary: {
      agentId:    route.agentId,
      model:      route.model,
      confidence: route.confidence,
      method:     route.method,
      reason:     route.reason,
    },
    secondary:       isLowConfidence ? (route.secondCandidate || { agentId: 'agent-1', model: MODELS['agent-1'], confidence: 0 }) : null,
    isLowConfidence,
  };
}

module.exports = { routeModel, routeModelAsync, routeModelWithFallback, ROUTING_RULES, DEFAULT_MODEL, LOW_CONFIDENCE_THRESHOLD };
