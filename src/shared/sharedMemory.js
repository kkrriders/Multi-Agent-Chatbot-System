/**
 * Shared Memory Broker
 *
 * Two-tier memory architecture so agents can collaborate on shared context:
 *
 * Global tier  — facts and context any agent can read or write.
 *                Stored in an in-process Map (fast) and optionally persisted
 *                to MongoDB under a synthetic agent record.
 *
 * Agent tier   — per-agent working memory scoped to (agentId, userId).
 *                Thin wrapper around the existing AgentMemory class.
 *
 * mergeContextForAgent() combines both tiers into a single string block
 * ready to be injected into an agent's system prompt.
 *
 * MongoDB schema note: global entries are stored using a fixed synthetic
 * ObjectId so the existing Memory schema (userId required, ObjectId) is
 * satisfied without any schema migration.
 */

'use strict';

const mongoose = require('mongoose');
const { logger } = require('./logger');

// Fixed synthetic ObjectId reserved for the global shared memory record.
// Must never collide with a real user ObjectId in production.
const GLOBAL_USER_OID = new mongoose.Types.ObjectId('000000000000000000000001');
const GLOBAL_AGENT_ID = '__shared__';

// ── Jaccard similarity (mirrors memory.js fallback) ───────────────────────────

function _jaccard(text1, text2) {
  const set1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const set2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  let intersect = 0;
  for (const w of set1) { if (set2.has(w)) intersect++; }
  const union = set1.size + set2.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

// ── Lazy model loader (avoids circular require at startup) ────────────────────

let _MemoryModel = null;
function _getMemoryModel() {
  if (!_MemoryModel) _MemoryModel = require('../models/Memory');
  return _MemoryModel;
}

function _isDbLive() {
  return mongoose.connection.readyState === 1;
}

// ── SharedMemoryBroker ────────────────────────────────────────────────────────

class SharedMemoryBroker {
  constructor() {
    // In-process fallback: Array of plain objects
    this._globalEntries = [];
    // Cap for the in-memory store
    this._MAX_GLOBAL = 500;
    // Cache of initialized AgentMemory instances: "(agentId::userId)" → instance
    // Avoids re-running initialize() (a MongoDB round-trip) on every prompt build.
    this._agentMemoryCache = new Map();
  }

  async _getOrCreateAgentMemory(agentId, userId) {
    const key = `${agentId}::${userId || 'default'}`;
    if (this._agentMemoryCache.has(key)) return this._agentMemoryCache.get(key);
    const { AgentMemory } = require('./memory');
    const mem = new AgentMemory(agentId, userId);
    await mem.initialize();
    this._agentMemoryCache.set(key, mem);
    return mem;
  }

  // ── Global tier ─────────────────────────────────────────────────────────────

  /**
   * Write a fact/context entry visible to all agents.
   *
   * @param {string} content
   * @param {Object} [opts]
   * @param {string} [opts.type='FACT']
   * @param {string} [opts.conversationId]
   * @param {number} [opts.importance=0.5]
   */
  async writeGlobal(content, opts = {}) {
    // Use a plain object for metadata in both DB and in-memory stores to avoid
    // Mongoose Map serialization issues and ensure consistent read access.
    const metaPlain = { source: opts.source || 'agent', conversationId: opts.conversationId || 'unknown' };

    const entry = {
      type:         opts.type || 'FACT',
      content,
      importance:   opts.importance ?? 0.5,
      timestamp:    new Date(),
      lastAccessed: new Date(),
      accessCount:  0,
      metadata:     metaPlain,
    };

    // Persist to MongoDB (best-effort, atomic upsert avoids race conditions)
    if (_isDbLive()) {
      try {
        const M = _getMemoryModel();
        await M.findOneAndUpdate(
          { userId: GLOBAL_USER_OID, agentId: GLOBAL_AGENT_ID },
          { $push: { entries: entry } },
          { upsert: true, new: true }
        );
      } catch (err) {
        logger.warn(`[SharedMemory] writeGlobal DB error: ${err.message}`);
      }
    }

    // Mirror to in-process store (uses the same plain-object metadata)
    this._globalEntries.push({ ...entry });
    if (this._globalEntries.length > this._MAX_GLOBAL) {
      this._globalEntries.splice(0, 50); // evict oldest 50
    }
  }

  /**
   * Retrieve global memories relevant to a query.
   *
   * @param {string} query
   * @param {number} [limit=5]
   * @returns {Promise<Array<{ content: string, type: string, score: number }>>}
   */
  async readGlobal(query, limit = 5) {
    let entries = this._globalEntries;

    // Try to hydrate from DB on first read when in-memory store is empty
    if (entries.length === 0 && _isDbLive()) {
      try {
        const M = _getMemoryModel();
        const record = await M.findOne({ userId: GLOBAL_USER_OID, agentId: GLOBAL_AGENT_ID });
        if (record && record.entries.length > 0) {
          this._globalEntries = record.entries.map(e => ({
            content:   e.content,
            type:      e.type,
            timestamp: e.timestamp,
          }));
          entries = this._globalEntries;
        }
      } catch (err) {
        logger.warn(`[SharedMemory] readGlobal DB hydration error: ${err.message}`);
      }
    }

    if (!entries.length) return [];

    if (!query) return entries.slice(-limit);

    return entries
      .map(e => ({ ...e, score: _jaccard(query, e.content) }))
      .filter(e => e.score > 0.05)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // ── Agent-specific tier ──────────────────────────────────────────────────────

  /**
   * Write to an agent's own scoped memory.
   */
  async writeAgentMemory(agentId, userId, content, opts = {}) {
    const { MEMORY_TYPES } = require('./memory');
    const mem = await this._getOrCreateAgentMemory(agentId, userId);
    await mem.storeMemory(opts.type || MEMORY_TYPES.FACT, content, opts);
  }

  /**
   * Read from an agent's own scoped memory, ranked by relevance.
   */
  async readAgentMemory(agentId, userId, query, limit = 5) {
    const mem = await this._getOrCreateAgentMemory(agentId, userId);
    return mem.searchMemories(query, limit);
  }

  // ── Context merging ──────────────────────────────────────────────────────────

  /**
   * Produce a ready-to-inject context block for an agent's system prompt.
   * Queries both global and agent-specific tiers in parallel.
   *
   * @param {string} agentId
   * @param {string} userId
   * @param {string} query  — current user message (relevance anchor)
   * @returns {Promise<string>}  — empty string when no relevant memories found
   */
  async mergeContextForAgent(agentId, userId, query) {
    const [globalMems, agentMems] = await Promise.all([
      this.readGlobal(query, 3).catch(() => []),
      this.readAgentMemory(agentId, userId, query, 3).catch(() => []),
    ]);

    const lines = [];

    if (globalMems.length > 0) {
      lines.push('[Shared context — known by all agents]');
      for (const m of globalMems) lines.push(`- ${m.content}`);
    }

    if (agentMems.length > 0) {
      lines.push(`[${agentId} personal memory]`);
      for (const m of agentMems) lines.push(`- ${m.content}`);
    }

    return lines.join('\n');
  }

  /**
   * Broadcast a fact all agents should know.
   * Convenience wrapper around writeGlobal.
   */
  async broadcastFact(content, conversationId) {
    await this.writeGlobal(content, { type: 'FACT', conversationId, importance: 0.6 });
  }
}

// ── Singleton export ───────────────────────────────────────────────────────────

const sharedMemoryBroker = new SharedMemoryBroker();

module.exports = { SharedMemoryBroker, sharedMemoryBroker };
