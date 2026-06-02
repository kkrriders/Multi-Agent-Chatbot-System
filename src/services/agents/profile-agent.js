'use strict';

const CandidateProfile = require('../../models/CandidateProfile');
const retrieval = require('../history/retrieval-service');

/**
 * Builds a compact candidate profile from CV data and observation history.
 * Used by the orchestrator to focus company research on what the candidate
 * actually needs to work on — not generic research.
 *
 * No AI calls. Pure DB reads.
 *
 * @param {string} userId
 * @returns {Promise<{
 *   skills: string[],
 *   skillGaps: string[],
 *   experience: object[],
 *   weakAreas: string[],
 *   strongAreas: string[],
 *   cvGaps: string[],
 *   hasHistory: boolean
 * }>}
 */
async function build(userId) {
  const [profile, observations] = await Promise.all([
    CandidateProfile.findOne({ userId }).lean(),
    retrieval.search(userId, { limit: 50 }),
  ]);

  const unique = (arr) => [...new Set(arr)];

  const weakAreas  = unique(observations.filter(o => o.type === 'weak_area').map(o => o.concept));
  const strongAreas = unique(observations.filter(o => o.type === 'strong_area').map(o => o.concept));
  const cvGaps     = unique(observations.filter(o => o.type === 'cv_gap').map(o => o.concept));

  return {
    skills:      profile?.skills     || [],
    skillGaps:   profile?.skillGaps  || [],
    experience:  profile?.experience || [],
    weakAreas,
    strongAreas,
    cvGaps,
    hasHistory:  observations.length > 0,
  };
}

module.exports = { build };
