'use strict';

const fs   = require('fs');
const path = require('path');
const { scan } = require('../../middleware/injection-guard');
const { logger } = require('../../shared/logger');

// Common aliases so "Facebook" maps to meta.json, "JP Morgan" maps to jpmorgan.json, etc.
const ALIASES = {
  facebook: 'meta',
  fb: 'meta',
  alphabet: 'google',
  goog: 'google',
  msft: 'microsoft',
  amzn: 'amazon',
  'jp morgan': 'jpmorgan',
  'j.p. morgan': 'jpmorgan',
  jpm: 'jpmorgan',
  goldman: 'goldman-sachs',
  'goldman sachs': 'goldman-sachs',
  gs: 'goldman-sachs',
  chase: 'jpmorgan',
  'jp morgan chase': 'jpmorgan',
  'deep mind': 'deepmind',
};

const COMPANIES_DIR = path.join(__dirname, '../../data/companies');

// Load all company files at module init — avoids per-request require() + filesystem misses.
// New JSON files take effect on process restart (expected behaviour for static data).
const CURATED = {};
try {
  for (const file of fs.readdirSync(COMPANIES_DIR)) {
    if (!file.endsWith('.json')) continue;
    const slug = file.replace('.json', '');
    CURATED[slug] = require(path.join(COMPANIES_DIR, file));
  }
} catch (err) {
  logger.warn(`[research-agent] Could not load company data: ${err.message}`);
}

function _slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function _loadCurated(companyName) {
  const slug     = _slugify(companyName);
  const resolved = ALIASES[slug] || slug;
  return CURATED[resolved] || null;
}

/**
 * Strip non-alphanumeric characters and cap length so CV data cannot
 * manipulate Tavily queries or leak structured content to a third party.
 */
function _sanitizeQueryTerm(term) {
  return String(term).replace(/[^\w\s\-\.]/g, '').trim().slice(0, 50);
}

/**
 * Fetch a single answer snippet from Tavily.
 * Returns the answer string, or null on any failure.
 * Caller must scan() the result before using it in AI prompts.
 */
async function _fetchTavily(query) {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        max_results: 3,
        search_depth: 'basic',
        include_answer: true,
      }),
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) {
      logger.warn(`[research-agent] Tavily ${res.status} for query="${query.slice(0, 60)}"`);
      return null;
    }
    const data = await res.json();
    return data.answer || null;
  } catch (err) {
    logger.warn(`[research-agent] Tavily fetch failed: ${err.message}`);
    return null;
  }
}

/**
 * Build 2 CV-focused search queries using sanitised profile terms.
 * Queries are narrow: company + role + candidate's actual skills/weak areas.
 */
function _buildQueries(companyName, targetRole, userProfile) {
  const safeCompany = _sanitizeQueryTerm(companyName);
  const safeRole    = _sanitizeQueryTerm(targetRole);
  const topSkills   = userProfile.skills.slice(0, 3).map(_sanitizeQueryTerm).filter(Boolean).join(' ');

  const queries = [
    `${safeCompany} ${safeRole} interview questions${topSkills ? ' ' + topSkills : ''}`.trim(),
  ];

  const focusTerm = userProfile.weakAreas[0] || userProfile.skillGaps[0];
  if (focusTerm) {
    queries.push(`${safeCompany} ${_sanitizeQueryTerm(focusTerm)} interview preparation tips`);
  }

  return queries;
}

/**
 * Research a company through curated data + optional live Tavily search.
 * Live snippets are sanitised through injection-guard before being returned.
 *
 * @param {object} params
 * @param {string} params.companyName
 * @param {object} params.userProfile  — from profile-agent
 * @param {string} params.targetRole
 * @returns {Promise<{
 *   companyName: string,
 *   curated: object|null,
 *   liveSnippets: string[],
 *   source: string,
 *   confidence: 'high'|'medium'|'low'
 * }>}
 */
async function research({ companyName, userProfile, targetRole }) {
  const curated      = _loadCurated(companyName);
  const liveSnippets = [];

  if (process.env.TAVILY_API_KEY) {
    const queries = _buildQueries(companyName, targetRole, userProfile);
    for (const query of queries) {
      const snippet = await _fetchTavily(query);
      if (!snippet) continue;
      // Sanitise before adding — live content could contain injection attempts
      const { safe } = scan(snippet);
      if (safe) liveSnippets.push(snippet.slice(0, 400));
    }
  }

  const source = curated
    ? (liveSnippets.length ? 'curated+live' : 'curated')
    : (liveSnippets.length ? 'live' : 'none');

  return {
    companyName,
    curated,
    liveSnippets,
    source,
    confidence: curated ? 'high' : liveSnippets.length ? 'medium' : 'low',
  };
}

module.exports = { research };
