/**
 * Agent Memory System
 *
 * Stores agent memories in MongoDB when a real user ObjectId is available.
 * Falls back to an in-process Map for unauthenticated / test contexts.
 * No file I/O.
 */

const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const { logger } = require('./logger');
const { withRetry } = require('./retry');

// Lazy-load to avoid circular-require issues
let Memory = null;
function getMemoryModel() {
  if (!Memory) Memory = require('../models/Memory');
  return Memory;
}

// ─── Memory types ─────────────────────────────────────────────────────────────

const MEMORY_TYPES = {
  CONVERSATION: 'CONVERSATION',
  PREFERENCE: 'PREFERENCE',
  FACT: 'FACT',
  SKILL: 'SKILL',
  RELATIONSHIP: 'RELATIONSHIP',
};

// ─── MemoryEntry (lightweight value object) ──────────────────────────────────

class MemoryEntry {
  constructor(type, content, metadata = {}) {
    this.id = `mem_${randomUUID()}`;
    this.type = type;
    this.content = content;
    this.metadata = {
      timestamp: new Date().toISOString(),
      relevanceScore: 1.0,
      accessCount: 0,
      lastAccessed: new Date().toISOString(),
      ...metadata,
    };
  }

  updateAccess() {
    this.metadata.accessCount++;
    this.metadata.lastAccessed = new Date().toISOString();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidObjectId(id) {
  return id && id !== 'default' && mongoose.Types.ObjectId.isValid(id);
}

function mongoEntryToMemoryEntry(e) {
  return {
    id: e._id.toString(),
    type: e.type,
    content: e.content,
    embedding: e.embedding,   // may be undefined for pre-RAG entries
    metadata: {
      timestamp: e.timestamp instanceof Date ? e.timestamp.toISOString() : e.timestamp,
      relevanceScore: e.importance ?? 1.0,
      accessCount: e.accessCount ?? 0,
      lastAccessed: e.lastAccessed instanceof Date ? e.lastAccessed.toISOString() : e.lastAccessed,
    },
  };
}

/**
 * Cosine similarity between two equal-length numeric vectors.
 * Returns a value in [0, 1] (0 = orthogonal, 1 = identical direction).
 * Falls back to 0 when either vector is absent or lengths differ.
 */
function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── AgentMemory ──────────────────────────────────────────────────────────────

class AgentMemory {
  constructor(agentId, userId = 'default') {
    this.agentId = agentId;
    this.userId = userId;
    this.useDb = isValidObjectId(userId);

    // In-process fallback for unauthenticated / test scenarios
    this.localCache = new Map();

    this.initialized = false;
  }

  async initialize() {
    if (this.useDb) {
      // Verify the Mongoose connection is live; if not, downgrade gracefully
      if (mongoose.connection.readyState !== 1) {
        logger.warn(`Memory: MongoDB not connected for ${this.agentId}, using in-memory fallback`);
        this.useDb = false;
      }
    }
    this.initialized = true;
    logger.info(`Memory initialised for ${this.agentId} (user: ${this.userId}, storage: ${this.useDb ? 'mongodb' : 'in-memory'})`);
  }

  // ── Core store/retrieve ─────────────────────────────────────────────────────

  async storeMemory(type, content, metadata = {}) {
    if (!this.initialized) await this.initialize();

    if (this.useDb) {
      try {
        const isMongoTransient = (err) =>
          err.name === 'MongoNetworkError' ||
          err.name === 'MongoServerSelectionError' ||
          err.name === 'MongoNotConnectedError';

        const MemoryModel = getMemoryModel();
        const record = await withRetry(
          () => MemoryModel.getOrCreate(this.userId, this.agentId),
          { maxAttempts: 3, baseDelayMs: 200, maxDelayMs: 2000, retryOn: isMongoTransient }
        );
        await withRetry(
          () => record.addEntry(type, content, metadata.confidence ?? 0.5, metadata),
          { maxAttempts: 3, baseDelayMs: 200, maxDelayMs: 2000, retryOn: isMongoTransient }
        );

        // Fire-and-forget: generate embedding and attach it to the new entry.
        // Done after the save so the store never blocks on the embedding model.
        const entryId = record.entries[record.entries.length - 1]._id;
        setImmediate(async () => {
          try {
            const { getEmbedding } = require('./ollama');
            const embedding = await getEmbedding(null, content);
            if (Array.isArray(embedding) && embedding.length > 0) {
              await MemoryModel.updateOne(
                { _id: record._id, 'entries._id': entryId },
                { $set: { 'entries.$.embedding': embedding } }
              );
            }
          } catch (embErr) {
            // Best-effort — never block or fail a store because of embedding errors
          }
        });
        return;
      } catch (err) {
        // Permanently downgrade this instance to in-memory so store and fetch stay
        // consistent — mixing DB and local cache across calls leads to lost writes.
        logger.error(`Memory DB store error (downgrading to in-memory for this session): ${err.message}`);
        this.useDb = false;
      }
    }

    const entry = new MemoryEntry(type, content, metadata);
    this.localCache.set(entry.id, entry);
  }

  async getMemoriesByType(type, _isGlobal = false, limit = 10) {
    if (!this.initialized) await this.initialize();

    if (this.useDb) {
      try {
        const MemoryModel = getMemoryModel();
        const record = await MemoryModel.findOne({ userId: this.userId, agentId: this.agentId });
        if (!record) return [];
        return record.getRecentMemories(limit, type).map(mongoEntryToMemoryEntry);
      } catch (err) {
        logger.error(`Memory DB fetch error (downgrading to in-memory for this session): ${err.message}`);
        this.useDb = false;
        // Return empty rather than stale local cache whose entries weren't synced from DB
        return [];
      }
    }

    return Array.from(this.localCache.values())
      .filter(m => m.type === type)
      .sort((a, b) => new Date(b.metadata.timestamp) - new Date(a.metadata.timestamp))
      .slice(0, limit);
  }

  async searchMemories(query, limit = 5) {
    if (!this.initialized) await this.initialize();

    let allMemories;
    if (this.useDb) {
      allMemories = await this._getAllFromDb();
    } else {
      allMemories = Array.from(this.localCache.values());
    }

    // Attempt semantic (cosine) search via embeddings; fall back to word-overlap Jaccard.
    let queryEmbedding = null;
    try {
      const { getEmbedding } = require('./ollama');
      queryEmbedding = await getEmbedding(null, query);
      if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) queryEmbedding = null;
    } catch (_) {
      // Embedding model unavailable — Jaccard fallback is used below
    }

    const queryLower = query.toLowerCase();

    return allMemories
      .map(memory => {
        // Use cosine similarity when both query and stored embeddings exist,
        // otherwise fall back to the original word-overlap Jaccard metric.
        const similarity = (queryEmbedding && Array.isArray(memory.embedding) && memory.embedding.length > 0)
          ? cosineSimilarity(queryEmbedding, memory.embedding)
          : this.calculateSimilarity(queryLower, memory.content.toLowerCase());
        return { memory, similarity };
      })
      .filter(item => item.similarity > 0.1)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(item => {
        if (item.memory.updateAccess) item.memory.updateAccess();
        return item.memory;
      });
  }

  async _getAllFromDb() {
    try {
      const MemoryModel = getMemoryModel();
      const record = await MemoryModel.findOne({ userId: this.userId, agentId: this.agentId });
      if (!record) return [];
      return record.entries.map(mongoEntryToMemoryEntry);
    } catch (err) {
      logger.error(`Memory DB getAll error: ${err.message}`);
      return [];
    }
  }

  // ── Convenience methods ─────────────────────────────────────────────────────

  async getRecentContext(limit = 5) {
    return this.getMemoriesByType(MEMORY_TYPES.CONVERSATION, false, limit);
  }

  async getUserPreferences() {
    return this.getMemoriesByType(MEMORY_TYPES.PREFERENCE, false, 20);
  }

  async storeConversation(userMessage, agentResponse, context = {}) {
    await this.storeMemory(
      MEMORY_TYPES.CONVERSATION,
      JSON.stringify({ userMessage, agentResponse, context, timestamp: new Date().toISOString() }),
      { conversationId: context.conversationId || 'unknown' }
    );
  }

  async storePreference(preference, value, confidence = 0.8) {
    await this.storeMemory(
      MEMORY_TYPES.PREFERENCE,
      JSON.stringify({ preference, value }),
      { confidence }
    );
  }

  async storeFact(fact, source = 'conversation', confidence = 0.7) {
    await this.storeMemory(MEMORY_TYPES.FACT, fact, { source, confidence });
  }

  // ── Maintenance ─────────────────────────────────────────────────────────────

  async cleanupMemories() {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    if (this.useDb) {
      try {
        const MemoryModel = getMemoryModel();
        const record = await MemoryModel.findOne({ userId: this.userId, agentId: this.agentId });
        if (record) {
          const kept = record.entries.filter(
            e => e.timestamp > cutoff || e.importance >= 0.2
          );
          record.entries.splice(0, record.entries.length, ...kept);
          record.markModified('entries');
          await record.save();
        }
        logger.info(`Memory cleanup completed for ${this.agentId} (mongodb)`);
        return;
      } catch (err) {
        logger.error(`Memory cleanup DB error: ${err.message}`);
      }
    }

    // Local cleanup
    for (const [id, memory] of this.localCache) {
      const isOld = new Date(memory.metadata.timestamp) < cutoff;
      const isLowRelevance = memory.metadata.relevanceScore < 0.2;
      const isRarelyAccessed = memory.metadata.accessCount < 2;
      if (isOld && isLowRelevance && isRarelyAccessed) {
        this.localCache.delete(id);
      }
    }
    logger.info(`Memory cleanup completed for ${this.agentId} (in-memory)`);
  }

  // ── Utilities ───────────────────────────────────────────────────────────────

  calculateSimilarity(text1, text2) {
    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);
    let matches = 0;
    words1.forEach(word => {
      if (word.length > 2 && words2.includes(word)) matches++;
    });
    return matches / Math.max(words1.length, words2.length);
  }

  getMemoryStats() {
    return {
      userId: this.userId,
      agentId: this.agentId,
      storageType: this.useDb ? 'mongodb' : 'in-memory',
      localCacheSize: this.localCache.size,
    };
  }
}

module.exports = { AgentMemory, MemoryEntry, MEMORY_TYPES };
