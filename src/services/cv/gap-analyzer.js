'use strict';

/**
 * CV Gap Analyzer — identifies skills required by the JD but missing from the CV.
 * Also outputs matched skills for the candidate profile overview.
 */

const ai = require('../ai/provider-manager');
const schemas = require('../ai/schemas');
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
  "fitScore": 0-100,
  "confidence": 0-1 (how sure YOU are in this fit score)
}
`.trim();

async function analyze(skills, jobDescription) {
  if (!jobDescription || !skills.length) {
    return { missingSkills: [], matchedSkills: skills, niceToHave: [], fitScore: null, confidence: null };
  }

  assertSafe(jobDescription, 'job-description');

  // Cached 24h — re-analyzing the same CV skills against the same JD (retry, revisit,
  // re-upload) is a plausible repeat; the answer isn't time-sensitive either way.
  const { data } = await ai.generateJson(
    GAP_PROMPT(skills, jobDescription),
    'balanced',
    { schema: schemas.gapAnalysis, callSite: 'gap-analyzer:analyze', cacheTtlSeconds: 86_400 }
  );

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
    confidence: data.confidence,
  };
}

module.exports = { analyze };
