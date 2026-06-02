'use strict';

/**
 * Panel interview — 3 AI personas ask questions in turns.
 *
 * One AI call generates all questions for all personas.
 * Questions are pre-interleaved: Alex → Priya → James → Alex → ...
 *
 * Personas:
 *   Alex  — Senior Engineer (technical depth, system design)
 *   Priya — Hiring Manager  (behavioral, situational, culture fit)
 *   James — Bar Raiser      (critical thinking, edge cases, values)
 *
 * Architecture rule: ONE Groq call total. No parallel calls.
 */

const ai = require('../ai/provider-manager');
const Question = require('../../models/Question');
const { assertSafe } = require('../../middleware/injection-guard');
const { logger } = require('../../shared/logger');

const PERSONAS = {
  Alex:  { role: 'Senior Engineer',  focus: 'deep technical knowledge, system design, architecture trade-offs' },
  Priya: { role: 'Hiring Manager',   focus: 'behavioral competencies, past experience, situational judgment, communication style' },
  James: { role: 'Bar Raiser',       focus: 'critical thinking, edge cases, values alignment, unconventional challenges' },
};

const PANEL_PROMPT = (targetRole, skills, jdSnippet) => `
You are generating a panel interview question set for a ${targetRole} candidate.

Three interviewers will take turns:
- Alex (Senior Engineer): asks ${PERSONAS.Alex.focus}
- Priya (Hiring Manager): asks ${PERSONAS.Priya.focus}
- James (Bar Raiser): asks ${PERSONAS.James.focus}

Candidate skills: ${skills.slice(0, 15).join(', ')}
${jdSnippet ? `Role context:\n${jdSnippet.slice(0, 1200)}` : ''}

Generate exactly 12 questions interleaved in this order:
Alex(1), Priya(1), James(1), Alex(2), Priya(2), James(2), Alex(3), Priya(3), James(3), Alex(4), Priya(4), Alex(5)

That is 5 from Alex (technical), 4 from Priya (behavioral), 3 from James (challenging).

Respond with valid JSON only:
{
  "questions": [
    {
      "interviewer": "Alex|Priya|James",
      "text": "question text",
      "category": "technical|behavioral|situational|closing",
      "difficulty": "easy|medium|hard",
      "expectedKeywords": ["keyword1", "keyword2"]
    }
  ]
}
`.trim();

/**
 * Generate panel questions in a single AI call.
 * Falls back to regular question bank if AI fails.
 */
async function generate({ targetRole, skills, jobDescription, interviewId }) {
  if (jobDescription) assertSafe(jobDescription, 'panel:jobDescription');

  try {
    const { data } = await ai.generateJson(
      PANEL_PROMPT(targetRole || 'Software Engineer', skills || [], jobDescription),
      'balanced'
    );

    const raw = Array.isArray(data.questions) ? data.questions.slice(0, 12) : [];

    const saved = await Question.insertMany(
      raw.map(q => ({
        text:             String(q.text || '').slice(0, 2000),
        category:         ['technical', 'behavioral', 'situational', 'closing', 'intro'].includes(q.category)
                            ? q.category : 'technical',
        role:             targetRole || 'General',
        difficulty:       ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
        expectedKeywords: Array.isArray(q.expectedKeywords) ? q.expectedKeywords.slice(0, 20) : [],
        interviewerName:  ['Alex', 'Priya', 'James'].includes(q.interviewer) ? q.interviewer : 'Alex',
        source:           'jd-generated',
        interviewId:      interviewId || undefined,
      }))
    );

    logger.info(`[panel] generated ${saved.length} questions for interview ${interviewId}`);
    return saved;

  } catch (err) {
    logger.warn(`[panel] AI generation failed, falling back to question bank: ${err.message}`);
    return _bankFallback(targetRole, interviewId);
  }
}

async function _bankFallback(targetRole, interviewId) {
  const [tech, behav, closing] = await Promise.all([
    Question.find({ category: 'technical', active: true }).limit(5).lean(),
    Question.find({ category: { $in: ['behavioral', 'situational'] }, active: true }).limit(4).lean(),
    Question.find({ category: 'closing', active: true }).limit(3).lean(),
  ]);

  const withPersona = (questions, name) =>
    questions.map(q => ({ ...q, interviewerName: name }));

  const result = interleave(
    withPersona(tech, 'Alex'),
    withPersona(behav, 'Priya'),
    withPersona(closing, 'James')
  );

  // Persist interviewerName so session-feedback and later queries see it
  await Promise.all(
    result.map(q => Question.findByIdAndUpdate(q._id, { interviewerName: q.interviewerName }))
  ).catch(() => {}); // non-critical, don't block

  return result;
}

function interleave(alex, priya, james) {
  const result = [];
  const max = Math.max(alex.length, priya.length, james.length);
  for (let i = 0; i < max; i++) {
    if (alex[i])  result.push(alex[i]);
    if (priya[i]) result.push(priya[i]);
    if (james[i]) result.push(james[i]);
  }
  return result;
}

module.exports = { generate, PERSONAS };
