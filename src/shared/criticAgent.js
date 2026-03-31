/**
 * Critic Agent
 *
 * A lightweight quality-control pass that evaluates a draft answer before it
 * is returned to the user.
 *
 * Checks:
 *   - Completeness  — did the answer address all parts of the question?
 *   - Correctness   — are there obvious factual errors or contradictions?
 *   - Clarity       — is the answer coherent and free of obvious hallucinations?
 *
 * Pipeline:
 *   draft → critique() → { approved, issues, revisedDraft }
 *
 * If the draft is approved it is returned as-is (zero extra latency beyond
 * the critique call itself). If issues are found, one revision pass is made
 * using the issues as guidance. A second revision is never attempted — the
 * system prefers fast + good over slow + perfect.
 *
 * Model choice: llama3-8b-8192 (fastest Groq model) keeps the added latency
 * under ~800 ms in the happy path.
 */

'use strict';

const { generateResponseJson, generateResponse } = require('./ollama');
const { logger } = require('./logger');

const CRITIC_MODEL   = process.env.AGENT_1_MODEL || 'llama3-8b-8192';   // fast
const REVISION_MODEL = process.env.AGENT_4_MODEL || 'llama3-70b-8192';  // strong

// ── Critique ─────────────────────────────────────────────────────────────────

/**
 * Evaluate a draft answer against the original question.
 *
 * @param {string} draft            — the answer to evaluate
 * @param {string} originalQuestion — the user's question
 * @returns {Promise<{ approved: boolean, issues: string[], score: number }>}
 *   approved — true if no critical issues found
 *   issues   — array of issue descriptions (empty when approved)
 *   score    — 0-10 quality score assigned by the critic
 */
async function critique(draft, originalQuestion) {
  if (!draft || !draft.trim()) {
    return { approved: false, issues: ['Draft is empty'], score: 0 };
  }

  const prompt =
    `You are a strict quality-control reviewer for an AI assistant.\n\n` +
    `Original question: "${originalQuestion.slice(0, 500).replace(/"/g, "'")}"\n\n` +
    `Draft answer:\n---\n${draft.slice(0, 1500)}\n---\n\n` +
    `Evaluate the draft on three dimensions:\n` +
    `1. COMPLETENESS — does it answer every part of the question? (missing parts = issue)\n` +
    `2. CORRECTNESS  — are there obvious factual errors or contradictions? (flag them)\n` +
    `3. CLARITY      — is it coherent? Does it contain obvious hallucinations or nonsense?\n\n` +
    `Respond ONLY with valid JSON:\n` +
    `{\n` +
    `  "approved": true|false,\n` +
    `  "score": 0-10,\n` +
    `  "issues": ["issue 1", "issue 2"]\n` +
    `}\n` +
    `"approved" must be true when score >= 7 and there are no CRITICAL issues.\n` +
    `"issues" must be an empty array when approved is true.\n` +
    `Be strict but fair. Minor style issues do not warrant disapproval.`;

  try {
    const result = await generateResponseJson(CRITIC_MODEL, prompt, { temperature: 0.1, num_predict: 300 });

    const approved = result.approved === true;
    const issues   = Array.isArray(result.issues) ? result.issues.map(String) : [];
    const score    = Math.min(10, Math.max(0, Number(result.score) || (approved ? 8 : 4)));

    logger.info(`[CriticAgent] score=${score}/10 approved=${approved}` +
      (issues.length ? ` issues: ${issues.slice(0, 2).join('; ')}` : ''));

    return { approved, issues, score };
  } catch (err) {
    // If the critic itself fails, approve the draft rather than blocking the response
    logger.warn(`[CriticAgent] critique LLM failed (${err.message}) — auto-approving`);
    return { approved: true, issues: [], score: 7 };
  }
}

// ── Revision ──────────────────────────────────────────────────────────────────

/**
 * Revise a draft based on issues identified by the critic.
 *
 * @param {string}   draft
 * @param {string}   originalQuestion
 * @param {string[]} issues
 * @returns {Promise<string>}
 */
async function revise(draft, originalQuestion, issues) {
  const issueList = issues.map((iss, i) => `${i + 1}. ${iss}`).join('\n');

  const prompt =
    `You are an expert editor. Improve the draft answer below by fixing the listed issues.\n\n` +
    `Original question: "${originalQuestion.slice(0, 500).replace(/"/g, "'")}"\n\n` +
    `Issues to fix:\n${issueList}\n\n` +
    `Original draft:\n---\n${draft.slice(0, 1500)}\n---\n\n` +
    `Rules:\n` +
    `- Fix every listed issue.\n` +
    `- Do NOT introduce new content that isn't supported by the draft.\n` +
    `- Keep the format and citations from the original draft.\n` +
    `- Return only the revised answer, no preamble.`;

  try {
    return await generateResponse(REVISION_MODEL, prompt, { temperature: 0.3, num_predict: 1000 });
  } catch (err) {
    logger.warn(`[CriticAgent] revision LLM failed (${err.message}) — returning original draft`);
    return draft;
  }
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Run the full critic pass: evaluate the draft and optionally revise it.
 *
 * At most one revision is performed to keep latency bounded.
 *
 * @param {string} draft            — synthesized answer to evaluate
 * @param {string} originalQuestion — user's original question
 * @returns {Promise<{
 *   finalAnswer:  string,
 *   approved:     boolean,
 *   revised:      boolean,
 *   score:        number,
 *   issues:       string[],
 * }>}
 */
async function criticPass(draft, originalQuestion) {
  const evaluation = await critique(draft, originalQuestion);

  if (evaluation.approved) {
    return {
      finalAnswer:  draft,
      approved:     true,
      revised:      false,
      score:        evaluation.score,
      issues:       [],
    };
  }

  logger.info(`[CriticAgent] Revising draft — ${evaluation.issues.length} issue(s) found`);
  const revisedDraft = await revise(draft, originalQuestion, evaluation.issues);

  return {
    finalAnswer:  revisedDraft,
    approved:     false,
    revised:      true,
    score:        evaluation.score,
    issues:       evaluation.issues,
  };
}

module.exports = { criticPass, critique, revise };
