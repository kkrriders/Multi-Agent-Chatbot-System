/**
 * LLM Trace Logger
 *
 * Captures structured metadata for every LLM call — model, prompt hash,
 * latency, and token counts — and appends them as JSONL to logs/llm-traces.jsonl.
 *
 * Why prompt *hash* instead of the full prompt?
 *   Prompts can be large and contain PII. Hashing lets us correlate calls
 *   without storing user data in the trace log.
 *
 * Usage:
 *   const { tracedGenerate } = require('./llmTracer');
 *   const meta = await tracedGenerate(generateResponseWithMeta, {
 *     model, prompt, options, agentId
 *   });
 *   // meta = { text, inputTokens, outputTokens, model }
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const TRACE_FILE = path.join(__dirname, '../../logs/llm-traces.jsonl');

/**
 * Deterministic SHA-256 prefix of a prompt — used as a stable identifier
 * without storing the raw text.
 */
function hashPrompt(prompt) {
  return crypto.createHash('sha256').update(String(prompt)).digest('hex').slice(0, 16);
}

/**
 * Append one trace entry to the JSONL log file (fire-and-forget).
 *
 * @param {{ traceId, model, prompt, durationMs, inputTokens, outputTokens, agentId }} entry
 */
function trace(entry) {
  const line = JSON.stringify({
    traceId:    entry.traceId,
    timestamp:  new Date().toISOString(),
    model:      entry.model,
    promptHash: hashPrompt(entry.prompt),
    durationMs: entry.durationMs,
    inputTokens:  entry.inputTokens  ?? 0,
    outputTokens: entry.outputTokens ?? 0,
    agentId:    entry.agentId || 'unknown',
  });

  fs.appendFile(TRACE_FILE, line + '\n', (err) => {
    if (err) console.error('LLM trace write failed:', err.message);
  });
}

/**
 * Wrap a generateResponseWithMeta call with timing and trace logging.
 *
 * @param {Function} generateFn - Must be generateResponseWithMeta (returns { text, inputTokens, outputTokens, model })
 * @param {{ model: string, prompt: string, options?: Object, agentId?: string }} params
 * @returns {Promise<{ text: string, inputTokens: number, outputTokens: number, model: string }>}
 */
async function tracedGenerate(generateFn, { model, prompt, options = {}, agentId } = {}) {
  const traceId = crypto.randomUUID();
  const start   = Date.now();

  const result     = await generateFn(model, prompt, options);
  const durationMs = Date.now() - start;

  trace({
    traceId,
    model:        result.model || model,
    prompt,
    durationMs,
    inputTokens:  result.inputTokens,
    outputTokens: result.outputTokens,
    agentId,
  });

  return result;
}

module.exports = { trace, tracedGenerate };
