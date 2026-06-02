'use strict';

/**
 * Session feedback — generates multi-perspective end-of-session feedback
 * for panel interview mode.
 *
 * ONE AI call returns feedback from all 3 personas simultaneously.
 * Uses balanced tier to avoid burning qwen3-32b tokens/min limit.
 *
 * Architecture rule: single call, no Promise.all, never called per-answer.
 */

const ai = require('../ai/provider-manager');
const { logger } = require('../../shared/logger');

const FEEDBACK_PROMPT = (targetRole, answerSummaries) => `
You conducted a panel interview for a ${targetRole} candidate. Here are the answers and scores:

${answerSummaries}

Provide end-of-session feedback from three perspectives. Be specific and constructive.

Respond with valid JSON only:
{
  "alex": {
    "score": 0-100,
    "strengths": ["specific strength 1", "specific strength 2"],
    "gaps": ["specific gap 1"],
    "summary": "2-sentence technical assessment"
  },
  "priya": {
    "score": 0-100,
    "strengths": ["specific strength"],
    "gaps": ["specific gap"],
    "summary": "2-sentence behavioral assessment"
  },
  "james": {
    "score": 0-100,
    "strengths": ["specific strength"],
    "gaps": ["specific gap"],
    "summary": "2-sentence critical assessment"
  }
}
`.trim();

function buildSummaries(answers, questions) {
  return answers
    .filter(a => a.scored)
    .slice(0, 10)
    .map(a => {
      const q = questions.find(q => q._id.toString() === a.questionId.toString());
      const interviewer = q?.interviewerName || 'Panel';
      return `[${interviewer}] Q: ${(q?.text || 'Question').slice(0, 150)} | Score: ${a.scores.overall}/100 | Category: ${q?.category || 'general'}`;
    })
    .join('\n');
}

function defaultFeedback() {
  const empty = { score: 0, strengths: [], gaps: ['Assessment unavailable'], summary: 'Feedback could not be generated.' };
  return { alex: { ...empty }, priya: { ...empty }, james: { ...empty } };
}

function clamp(n) {
  return typeof n === 'number' ? Math.min(100, Math.max(0, Math.round(n))) : 0;
}

function sanitizePersona(raw) {
  return {
    score:     clamp(raw?.score),
    strengths: Array.isArray(raw?.strengths) ? raw.strengths.slice(0, 3).map(s => String(s).slice(0, 200)) : [],
    gaps:      Array.isArray(raw?.gaps)      ? raw.gaps.slice(0, 3).map(s => String(s).slice(0, 200))      : [],
    summary:   String(raw?.summary || '').slice(0, 400),
  };
}

/**
 * @param {object} params
 * @param {string} params.targetRole
 * @param {object[]} params.answers   — scored Answer documents
 * @param {object[]} params.questions — Question documents
 * @returns {Promise<{alex, priya, james}>}
 */
async function generate({ targetRole, answers, questions }) {
  const summaries = buildSummaries(answers, questions);
  if (!summaries) {
    logger.warn('[session-feedback] no scored answers available');
    return defaultFeedback();
  }

  try {
    const { data } = await ai.generateJson(
      FEEDBACK_PROMPT(targetRole || 'the candidate', summaries),
      'balanced'
    );

    return {
      alex:  sanitizePersona(data.alex),
      priya: sanitizePersona(data.priya),
      james: sanitizePersona(data.james),
    };
  } catch (err) {
    logger.warn(`[session-feedback] AI call failed: ${err.message}`);
    return defaultFeedback();
  }
}

module.exports = { generate };
