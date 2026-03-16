/**
 * Conversation Summarizer
 *
 * Problem: createPrompt() in agent-base.js concatenates all recent context
 * into the prompt. A 30-message conversation silently exceeds Ollama's context
 * window and gets truncated — the model then hallucinates from partial context.
 * The Conversation schema has a `summary` field that was never populated.
 *
 * Solution: when history exceeds SUMMARIZE_THRESHOLD, condense the older turns
 * into a tight summary and inject it instead of the raw transcript. The summary
 * is persisted to MongoDB so future sessions can start with context.
 *
 * This is intentionally not called on every message — only when the threshold
 * is crossed, and only for the older portion of history.
 */

'use strict';

const { generateResponse } = require('./ollama');
const { logger } = require('./logger');

// Summarise when the full history exceeds this many messages
const SUMMARIZE_THRESHOLD = 10;
// Keep this many recent messages verbatim after summarising the rest
const KEEP_RECENT = 6;
// Small, fast model for summarisation — phi3 is 2.2 GB
const SUMMARIZER_MODEL = process.env.SUMMARIZER_MODEL || process.env.AGENT_3_MODEL || 'phi3:latest';

/**
 * Summarise an array of conversation messages into a compact paragraph.
 *
 * @param {Array<{from: string, content: string}>} messages
 * @returns {Promise<string>} - 3–5 sentence summary
 */
async function summarizeConversation(messages) {
  if (!messages || messages.length === 0) return '';

  const transcript = messages
    .map(m => `${m.role || m.from || 'user'}: ${m.content}`)
    .join('\n');

  const prompt =
    `Summarise the following conversation in 3 to 5 sentences. ` +
    `Preserve all key facts, decisions, and technical details. ` +
    `Write in third person past tense.\n\n${transcript}`;

  try {
    const summary = await generateResponse(SUMMARIZER_MODEL, prompt, {
      temperature: 0.3,
      num_predict: 300,
    });
    return summary;
  } catch (err) {
    logger.warn(`Summarizer failed — falling back to truncated transcript: ${err.message}`);
    // Safe fallback: return a truncated version of the oldest messages
    return messages.slice(0, 3).map(m => `${m.role || m.from}: ${m.content}`).join(' | ');
  }
}

/**
 * Condense history for prompt injection.
 *
 * Returns a prompt-ready string:
 *  - If history is short enough, returns the raw turns joined as text.
 *  - If history is long, summarises old turns and appends the most recent ones verbatim.
 *
 * @param {Array<{from: string, content: string}>} history  - Full conversation history
 * @param {string|null} existingSummary                     - Cached summary from MongoDB
 * @returns {Promise<{ promptContext: string, newSummary: string|null }>}
 *   promptContext  — inject this into the system/user prompt
 *   newSummary     — persist this to MongoDB if it differs from existingSummary
 */
async function buildPromptContext(history, existingSummary = null) {
  if (!history || history.length <= SUMMARIZE_THRESHOLD) {
    const promptContext = history
      ? history.map(m => `${m.role || m.from}: ${m.content}`).join('\n')
      : '';
    return { promptContext, newSummary: null };
  }

  const olderMessages = history.slice(0, history.length - KEEP_RECENT);
  const recentMessages = history.slice(-KEEP_RECENT);

  // Reuse existing summary when available to avoid redundant LLM calls
  let summary = existingSummary;
  if (!summary) {
    summary = await summarizeConversation(olderMessages);
  }

  const recentTranscript = recentMessages
    .map(m => `${m.role || m.from}: ${m.content}`)
    .join('\n');

  const promptContext =
    `[Conversation summary so far]\n${summary}\n\n` +
    `[Recent messages]\n${recentTranscript}`;

  return { promptContext, newSummary: summary };
}

module.exports = { summarizeConversation, buildPromptContext, SUMMARIZE_THRESHOLD };
