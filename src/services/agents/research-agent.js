'use strict';

const fs   = require('fs');
const path = require('path');
const { scan, assertSafe } = require('../../middleware/injection-guard');
const { logger } = require('../../shared/logger');
const ai = require('../ai/provider-manager');

// Native tool-calling: the model decides whether curated data already covers
// the company well enough, or whether a live search would add value — and if
// so, what to search for. Replaces a fixed 2-query template with a judgment call.
const WEB_SEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Search the live web for current interview experiences or company-specific info. Costs an API call — only call this for a gap the curated data does not already cover.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'A concise, specific search query' } },
      required: ['query'],
    },
  },
};

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
  // Defense in depth — the route already guards targetRole, but this file now
  // puts it directly into an AI prompt (previously only into a sanitised query string).
  if (targetRole) assertSafe(targetRole, 'research-agent:targetRole');

  const curated = _loadCurated(companyName);
  const liveSnippets = process.env.TAVILY_API_KEY
    ? await _decideAndSearch(companyName, targetRole, userProfile, curated)
    : [];

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

function _buildDecisionPrompt(companyName, targetRole, userProfile, curated) {
  return `You are a research assistant preparing live web-search queries for a candidate's interview at "${companyName}" (role: ${targetRole || 'not specified'}).

${curated
    ? `We already have curated interview-prep data on file for this company (interview format: ${curated.interviewFormat || 'unspecified'}; evaluation criteria: ${(curated.evaluationCriteria || []).join(', ') || 'unspecified'}).`
    : 'We have no curated data on file for this company.'}

Candidate top skills: ${(userProfile.skills || []).slice(0, 5).join(', ') || 'unknown'}
Candidate weak areas to probe: ${(userProfile.weakAreas || []).slice(0, 3).join(', ') || 'none noted'}

Decide whether a live web search would add value beyond what we already have. If the curated data already covers the interview style well and there is no clear gap worth searching, do not call any tool. Otherwise call web_search 1-2 times with concise, specific queries.`;
}

/**
 * Let the model decide (via native tool-calling) whether live search adds
 * value here, and if so, what to search for — replacing a fixed query
 * template with a judgment call informed by the curated data + candidate profile.
 *
 * Falls back to the old fixed 2-query template if the tool-calling AI call
 * itself fails, so a rate-limited or unreachable provider never blocks research.
 */
async function _decideAndSearch(companyName, targetRole, userProfile, curated) {
  try {
    // Cached 24h — company+role+skill-shape prompts repeat often across different
    // candidates interviewing at the same popular company, unlike per-answer scoring prompts.
    const { toolCalls } = await ai.generateWithTools(
      _buildDecisionPrompt(companyName, targetRole, userProfile, curated),
      'fast',
      [WEB_SEARCH_TOOL],
      { callSite: 'research-agent:decide-search', cacheTtlSeconds: 86_400 }
    );

    const queries = toolCalls
      .filter(tc => tc.name === 'web_search' && typeof tc.arguments?.query === 'string')
      .slice(0, 2)
      .map(tc => _sanitizeQueryTerm(tc.arguments.query))
      .filter(Boolean);

    return _runQueries(queries);
  } catch (err) {
    logger.warn(`[research-agent] tool-calling search decision failed, falling back to fixed queries: ${err.message}`);
    return _runQueries(_buildQueries(companyName, targetRole, userProfile));
  }
}

async function _runQueries(queries) {
  const snippets = [];
  for (const query of queries) {
    const snippet = await _fetchTavily(query);
    if (!snippet) continue;
    // Sanitise before adding — live content could contain injection attempts
    const { safe } = scan(snippet);
    if (safe) snippets.push(snippet.slice(0, 400));
  }
  return snippets;
}

module.exports = { research };
