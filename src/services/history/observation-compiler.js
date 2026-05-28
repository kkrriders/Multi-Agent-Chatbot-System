'use strict';

/**
 * ObservationCompiler — stores and queries per-candidate interview observations.
 *
 * Observation types:
 *   speech_quality    — filler words, pace, pronunciation per answer
 *   technical_accuracy — score for technical questions
 *   cv_gap            — skills missing for target role
 *   weak_area         — topic category where score < 60
 *   strong_area       — topic category where score >= 80
 *
 * Supports the 3-layer retrieval pattern (see retrieval-service.js):
 *   Layer 1: compact index (id, type, concept, timestamp, score) ~50 tokens each
 *   Layer 2: timeline summary (ordered, with session context)
 *   Layer 3: full detail per observation id
 */

const Observation = require('../../models/Observation');
const { logger } = require('../../shared/logger');

const VALID_TYPES = ['speech_quality', 'technical_accuracy', 'cv_gap', 'weak_area', 'strong_area'];

/**
 * Record a new observation for a candidate.
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.interviewId
 * @param {string} params.type  - one of VALID_TYPES
 * @param {string} params.concept  - e.g. "system design", "communication"
 * @param {object} params.data  - flexible payload
 * @param {number} [params.score]  - 0-100 if applicable
 * @returns {Promise<object>} saved observation
 */
async function record({ userId, interviewId, type, concept, data, score }) {
  if (!VALID_TYPES.includes(type)) {
    throw new Error(`Invalid observation type: ${type}`);
  }

  const summary = _buildSummary(type, concept, score, data);

  const obs = await Observation.create({
    userId,
    interviewId,
    type,
    concept,
    data,
    score: typeof score === 'number' ? score : undefined,
    summary,
  });

  logger.debug(`[obs] recorded ${type}/${concept} for user ${userId}`);
  return obs.toObject();
}

/**
 * Query observations for a user, optionally filtered by type and/or concept.
 * Returns Layer 1 compact index (for cheap retrieval).
 */
async function queryIndex(userId, { types, concepts, limit = 50 } = {}) {
  const filter = { userId };
  if (types?.length) filter.type = { $in: types };
  if (concepts?.length) filter.concept = { $in: concepts };

  const docs = await Observation.find(filter)
    .select('_id type concept score summary timestamp')
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();

  return docs.map(d => ({
    id: d._id.toString(),
    type: d.type,
    concept: d.concept,
    score: d.score,
    summary: d.summary,
    timestamp: d.timestamp,
  }));
}

/**
 * Build a chronological timeline for a user (Layer 2).
 * Groups observations by interview session with context.
 */
async function buildTimeline(userId, { limit = 100 } = {}) {
  const docs = await Observation.find({ userId })
    .select('_id type concept score summary interviewId timestamp')
    .sort({ timestamp: 1 })
    .limit(limit)
    .lean();

  // Group by interviewId
  const sessions = {};
  for (const d of docs) {
    const sid = d.interviewId?.toString() || 'standalone';
    if (!sessions[sid]) sessions[sid] = { interviewId: sid, observations: [] };
    sessions[sid].observations.push({
      id: d._id.toString(),
      type: d.type,
      concept: d.concept,
      score: d.score,
      summary: d.summary,
      timestamp: d.timestamp,
    });
  }

  return Object.values(sessions);
}

/**
 * Get full detail for specific observation ids (Layer 3).
 */
async function getDetail(ids) {
  const docs = await Observation.find({ _id: { $in: ids } }).lean();
  return docs.map(d => ({ ...d, id: d._id.toString() }));
}

/**
 * Compute longitudinal trend for a concept across sessions.
 * Returns array of { interviewId, date, score } sorted oldest-first.
 */
async function trend(userId, concept) {
  const docs = await Observation.find({ userId, concept, score: { $exists: true } })
    .select('interviewId score timestamp')
    .sort({ timestamp: 1 })
    .lean();

  return docs.map(d => ({
    interviewId: d.interviewId?.toString(),
    date: d.timestamp,
    score: d.score,
  }));
}

function _buildSummary(type, concept, score, data) {
  const scoreStr = typeof score === 'number' ? ` (${score}/100)` : '';
  switch (type) {
    case 'speech_quality':
      return `Speech on "${concept}"${scoreStr}: ${data?.fillerCount ?? 0} fillers, ${data?.pace ?? '?'} wpm`;
    case 'technical_accuracy':
      return `Technical "${concept}"${scoreStr}`;
    case 'cv_gap':
      return `CV gap: missing "${concept}"`;
    case 'weak_area':
      return `Weak area: "${concept}"${scoreStr}`;
    case 'strong_area':
      return `Strong area: "${concept}"${scoreStr}`;
    default:
      return `${type}: ${concept}${scoreStr}`;
  }
}

module.exports = { record, queryIndex, buildTimeline, getDetail, trend, VALID_TYPES };
