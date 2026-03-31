/**
 * Intent Classifier
 *
 * Three-tier classification pipeline for routing user messages to the correct agent:
 *   1. LLM (llama3-8b, JSON mode) — highest accuracy, ~500ms
 *   2. TF-IDF cosine similarity     — local, instant fallback
 *   3. Keyword regex rules           — hard safety net (same rules as old modelRouter)
 *
 * Results are cached (in-process Map, 5 min TTL) so repeated messages cost nothing.
 * Groq has no embeddings endpoint, so TF-IDF fills that role locally.
 */

'use strict';

const { generateResponseJson } = require('./ollama');
const { logger } = require('./logger');

// ── Agent profiles (keyword vocabularies used by TF-IDF) ─────────────────────

const AGENT_PROFILES = {
  'agent-1': {
    model:    process.env.AGENT_1_MODEL || 'llama3-8b-8192',
    label:    'general',
    llmLabel: 'general',
    keywords: [
      'help', 'what', 'how', 'tell', 'explain', 'describe', 'general',
      'simple', 'basic', 'question', 'answer', 'hello', 'hi', 'thanks',
      'information', 'know', 'understand', 'definition', 'meaning', 'overview',
    ],
  },
  'agent-2': {
    model:    process.env.AGENT_2_MODEL || 'mixtral-8x7b-32768',
    label:    'analyst',
    llmLabel: 'analyst',
    keywords: [
      'analyze', 'analysis', 'research', 'compare', 'comparison', 'data',
      'statistics', 'report', 'summarize', 'summary', 'review', 'evaluate',
      'pros', 'cons', 'tradeoff', 'assess', 'study', 'findings', 'results',
      'metrics', 'insights', 'trends', 'benchmark', 'performance',
    ],
  },
  'agent-3': {
    model:    process.env.AGENT_3_MODEL || 'gemma2-9b-it',
    label:    'creative',
    llmLabel: 'creative',
    keywords: [
      'story', 'poem', 'creative', 'imagine', 'fiction', 'narrative', 'write',
      'character', 'novel', 'screenplay', 'lyrics', 'metaphor', 'brainstorm',
      'invent', 'design', 'art', 'music', 'idea', 'concept', 'inspiration',
      'fantasy', 'adventure', 'dialogue',
    ],
  },
  'agent-4': {
    model:    process.env.AGENT_4_MODEL || 'llama3-70b-8192',
    label:    'specialist',
    llmLabel: 'specialist',
    keywords: [
      'code', 'function', 'class', 'debug', 'error', 'bug', 'programming',
      'javascript', 'python', 'typescript', 'sql', 'api', 'algorithm',
      'implement', 'refactor', 'snippet', 'script', 'compile', 'syntax',
      'database', 'backend', 'frontend', 'framework', 'library', 'deploy',
      'git', 'docker', 'server', 'endpoint', 'request', 'variable',
    ],
  },
};

const LABEL_TO_AGENT = Object.fromEntries(
  Object.entries(AGENT_PROFILES).map(([id, p]) => [p.llmLabel, id])
);

// ── In-process result cache ───────────────────────────────────────────────────

const _cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function _getCached(text) {
  const entry = _cache.get(text);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { _cache.delete(text); return null; }
  return entry.result;
}

function _setCached(text, result) {
  if (_cache.size >= 200) {
    // Evict the oldest entry
    _cache.delete(_cache.keys().next().value);
  }
  _cache.set(text, { result, ts: Date.now() });
}

// ── Tier 2 — TF-IDF cosine similarity ────────────────────────────────────────

function _tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2);
}

/**
 * Build a term-frequency vector over the union of all keyword vocabularies.
 * The corpus vocabulary is small (~80 terms) so this is fast.
 */
function _buildVector(tokens, vocab) {
  const tf = new Map();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  return vocab.map(term => tf.get(term) || 0);
}

