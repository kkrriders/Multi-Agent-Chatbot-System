'use strict';

const profileAgent = require('./profile-agent');
const researchAgent = require('./research-agent');
const { assertSafe } = require('../../middleware/injection-guard');
const { logger } = require('../../shared/logger');

/**
 * Runs the research pipeline for a company-targeted interview session.
 *
 * Pipeline (sequential — research needs profile first):
 *   1. profileAgent.build()   — reads CV + observation history (DB only)
 *   2. researchAgent.research() — curated JSON + optional Tavily, using profile as a lens
 *
 * Returns a merged context object ready for the question generator.
 * Never throws — caller wraps in a timeout race; any error returns null.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.companyName   — user-supplied, already injection-guarded by route
 * @param {string} params.targetRole
 * @returns {Promise<{
 *   userProfile: object,
 *   companyContext: object|null,
 *   liveSnippets: string[],
 *   source: string,
 *   confidence: string
 * }>}
 */
async function run({ userId, companyName, targetRole }) {
  assertSafe(companyName, 'company-name');

  const userProfile = await profileAgent.build(userId);

  const research = await researchAgent.research({ companyName, userProfile, targetRole });

  logger.info(
    `[orchestrator] userId=${userId} company="${companyName}" source=${research.source} confidence=${research.confidence}`
  );

  return {
    userProfile,
    companyContext: research.curated,
    liveSnippets:  research.liveSnippets,
    source:        research.source,
    confidence:    research.confidence,
  };
}

module.exports = { run };
