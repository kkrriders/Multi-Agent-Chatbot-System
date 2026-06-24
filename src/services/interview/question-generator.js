'use strict';

/**
 * Question generator — produces role-specific interview questions
 * from a candidate profile + optional job description.
 *
 * For a full mock interview the distribution is:
 *   intro (1) → technical (4-6) → behavioral (3-4) → situational (2-3) → closing (1)
 *
 * Bank questions use $sample for randomisation and exclude questions the user
 * has already answered (seenQuestionIds). Only source:'system' questions are
 * eligible for the shared bank — AI-generated questions are session-specific.
 */

const mongoose = require('mongoose');
const ai = require('../ai/provider-manager');
const Question = require('../../models/Question');
const { assertSafe } = require('../../middleware/injection-guard');
const { logger } = require('../../shared/logger');

const CATEGORY_COUNTS = {
  practice: { technical: 5, behavioral: 3, situational: 2, intro: 0, closing: 0 },
  timed:    { technical: 5, behavioral: 3, situational: 2, intro: 0, closing: 0 },
  full:     { intro: 1, technical: 5, behavioral: 4, situational: 3, closing: 1 },
};

function _computeCountsForN(n) {
  const technical  = Math.round(n * 0.5);
  const behavioral = Math.round(n * 0.3);
  const situational = Math.max(1, n - technical - behavioral);
  return { technical, behavioral, situational, intro: 0, closing: 0 };
}

const RESPONSE_FORMAT = `
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
}`.trim();

function _buildPrompt(role, category, count, skills, jdSnippet, companyContext, userProfile, liveSnippets) {
  const companyBlock = companyContext ? `
Target company: ${companyContext.name}
Interview format: ${companyContext.interviewFormat}
Key evaluation criteria: ${(companyContext.evaluationCriteria || []).join(', ')}
Common question themes: ${(companyContext.questionPatterns || []).slice(0, 4).join('; ')}
Culture signals: ${(companyContext.cultureSignals || []).join(', ')}
Red flags to address in practice: ${(companyContext.redFlags || []).slice(0, 3).join('; ')}
` : '';

  const profileBlock = userProfile && userProfile.skills.length > 0 ? `
Candidate's top skills: ${userProfile.skills.slice(0, 8).join(', ')}
${userProfile.weakAreas.slice(0, 5).length ? `Areas needing practice (probe deeper here): ${userProfile.weakAreas.slice(0, 5).join(', ')}` : ''}
${userProfile.strongAreas.slice(0, 5).length ? `Strong areas (can ask harder follow-ups): ${userProfile.strongAreas.slice(0, 5).join(', ')}` : ''}
${userProfile.cvGaps.slice(0, 5).length ? `CV skill gaps to probe: ${userProfile.cvGaps.slice(0, 5).join(', ')}` : ''}
` : `Candidate skills: ${skills.slice(0, 20).join(', ')}`;

  const liveBlock = liveSnippets && liveSnippets.length > 0
    ? `\nAdditional context from recent sources:\n${liveSnippets.slice(0, 2).join('\n')}`
    : '';

  const jdBlock = jdSnippet ? `\nJob description excerpt:\n${jdSnippet.slice(0, 800)}` : '';

  return `You are an expert interviewer${companyContext ? ` simulating a ${companyContext.name} interview` : ''}. Generate exactly ${count} ${category} interview questions for a ${role} candidate.
${companyBlock}${profileBlock}${jdBlock}${liveBlock}
Requirements:
- Questions must mirror ${companyContext ? `${companyContext.name}'s actual interview style and evaluation criteria` : 'the role and candidate background'}
- For technical: test depth of knowledge, not just definitions
- For behavioral: use STAR-method prompts; reflect the company's culture signals if provided
- For situational: present a realistic scenario the company would actually face
- If candidate has weak areas listed: include at least 1 question targeting those areas
- Each question must be self-contained

${RESPONSE_FORMAT}`.trim();
}

/**
 * Generate questions for an interview session.
 * First tries the question bank, then generates AI questions for gaps.
 *
 * @param {object} params
 * @param {string} params.targetRole
 * @param {'practice'|'timed'|'full'} params.mode
 * @param {string[]} params.skills
 * @param {string} [params.jobDescription]
 * @param {string} [params.interviewId]
 * @param {object} [params.companyContext]  — from orchestrator (curated company data)
 * @param {object} [params.userProfile]     — from profile-agent (CV skills + weak areas)
 * @param {string[]} [params.liveSnippets]  — sanitised live search results
 * @returns {Promise<object[]>} array of question documents
 */
async function generate({ targetRole, mode, skills, jobDescription, interviewId, companyContext, userProfile, liveSnippets, seenQuestionIds = [], numQuestions }) {
  if (jobDescription) assertSafe(jobDescription, 'job-description');
  if (targetRole)     assertSafe(targetRole, 'target-role');

  const defaultCounts = CATEGORY_COUNTS[mode] || CATEGORY_COUNTS.practice;
  const counts = (numQuestions && ['practice', 'timed'].includes(mode))
    ? _computeCountsForN(numQuestions)
    : defaultCounts;
  const allQuestions = [];

  // Cast seen IDs once — Mongoose aggregate does not auto-cast strings to ObjectId
  const seenObjIds = seenQuestionIds
    .filter(id => mongoose.Types.ObjectId.isValid(id))
    .map(id => new mongoose.Types.ObjectId(String(id)));

  for (const [category, count] of Object.entries(counts)) {
    if (count === 0) continue;

    // Random sample from shared bank (source:system only, excluding already-seen questions)
    const matchFilter = {
      category,
      active:  true,
      source:  'system',
      $or: [{ role: targetRole }, { role: 'General' }, { role: { $exists: false } }],
    };
    if (seenObjIds.length) matchFilter._id = { $nin: seenObjIds };

    const bankQuestions = await Question.aggregate([
      { $match: matchFilter },
      { $sample: { size: count } },
    ]);

    if (bankQuestions.length >= count) {
      allQuestions.push(...bankQuestions.slice(0, count));
      continue;
    }

    // Generate remaining with AI — enriched prompt when company/profile context is available
    const needed = count - bankQuestions.length;
    try {
      const prompt = _buildPrompt(
        targetRole || 'Software Engineer',
        category,
        needed,
        skills,
        jobDescription,
        companyContext || null,
        userProfile || null,
        liveSnippets || []
      );

      const { data } = await ai.generateJson(prompt, 'balanced');
      const generated = Array.isArray(data.questions) ? data.questions.slice(0, needed) : [];

      const questionSource = companyContext
        ? 'company-tailored'
        : jobDescription ? 'jd-generated' : 'cv-generated';

      const saved = await Question.insertMany(
        generated.map(q => ({
          text:              String(q.text || '').slice(0, 2000),
          category,
          role:              targetRole || 'General',
          difficulty:        ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
          expectedKeywords:  Array.isArray(q.expectedKeywords) ? q.expectedKeywords.slice(0, 20) : [],
          followUpQuestions: Array.isArray(q.followUpQuestions) ? q.followUpQuestions.slice(0, 3) : [],
          source:            questionSource,
          interviewId:       interviewId || undefined,
        }))
      );

      allQuestions.push(...bankQuestions, ...saved);
    } catch (err) {
      logger.warn(`[question-generator] AI generation failed for category=${category}: ${err.message}`);
      allQuestions.push(...bankQuestions);
    }
  }

  return allQuestions;
}

module.exports = { generate, CATEGORY_COUNTS };
