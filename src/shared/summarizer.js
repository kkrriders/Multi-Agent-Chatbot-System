'use strict';

const ai = require('../services/ai/provider-manager');
const { logger } = require('./logger');

const SUMMARIZE_THRESHOLD = 10;
const KEEP_RECENT = 6;

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
    const result = await ai.generate(prompt, 'fast', { maxTokens: 300, temperature: 0.3 });
    return result.text;
  } catch (err) {
    logger.warn(`Summarizer failed — falling back to truncated transcript: ${err.message}`);
    return messages.slice(0, 3).map(m => `${m.role || m.from}: ${m.content}`).join(' | ');
  }
}

async function buildPromptContext(history, existingSummary = null) {
  if (!history || history.length <= SUMMARIZE_THRESHOLD) {
    const promptContext = history
      ? history.map(m => `${m.role || m.from}: ${m.content}`).join('\n')
      : '';
    return { promptContext, newSummary: null };
  }

  const olderMessages = history.slice(0, history.length - KEEP_RECENT);
  const recentMessages = history.slice(-KEEP_RECENT);

  const summary = existingSummary || await summarizeConversation(olderMessages);

  const recentTranscript = recentMessages
    .map(m => `${m.role || m.from}: ${m.content}`)
    .join('\n');

  const promptContext =
    `[Conversation summary so far]\n${summary}\n\n` +
    `[Recent messages]\n${recentTranscript}`;

  return { promptContext, newSummary: summary };
}

module.exports = { summarizeConversation, buildPromptContext, SUMMARIZE_THRESHOLD };
