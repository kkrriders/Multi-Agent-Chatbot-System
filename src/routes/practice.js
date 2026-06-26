'use strict';

/**
 * Practice evaluation routes.
 *
 * POST /api/practice/evaluate — AI evaluation for coding and system design answers
 */

const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const { messageLimiter } = require('../middleware/rateLimiter');
const Question = require('../models/Question');
const ai = require('../services/ai/provider-manager');
const { logger } = require('../shared/logger');

// POST /api/practice/evaluate
router.post('/evaluate', authenticate, messageLimiter, async (req, res) => {
  try {
    const { type, questionId, code, language, nodes, edges } = req.body;

    if (!['coding', 'system_design'].includes(type)) {
      return res.status(400).json({ success: false, error: 'type must be "coding" or "system_design"' });
    }
    if (!questionId || !/^[a-f0-9]{24}$/i.test(questionId)) {
      return res.status(400).json({ success: false, error: 'Invalid questionId' });
    }

    const question = await Question.findById(questionId).lean();
    if (!question) {
      return res.status(404).json({ success: false, error: 'Question not found' });
    }

    let result;
    if (type === 'coding') {
      result = await evaluateCoding({ question, code, language });
    } else {
      result = await evaluateSystemDesign({ question, nodes, edges });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    logger.error(`[practice/evaluate] ${err.message}`);
    res.status(500).json({ success: false, error: 'Evaluation failed. Please try again.' });
  }
});

async function evaluateCoding({ question, code, language }) {
  if (!code || typeof code !== 'string' || code.trim().length < 5) {
    throw Object.assign(new Error('No code submitted'), { status: 400 });
  }

  const keywords = (question.expectedKeywords || []).join(', ') || 'not specified';
  const constraints = question.constraints || 'none';

  const prompt = `You are a coding interview evaluator. Evaluate the candidate's solution strictly and fairly.

Problem: ${question.text}
Constraints: ${constraints}
Expected approach (keywords): ${keywords}

Candidate's solution (${language || 'JavaScript'}):
\`\`\`
${code.slice(0, 3000)}
\`\`\`

Respond ONLY with a valid JSON object — no explanation outside it:
{
  "score": <integer 0-100>,
  "verdict": "<correct|partial|incorrect>",
  "feedback": "<2-3 sentence overall assessment>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "issues": ["<issue or improvement 1>", "<issue or improvement 2>"],
  "approachUsed": "<one sentence describing the approach used>"
}

Score guide: 90-100 = correct and optimal, 70-89 = correct but suboptimal complexity, 50-69 = partially correct, 0-49 = incorrect or incomplete.`;

  const { data } = await ai.generateJson(prompt, 'fast');
  return {
    score: Number(data.score) || 0,
    verdict: data.verdict || 'incorrect',
    feedback: data.feedback || '',
    strengths: Array.isArray(data.strengths) ? data.strengths : [],
    issues: Array.isArray(data.issues) ? data.issues : [],
    approachUsed: data.approachUsed || '',
  };
}

async function evaluateSystemDesign({ question, nodes, edges }) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    throw Object.assign(new Error('No diagram components to evaluate'), { status: 400 });
  }

  const rubric = (question.evaluationRubric || []);
  if (rubric.length === 0) {
    throw Object.assign(new Error('This question has no evaluation rubric'), { status: 400 });
  }

  const componentList = nodes
    .map(n => n?.data?.label || n?.label || '?')
    .filter(Boolean)
    .join(', ');

  const connectionList = (edges || [])
    .map(e => {
      const src = nodes.find(n => n.id === e.source)?.data?.label || e.source;
      const tgt = nodes.find(n => n.id === e.target)?.data?.label || e.target;
      return e.label ? `${src} → ${tgt} (${e.label})` : `${src} → ${tgt}`;
    })
    .join('; ') || 'none';

  const rubricList = rubric.map((r, i) => `${i + 1}. ${r}`).join('\n');

  const prompt = `You are a system design interview evaluator. Evaluate the candidate's diagram against the rubric.

Question: ${question.text}

Evaluation rubric (what a complete answer must cover):
${rubricList}

Candidate's design (extracted from their diagram):
Components: ${componentList}
Connections: ${connectionList}

For each rubric item decide: "covered" (clearly present), "partial" (implied or incomplete), or "missing" (not addressed).
Score 0-100 based on coverage: each item is worth ${Math.floor(100 / rubric.length)} points, partial = half.

Respond ONLY with a valid JSON object — no explanation outside it:
{
  "score": <integer 0-100>,
  "rubricResults": [
    { "item": "<rubric item text>", "status": "<covered|partial|missing>", "note": "<one sentence>" }
  ],
  "feedback": "<2-3 sentence overall assessment>",
  "topMissing": ["<most important missing component 1>", "<most important missing component 2>"]
}`;

  const { data } = await ai.generateJson(prompt, 'balanced');
  return {
    score: Number(data.score) || 0,
    rubricResults: Array.isArray(data.rubricResults) ? data.rubricResults : [],
    feedback: data.feedback || '',
    topMissing: Array.isArray(data.topMissing) ? data.topMissing : [],
  };
}

module.exports = router;
