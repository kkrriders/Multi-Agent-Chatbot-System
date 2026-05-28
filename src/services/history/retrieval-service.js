'use strict';

/**
 * 3-Layer candidate history retrieval.
 *
 * Layer 1 — search(userId, query): compact index, ~50 tokens per item.
 *   Use to find relevant observation IDs cheaply before deeper retrieval.
 *
 * Layer 2 — timeline(userId): chronological session groups, ~200 tokens each.
 *   Use to show progress over time or answer "how have I been doing on X?"
 *
 * Layer 3 — detail(ids): full observation data, ~500 tokens each.
 *   Use only for the specific items identified in Layer 1.
 *
 * This mirrors the claude-mem mem-search skill's search→timeline→get pattern,
 * keeping token cost low for most queries.
 */

const obs = require('./observation-compiler');

/**
 * Layer 1: keyword-filtered compact index.
 * @param {string} userId
 * @param {object} [filter]
 * @param {string[]} [filter.types]
 * @param {string[]} [filter.concepts]
 * @param {number} [filter.limit]
 * @returns {Promise<Array<{id, type, concept, score, summary, timestamp}>>}
 */
function search(userId, filter = {}) {
  return obs.queryIndex(userId, filter);
}

/**
 * Layer 2: chronological session timeline.
 * @param {string} userId
 * @param {object} [opts]
 * @param {number} [opts.limit]
 * @returns {Promise<Array<{interviewId, observations}>>}
 */
function timeline(userId, opts = {}) {
  return obs.buildTimeline(userId, opts);
}

/**
 * Layer 3: full detail for specific ids.
 * @param {string[]} ids
 * @returns {Promise<object[]>}
 */
function detail(ids) {
  return obs.getDetail(ids);
}

/**
 * Convenience: trend data for a single concept.
 * @param {string} userId
 * @param {string} concept
 */
function conceptTrend(userId, concept) {
  return obs.trend(userId, concept);
}

/**
 * Build a progress summary for a user (used in session summary report).
 * Returns weak areas, strong areas, and overall score trend.
 */
async function progressSummary(userId) {
  const index = await obs.queryIndex(userId, { limit: 200 });

  const weakAreas = index
    .filter(o => o.type === 'weak_area')
    .map(o => o.concept)
    .filter((v, i, a) => a.indexOf(v) === i); // unique

  const strongAreas = index
    .filter(o => o.type === 'strong_area')
    .map(o => o.concept)
    .filter((v, i, a) => a.indexOf(v) === i);

  const cvGaps = index
    .filter(o => o.type === 'cv_gap')
    .map(o => o.concept)
    .filter((v, i, a) => a.indexOf(v) === i);

  const technicalScores = index.filter(o => o.type === 'technical_accuracy' && typeof o.score === 'number');
  const avgTechnical = technicalScores.length
    ? Math.round(technicalScores.reduce((s, o) => s + o.score, 0) / technicalScores.length)
    : null;

  return { weakAreas, strongAreas, cvGaps, avgTechnical, totalObservations: index.length };
}

module.exports = { search, timeline, detail, conceptTrend, progressSummary };
