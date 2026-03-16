/**
 * Model Router
 *
 * Analyzes message content and selects the most appropriate Ollama model.
 * This keeps specialization at the inference level: even if the manager
 * routes to a general-purpose agent, that agent can still pick the model
 * best suited for the task type.
 *
 * Models are read from env vars so deployment can swap models without
 * code changes. Defaults match the known downloaded models.
 *
 * Priority: first matching rule wins (most specific patterns listed first).
 */

'use strict';

const ROUTING_RULES = [
  {
    // Coding tasks — qwen2.5-coder excels at code generation and debugging
    pattern: /\b(code|function|class|debug|error|bug|stack\s*trace|programming|javascript|python|typescript|sql|api|algorithm|implement|refactor|snippet|script|compile|syntax)\b/i,
    model:  process.env.AGENT_4_MODEL || 'qwen2.5-coder:latest',
    reason: 'coding task',
  },
  {
    // Creative tasks — phi3 is fast and handles open-ended generation well
    pattern: /\b(story|poem|creative|imagine|fiction|narrative|write\s+me|character|novel|screenplay|lyrics|metaphor|brainstorm)\b/i,
    model:  process.env.AGENT_3_MODEL || 'phi3:latest',
    reason: 'creative task',
  },
  {
    // Analytical tasks — mistral handles structured reasoning and comparisons
    pattern: /\b(analyze|analysis|research|compare|comparison|data|statistics|report|summarize|review|evaluate|pros\s+and\s+cons|trade.?off)\b/i,
    model:  process.env.AGENT_2_MODEL || 'mistral:latest',
    reason: 'analytical task',
  },
];

const DEFAULT_MODEL  = process.env.AGENT_1_MODEL  || 'llama3:latest';
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
