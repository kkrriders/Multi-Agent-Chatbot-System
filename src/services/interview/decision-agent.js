'use strict';

/**
 * Decision agent — runs after every scored answer to decide what happens next.
 *
 * Actions:
 *   next_question  — answer sufficient, advance
 *   follow_up      — too vague or off-topic, ask to elaborate
 *   probe_deeper   — good answer but a key concept was skipped
 *   challenge      — answer has a technical flaw worth pushing back on
 *
 * Only runs for practice and full modes (not timed).
 * Uses balanced tier — 1 Groq call per answer, sequential after scoring.
 */

const ai = require('../ai/provider-manager');
const { assertSafe } = require('../../middleware/injection-guard');
const { logger } = require('../../shared/logger');

const VALID_ACTIONS = new Set(['next_question', 'follow_up', 'probe_deeper', 'challenge']);

const DECISION_PROMPT = ({ questionText, answerText, scores, keywordsMissed, improvementSuggestion }) => `
You are a senior technical interviewer deciding your next move after hearing a candidate's answer.

QUESTION: ${questionText.slice(0, 400)}
SCORES: Relevance=${scores.relevance} Depth=${scores.depth} Clarity=${scores.clarity} Overall=${scores.overall}/100
ANSWER: ${answerText.slice(0, 600)}
${keywordsMissed.length ? `CONCEPTS NOT COVERED: ${keywordsMissed.slice(0, 5).join(', ')}` : ''}
${improvementSuggestion ? `MAIN GAP: ${improvementSuggestion.slice(0, 200)}` : ''}

Choose one action and write a short follow-up if needed:
- "next_question": answer was sufficient (use when overall >= 72 or no clear gap)
- "follow_up": answer was too vague or missed the point entirely
- "probe_deeper": good answer but skipped an important concept worth exploring
- "challenge": answer contained a technical inaccuracy you want to address

Respond with valid JSON only:
{
  "action": "next_question|follow_up|probe_deeper|challenge",
  "reason": "one sentence why",
  "response": "the follow-up question or challenge to show the candidate (empty string if next_question)"
}
`.trim();

/**
 * @param {object} params
 * @param {string} params.questionText
 * @param {string} params.answerText
 * @param {object} params.scores        - { relevance, depth, clarity, overall }
 * @param {string[]} params.keywordsMissed
 * @param {string[]} params.improvementSuggestions
 * @param {string} params.mode          - interview mode ('practice'|'timed'|'full')
 * @returns {Promise<{action, reason, response}>}
 */
async function decide({ questionText, answerText, scores, keywordsMissed, improvementSuggestions, mode }) {
  // Skip for timed mode — strict pacing, no adaptive conversation
  if (mode === 'timed') {
    return { action: 'next_question', reason: 'timed mode', response: '' };
  }

  // Skip for excellent answers — no point interrupting a great response
  if (scores.overall >= 88) {
    return { action: 'next_question', reason: 'excellent answer', response: '' };
  }

  // Injection guard — answerText is user-supplied and going into an AI prompt
  try {
    assertSafe(answerText, 'decision-agent:answerText');
    assertSafe(questionText, 'decision-agent:questionText');
  } catch (injectionErr) {
    logger.warn(`[decision-agent] injection attempt blocked: ${injectionErr.message}`);
    return { action: 'next_question', reason: 'blocked', response: '' };
  }

  const prompt = DECISION_PROMPT({
    questionText,
    answerText,
    scores,
    keywordsMissed: keywordsMissed || [],
    improvementSuggestion: (improvementSuggestions || [])[0] || '',
  });

  let data;
  try {
    const result = await ai.generateJson(prompt, 'balanced');
    data = result.data;
  } catch (err) {
    logger.warn(`[decision-agent] AI call failed, defaulting to next_question: ${err.message}`);
    return { action: 'next_question', reason: 'decision agent unavailable', response: '' };
  }

  const action = VALID_ACTIONS.has(data.action) ? data.action : 'next_question';
  const reason = String(data.reason || '').slice(0, 300);
  const response = action === 'next_question' ? '' : String(data.response || '').slice(0, 500);

  logger.debug(`[decision-agent] action=${action} overall=${scores.overall}`);

  return { action, reason, response };
}

module.exports = { decide };
