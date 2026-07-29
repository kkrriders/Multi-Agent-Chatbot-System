'use strict';

/**
 * Answer scorer — Evaluator agent in the scoring pipeline (see scoring-queue.js
 * runPipeline() for the full Evaluator → Interviewer → Judge hand-off).
 * Evaluates a text answer on 3 dimensions in parallel.
 *
 * Dimensions:
 *   relevance (0-100): Does the answer address the question?
 *   depth     (0-100): Does it demonstrate understanding / detail?
 *   clarity   (0-100): Is it well-structured and clearly communicated?
 *
 * Uses the superpowers verification-gate pattern: scores are only accepted
 * when the AI returns valid evidence JSON. No score without evidence.
 */

const ai = require('../ai/provider-manager');
const schemas = require('../ai/schemas');
const broadcaster = require('../sse/broadcaster');
const { assertSafe } = require('../../middleware/injection-guard');

const SCORE_PROMPT = (question, answer, keywords) => `
You are an expert interview evaluator. Score this answer strictly and fairly.

QUESTION: ${question.slice(0, 500)}
${keywords?.length ? `EXPECTED KEYWORDS: ${keywords.join(', ')}` : ''}

ANSWER: ${answer.slice(0, 2000)}

Score each dimension 0-100 with evidence:
- relevance: does the answer address the question directly?
- depth: does it show deep understanding, specific examples, details?
- clarity: is it well-structured, clear, easy to follow?

Respond with valid JSON:
{
  "relevance": 0-100,
  "depth": 0-100,
  "clarity": 0-100,
  "confidence": 0-1 (how sure YOU are in this score — lower if the answer was ambiguous or too short to judge well),
  "keywordsHit": ["keywords the candidate mentioned"],
  "keywordsMissed": ["expected keywords not mentioned"],
  "improvementSuggestions": ["1-2 specific actionable improvements"],
  "evidence": "1 sentence justifying the overall score"
}
`.trim();

/**
 * Score a single answer. Emits SSE updates during scoring.
 *
 * @param {object} params
 * @param {string} params.questionText
 * @param {string[]} params.expectedKeywords
 * @param {string} params.answerText
 * @param {string} params.sessionId - for SSE
 * @param {string} params.answerId  - for SSE correlation
 * @returns {Promise<object>} { scores, improvementSuggestions, keywordsHit, keywordsMissed }
 */
async function score({ questionText, expectedKeywords, answerText, sessionId, answerId }) {
  assertSafe(answerText, 'answer-text');
  broadcaster.emit(sessionId, 'scoring-start', { answerId, timestamp: Date.now() });

  let data;
  try {
    // Starts on the fast model; escalates once to the balanced model if the
    // fast model itself reports low confidence in its own score.
    const result = await ai.generateJsonWithEscalation(
      SCORE_PROMPT(questionText, answerText, expectedKeywords),
      { schema: schemas.answerScore, callSite: 'answer-scorer:score' }
    );
    data = result.data;
  } catch (err) {
    broadcaster.emit(sessionId, 'scoring-error', { answerId, error: 'Scoring failed' });
    throw err;
  }

  const clamp = v => (typeof v === 'number' ? Math.min(100, Math.max(0, Math.round(v))) : 0);

  const scores = {
    relevance: clamp(data.relevance),
    depth:     clamp(data.depth),
    clarity:   clamp(data.clarity),
    overall:   clamp((data.relevance + data.depth + data.clarity) / 3),
  };

  // score-update is emitted by scoring-queue.js AFTER the DB write completes,
  // so a client that refetches immediately does not see stale scored:false data.

  return {
    scores,
    improvementSuggestions: Array.isArray(data.improvementSuggestions)
      ? data.improvementSuggestions.slice(0, 3).map(s => String(s).slice(0, 500))
      : [],
    keywordsHit:   Array.isArray(data.keywordsHit)   ? data.keywordsHit.slice(0, 20)   : [],
    keywordsMissed: Array.isArray(data.keywordsMissed) ? data.keywordsMissed.slice(0, 20) : [],
    evidence: String(data.evidence || '').slice(0, 500),
    confidence: data.confidence,
  };
}

