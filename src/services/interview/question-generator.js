'use strict';

/**
 * Question generator — produces role-specific interview questions
 * from a candidate profile + optional job description.
 *
 * For a full mock interview the distribution is:
 *   intro (1) → technical (4-6) → behavioral (3-4) → situational (2-3) → closing (1)
 */

const ai = require('../ai/provider-manager');
const Question = require('../../models/Question');
const { assertSafe } = require('../../middleware/injection-guard');

const CATEGORY_COUNTS = {
  practice: { technical: 5, behavioral: 3, situational: 2, intro: 0, closing: 0 },
  timed:    { technical: 5, behavioral: 3, situational: 2, intro: 0, closing: 0 },
  full:     { intro: 1, technical: 5, behavioral: 4, situational: 3, closing: 1 },
};

const GEN_PROMPT = (role, category, count, skills, jdSnippet) => `
You are an expert interviewer. Generate exactly ${count} ${category} interview questions for a ${role} candidate.

Candidate skills: ${skills.slice(0, 20).join(', ')}
${jdSnippet ? `Job description excerpt:\n${jdSnippet.slice(0, 1500)}` : ''}

Requirements:
- Questions must be specific to the role and the candidate's background
- Mix of easy, medium, and hard difficulty
- For technical: test depth of knowledge, not just definitions
- For behavioral: use STAR-method prompts ("Tell me about a time when...")
- For situational: present a realistic scenario
- Each question must be self-contained

Respond with valid JSON:
{
  "questions": [
    {
      "text": "question text",
      "difficulty": "easy|medium|hard",
      "expectedKeywords": ["keyword1", "keyword2"],
      "followUpQuestions": ["optional follow-up"]
    }
  ]
}
`.trim();

/**
 * Generate questions for an interview session.
 * First tries the question bank, then generates AI questions for gaps.
 *
 * @param {object} params
 * @param {string} params.targetRole
 * @param {'practice'|'timed'|'full'} params.mode
 * @param {string[]} params.skills
 * @param {string} [params.jobDescription]
 * @param {string} [params.interviewId] - for tagging generated questions
 * @returns {Promise<object[]>} array of question documents
 */
async function generate({ targetRole, mode, skills, jobDescription, interviewId }) {
  if (jobDescription) assertSafe(jobDescription, 'job-description');

  const counts = CATEGORY_COUNTS[mode] || CATEGORY_COUNTS.practice;
  const allQuestions = [];

  for (const [category, count] of Object.entries(counts)) {
    if (count === 0) continue;

    // Try question bank first
    const bankQuestions = await Question.find({
      category,
      active: true,
      $or: [{ role: targetRole }, { role: 'General' }, { role: { $exists: false } }],
    })
      .limit(count)
      .lean();

    if (bankQuestions.length >= count) {
      allQuestions.push(...bankQuestions.slice(0, count));
      continue;
    }

    // Generate remaining with AI
    const needed = count - bankQuestions.length;
    try {
      const { data } = await ai.generateJson(
        GEN_PROMPT(targetRole || 'Software Engineer', category, needed, skills, jobDescription),
        'quality'
      );

      const generated = Array.isArray(data.questions) ? data.questions.slice(0, needed) : [];

      // Persist generated questions for future reuse
      const saved = await Question.insertMany(
        generated.map(q => ({
          text:              String(q.text || '').slice(0, 2000),
          category,
          role:              targetRole || 'General',
          difficulty:        ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
          expectedKeywords:  Array.isArray(q.expectedKeywords) ? q.expectedKeywords.slice(0, 20) : [],
          followUpQuestions: Array.isArray(q.followUpQuestions) ? q.followUpQuestions.slice(0, 3) : [],
          source:            jobDescription ? 'jd-generated' : 'cv-generated',
          interviewId:       interviewId || undefined,
        }))
      );

      allQuestions.push(...bankQuestions, ...saved);
    } catch (err) {
      // Fallback: use bank questions even if fewer than requested
      allQuestions.push(...bankQuestions);
    }
  }

  return allQuestions;
}

module.exports = { generate, CATEGORY_COUNTS };