function _cosine(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// Pre-compute per-agent keyword vectors once at module load
const _vocab = [...new Set(Object.values(AGENT_PROFILES).flatMap(p => p.keywords))];
const _agentVectors = Object.fromEntries(
  Object.entries(AGENT_PROFILES).map(([id, p]) => [id, _buildVector(p.keywords, _vocab)])
);

function tfidfClassify(text) {
  const tokens = _tokenize(text);
  const queryVec = _buildVector(tokens, _vocab);

  const ranked = Object.entries(_agentVectors)
    .map(([agentId, agentVec]) => ({ agentId, score: _cosine(queryVec, agentVec) }))
    .sort((a, b) => b.score - a.score);

  return {
    agentId:    ranked[0].agentId,
    confidence: ranked[0].score,
    method:     'tfidf',
    ranked,   // full ranking, used by classifyIntent for secondCandidate
  };
}

// ── Tier 3 — Keyword regex safety net (original modelRouter rules) ────────────

const _KEYWORD_RULES = [
  {
    pattern: /\b(code|function|class|debug|error|bug|stack\s*trace|programming|javascript|python|typescript|sql|api|algorithm|implement|refactor|snippet|script|compile|syntax)\b/i,
    agentId: 'agent-4',
  },
  {
    pattern: /\b(story|poem|creative|imagine|fiction|narrative|write\s+me|character|novel|screenplay|lyrics|metaphor|brainstorm)\b/i,
    agentId: 'agent-3',
  },
  {
    pattern: /\b(analyze|analysis|research|compare|comparison|data|statistics|report|summarize|review|evaluate|pros\s+and\s+cons|trade.?off)\b/i,
    agentId: 'agent-2',
  },
];

function keywordClassify(text) {
  for (const rule of _KEYWORD_RULES) {
    if (rule.pattern.test(text)) {
      return { agentId: rule.agentId, confidence: 0.7, method: 'keyword', reasoning: 'keyword match' };
    }
  }
  return { agentId: 'agent-1', confidence: 0.5, method: 'keyword', reasoning: 'default' };
}

// ── Tier 1 — LLM classification ───────────────────────────────────────────────

async function _llmClassify(text) {
  const prompt =
    `You are a routing system for a multi-agent chatbot. Classify the user message into exactly one agent.\n\n` +
    `Agents:\n` +
    `- "general"    → greetings, simple questions, casual conversation, factual Q&A\n` +
    `- "analyst"    → data analysis, research, comparisons, reports, evaluations\n` +
    `- "creative"   → stories, poems, fiction, brainstorming, creative writing\n` +
    `- "specialist" → code, programming, debugging, algorithms, technical implementation\n\n` +
    `User message: "${text.slice(0, 400).replace(/"/g, "'")}"\n\n` +
    `Respond ONLY with valid JSON:\n` +
    `{"agent": "general|analyst|creative|specialist", "confidence": 0.0-1.0, "reasoning": "one sentence"}`;

  const result = await generateResponseJson(
    process.env.AGENT_1_MODEL || 'llama3-8b-8192',
    prompt,
    { temperature: 0.1, num_predict: 80 }
  );

  const agentId    = LABEL_TO_AGENT[result.agent] || 'agent-1';
  const confidence = Math.min(1, Math.max(0, Number(result.confidence) || 0.5));
  return { agentId, confidence, reasoning: result.reasoning || '', method: 'llm' };
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Classify a message to the most appropriate agent.
 *
 * Pipeline: LLM → TF-IDF → keyword regex
 *
 * @param {string} text
 * @returns {Promise<{
 *   agentId: string, model: string, confidence: number, method: string, reason: string,
 *   secondCandidate: { agentId: string, model: string, confidence: number } | null
 * }>}
 */
async function classifyIntent(text) {
  if (typeof text !== 'string' || !text.trim()) {
    const profile = AGENT_PROFILES['agent-1'];
    return {
      agentId: 'agent-1', model: profile.model, confidence: 0.5,
      method: 'default', reason: 'empty input', secondCandidate: null,
    };
  }

  const normalized = text.trim();
  const cached = _getCached(normalized);
  if (cached) return cached;

  // Always run TF-IDF for the full ranking (used to derive secondCandidate)
  const tfidf = tfidfClassify(normalized);

  let result;

  // Tier 1: LLM
  try {
    const llm = await _llmClassify(normalized);
    if (llm.confidence >= 0.6) {
      result = llm;
    } else {
      // Blend: low LLM confidence → compare with TF-IDF
      result = tfidf.confidence > llm.confidence
        ? { ...tfidf, reasoning: 'TF-IDF beat low-confidence LLM' }
        : llm;
    }
  } catch (err) {
    logger.warn(`[IntentClassifier] LLM tier failed (${err.message}), falling back to TF-IDF`);
    result = tfidf.confidence > 0.05
      ? tfidf
      : keywordClassify(normalized); // Tier 3 safety net
  }

  // Derive secondCandidate: highest-ranked agent that differs from primary
  const secondRanked = (tfidf.ranked || []).find(r => r.agentId !== result.agentId);
  const secondProfile = secondRanked ? AGENT_PROFILES[secondRanked.agentId] : null;
  const secondCandidate = secondProfile
    ? { agentId: secondRanked.agentId, model: secondProfile.model, confidence: secondRanked.score }
    : null;

  const profile = AGENT_PROFILES[result.agentId] || AGENT_PROFILES['agent-1'];
  const final = {
    agentId:         result.agentId,
    model:           profile.model,
    confidence:      result.confidence,
    method:          result.method,
    reason:          result.reasoning || `${result.method} → ${profile.label}`,
    secondCandidate,
  };

  _setCached(normalized, final);
  logger.debug(
    `[IntentClassifier] "${normalized.slice(0, 60)}…" → ${final.agentId} (${final.method}, conf=${final.confidence.toFixed(2)})` +
    (secondCandidate ? ` | 2nd: ${secondCandidate.agentId} (${secondCandidate.confidence.toFixed(2)})` : '')
  );
  return final;
}

module.exports = { classifyIntent, tfidfClassify, keywordClassify, AGENT_PROFILES };