/**
 * Compute an integrity score (0-100) from client-side behavioral signals.
 * Higher = more likely genuine. No AI call — pure arithmetic.
 *
 * Penalties:
 *   paste ratio   → up to -60  (pasting the whole answer is the strongest signal)
 *   tab switches  → up to -30  (tab hidden — switched away or minimized)
 *   focus loss    → up to -15  (window lost focus but tab stayed visible — the
 *                                multi-monitor case. Weighted lower than tab
 *                                switches: this also fires for a URL-bar click
 *                                or an OS notification, not just window-switching,
 *                                so it's a noisier signal.)
 *   speed         → up to -20  (polished long answer submitted suspiciously fast)
 */
function computeIntegrity(signals, answerLength, timeSpentSeconds) {
  if (!signals) return { integrityScore: 100, integrityFlag: 'CLEAN' };

  const {
    pastedChars      = 0,
    tabSwitchCount   = 0,
    focusLossCount   = 0,
  } = signals;

  const len     = Math.max(answerLength || 0, 1);
  const elapsed = timeSpentSeconds || 0;

  const pasteRatio   = Math.min(pastedChars / len, 1);
  const pastePenalty = Math.round(pasteRatio * 60);
  const tabPenalty   = Math.min(tabSwitchCount * 15, 30);
  const focusPenalty = Math.min(focusLossCount * 8, 15);

  let speedPenalty = 0;
  if      (elapsed < 15 && len > 150) speedPenalty = 20;
  else if (elapsed < 30 && len > 300) speedPenalty = 10;

  const integrityScore = Math.min(100, Math.max(0, 100 - pastePenalty - tabPenalty - focusPenalty - speedPenalty));
  const integrityFlag  = integrityScore >= 70 ? 'CLEAN'
    : integrityScore >= 40 ? 'SUSPICIOUS'
    : 'LIKELY_AI';

  return { integrityScore, integrityFlag };
}

/**
 * Discount `overall` proportionally to the integrity score — a candidate's
 * demonstrated content quality (relevance/depth/clarity, untouched) is one
 * thing; whether the practice rep is genuine is another. At integrityScore
 * 100 this is a no-op (rawOverall === overall). At integrityScore 25, overall
 * is cut to 25% of what content quality alone would have earned.
 *
 * Pure arithmetic — no AI call.
 */
function applyIntegrityPenalty(scores, integrityScore) {
  const safeScore = typeof integrityScore === 'number' ? Math.min(100, Math.max(0, integrityScore)) : 100;
  return {
    ...scores,
    rawOverall: scores.overall,
    overall: Math.round(scores.overall * (safeScore / 100)),
  };
}

/**
 * Aggregate scores from all answers in a session into category breakdowns.
 * @param {object[]} answers - Answer documents with scores and questionId populated
 * @param {object[]} questions - Question documents indexed by _id
 * @returns {object} categoryScores + overallScore
 */
function aggregate(answers, questions) {
  const byCategory = {};

  for (const answer of answers) {
    if (!answer.scored) continue;
    const q = questions.find(q => q._id.toString() === answer.questionId.toString());
    const cat = q?.category || 'technical';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(answer.scores.overall || 0);
  }

  const categoryScores = {};
  let totalSum = 0;
  let totalCount = 0;

  for (const [cat, scores] of Object.entries(byCategory)) {
    const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    categoryScores[cat] = { overall: avg };
    totalSum += scores.reduce((s, v) => s + v, 0);
    totalCount += scores.length;
  }

  return {
    categoryScores,
    overallScore: totalCount > 0 ? Math.round(totalSum / totalCount) : 0,
  };
}

module.exports = { score, aggregate, computeIntegrity, applyIntegrityPenalty };
