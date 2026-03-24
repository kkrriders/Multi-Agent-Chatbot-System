/**
 * Model Router
 *
 * Analyzes message content and selects the most appropriate Groq model.
 * Each model has its own independent rate limit on Groq, so routing different
 * query types to different models effectively multiplies total capacity.
 *
 * Models are read from env vars so deployment can swap models without
 * code changes. Defaults are the recommended Groq free-tier models.
 *
 * Priority: first matching rule wins (most specific patterns listed first).
 */

'use strict';

const ROUTING_RULES = [
  {
    // Coding tasks — llama3-70b has the strongest code generation on Groq free tier
    pattern: /\b(code|function|class|debug|error|bug|stack\s*trace|programming|javascript|python|typescript|sql|api|algorithm|implement|refactor|snippet|script|compile|syntax)\b/i,
    model:  process.env.AGENT_4_MODEL || 'llama3-70b-8192',
    reason: 'coding task',
  },
  {
    // Creative tasks — gemma2-9b handles open-ended generation well
    pattern: /\b(story|poem|creative|imagine|fiction|narrative|write\s+me|character|novel|screenplay|lyrics|metaphor|brainstorm)\b/i,
    model:  process.env.AGENT_3_MODEL || 'gemma2-9b-it',
    reason: 'creative task',
  },
  {
    // Analytical tasks — mixtral has a 32k context window, strong at reasoning
    pattern: /\b(analyze|analysis|research|compare|comparison|data|statistics|report|summarize|review|evaluate|pros\s+and\s+cons|trade.?off)\b/i,
    model:  process.env.AGENT_2_MODEL || 'mixtral-8x7b-32768',
    reason: 'analytical task',
  },
];

const DEFAULT_MODEL  = process.env.AGENT_1_MODEL  || 'llama3-8b-8192';
const DEFAULT_REASON = 'general task';

/**
 * Return the best model for a given message.
 *
 * @param {string|{ content: string }} message
 * @returns {{ model: string, reason: string }}
 */
function routeModel(message) {
  const text = typeof message === 'string' ? message : (message?.content || '');

  for (const rule of ROUTING_RULES) {
    if (rule.pattern.test(text)) {
      return { model: rule.model, reason: rule.reason };
    }
  }

  return { model: DEFAULT_MODEL, reason: DEFAULT_REASON };
}

module.exports = { routeModel, ROUTING_RULES, DEFAULT_MODEL };
