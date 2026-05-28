'use strict';

/**
 * CV Gap Analyzer — identifies skills required by the JD but missing from the CV.
 * Also outputs matched skills for the candidate profile overview.
 */

const ai = require('../ai/provider-manager');
const { assertSafe } = require('../../middleware/injection-guard');

const GAP_PROMPT = (skills, jd) => `
You are a career advisor. Compare the candidate's skills against the job description.

CANDIDATE SKILLS:
${skills.join(', ')}

JOB DESCRIPTION:
${jd.slice(0, 4000)}

Respond with valid JSON:
{
  "missingSkills": ["skill the JD requires but candidate lacks"],
  "matchedSkills": ["skill present in both"],
  "niceToHave": ["mentioned in JD but not critical"],
  "fitScore": 0-100
}
`.trim();

async function analyze(skills, jobDescription) {
  if (!jobDescription || !skills.length) {
    return { missingSkills: [], matchedSkills: skills, niceToHave: [], fitScore: null };
  }

  assertSafe(jobDescription, 'job-description');

  const { data } = await ai.generateJson(GAP_PROMPT(skills, jobDescription), 'balanced');

  return {
    missingSkills: Array.isArray(data.missingSkills)
      ? data.missingSkills.map(s => String(s).slice(0, 100)).slice(0, 50)
      : [],
    matchedSkills: Array.isArray(data.matchedSkills)
      ? data.matchedSkills.map(s => String(s).slice(0, 100)).slice(0, 50)
      : [],
    niceToHave: Array.isArray(data.niceToHave)
      ? data.niceToHave.map(s => String(s).slice(0, 100)).slice(0, 20)
      : [],
    fitScore: typeof data.fitScore === 'number' ? Math.min(100, Math.max(0, data.fitScore)) : null,
  };
}

module.exports = { analyze };
