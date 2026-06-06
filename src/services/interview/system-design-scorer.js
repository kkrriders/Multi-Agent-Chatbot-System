'use strict';

/**
 * System Design scorer.
 *
 * Evaluates a candidate's submission for a system design question:
 *   - diagramSnapshot: React Flow JSON (nodes + edges)
 *   - textExplanation: verbal/written reasoning
 *   - evaluationRubric: what components/patterns the answer must demonstrate
 *
 * Score dimensions map to:
 *   relevance  → component completeness (are the right pieces present?)
 *   depth      → scalability & trade-offs (did they justify their choices?)
 *   clarity    → structure & communication (is the design coherent?)
 *
 * ONE Groq call. Uses balanced tier — qwen3-32b token limit is too tight for diagrams.
 */

const ai = require('../ai/provider-manager');
const { assertSafe } = require('../../middleware/injection-guard');
const { logger } = require('../../shared/logger');

function _summariseDiagram(diagramJson) {
  try {
    const { nodes = [], edges = [] } = JSON.parse(diagramJson);
    const nodeLabels = nodes
      .map(n => n.data?.label || n.type || 'node')
      .slice(0, 20)
      .join(', ');
    return `Nodes (${nodes.length}): ${nodeLabels} | Edges: ${edges.length}`;
  } catch {
    return 'Diagram could not be parsed';
  }
}

const PROMPT = ({ questionText, diagramSummary, textExplanation, rubric }) => `
You are a senior system design interviewer evaluating a candidate's response.

QUESTION: ${questionText.slice(0, 400)}

EVALUATION RUBRIC (what a complete answer must demonstrate):
${rubric.map((r, i) => `${i + 1}. ${r}`).join('\n')}

CANDIDATE'S DIAGRAM COMPONENTS:
${diagramSummary}

CANDIDATE'S WRITTEN EXPLANATION:
${textExplanation.slice(0, 1500)}

Score each dimension 0-100:
- relevance (component completeness): are the required system components present and correctly connected?
- depth (scalability & trade-offs): did the candidate address scaling, reliability, and justify choices?
- clarity (structure & communication): is the design coherent and well-explained?

Respond with valid JSON only:
{
  "relevance": 0-100,
  "depth": 0-100,
  "clarity": 0-100,
  "componentsMissing": ["component or pattern that was absent"],
  "strengths": ["specific strength 1", "specific strength 2"],
  "improvements": ["specific actionable improvement 1", "specific actionable improvement 2"],
  "evidence": "one sentence justifying the overall assessment"
}
`.trim();

/**
 * @param {object} params
 * @param {string} params.questionText
 * @param {string} params.diagramSnapshot   — React Flow JSON string (may be empty)
 * @param {string} params.textExplanation   — candidate's written explanation
 * @param {string[]} params.evaluationRubric
 * @param {string} params.sessionId
 * @param {string} params.answerId
 * @returns {Promise<{scores, componentsMissing, strengths, improvements, evidence}>}
 */
async function score({ questionText, diagramSnapshot, textExplanation, evaluationRubric, sessionId, answerId }) {
  if (textExplanation) assertSafe(textExplanation, 'system-design:explanation');

  const diagramSummary = diagramSnapshot ? _summariseDiagram(diagramSnapshot) : 'No diagram provided';
  const rubric = Array.isArray(evaluationRubric) && evaluationRubric.length
    ? evaluationRubric
    : ['Identify main components', 'Show data flow', 'Address scalability'];

  let data;
  try {
    const result = await ai.generateJson(
      PROMPT({ questionText, diagramSummary, textExplanation: textExplanation || '', rubric }),
      'balanced'
    );
    data = result.data;
  } catch (err) {
    logger.warn(`[system-design-scorer] AI call failed answer=${answerId}: ${err.message}`);
    throw err;
  }

  if (!data.evidence) {
    throw new Error('System design scorer returned invalid JSON — missing evidence');
  }

  const clamp = v => (typeof v === 'number' ? Math.min(100, Math.max(0, Math.round(v))) : 0);

  const scores = {
    relevance: clamp(data.relevance),
    depth:     clamp(data.depth),
    clarity:   clamp(data.clarity),
    overall:   clamp((data.relevance + data.depth + data.clarity) / 3),
  };

  logger.debug(`[system-design-scorer] answer=${answerId} overall=${scores.overall}`);

  return {
    scores,
    componentsMissing:      Array.isArray(data.componentsMissing) ? data.componentsMissing.slice(0, 5) : [],
    improvementSuggestions: Array.isArray(data.improvements)       ? data.improvements.slice(0, 3)      : [],
    keywordsHit:            [],
    keywordsMissed:         Array.isArray(data.componentsMissing) ? data.componentsMissing.slice(0, 5) : [],
    evidence:               String(data.evidence || '').slice(0, 500),
  };
}

module.exports = { score };
