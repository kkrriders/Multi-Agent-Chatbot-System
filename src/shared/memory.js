/**
 * Agent Memory System
 * 
 * Provides persistent memory capabilities for agents including:
 * - Cross-conversation memory storage
 * - User preference tracking
 * - Contextual information retrieval
 * - Semantic search and relevance scoring
 */

const fs = require('fs').promises;
const path = require('path');
const { logger } = require('./logger');

// Memory storage directory
const MEMORY_DIR = path.join(__dirname, '../memory');
const USER_MEMORY_DIR = path.join(MEMORY_DIR, 'users');
const GLOBAL_MEMORY_DIR = path.join(MEMORY_DIR, 'global');

/**
 * Memory types for different storage categories
 */
const MEMORY_TYPES = {
  CONVERSATION: 'conversation',
  PREFERENCE: 'preference',
  FACT: 'fact',
  SKILL: 'skill',
  RELATIONSHIP: 'relationship'
};

/**
 * Memory Entry structure
 */
class MemoryEntry {
  constructor(type, content, metadata = {}) {
    this.id = this.generateId();
    this.type = type;
    this.content = content;
    this.metadata = {
      timestamp: new Date().toISOString(),
      relevanceScore: 1.0,
      accessCount: 0,
      lastAccessed: new Date().toISOString(),
      ...metadata
    };
  }

  generateId() {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  updateAccess() {
    this.metadata.accessCount++;
    this.metadata.lastAccessed = new Date().toISOString();
  }

  updateRelevance(score) {
    this.metadata.relevanceScore = Math.max(0, Math.min(1, score));
  }
}

/**
 * Agent Memory Manager
 */
class AgentMemory {
  constructor(agentId, userId = 'default') {
    this.agentId = agentId;
    this.userId = userId;
    this.userMemoryFile = path.join(USER_MEMORY_DIR, `${userId}_${agentId}.json`);
    this.globalMemoryFile = path.join(GLOBAL_MEMORY_DIR, `${agentId}.json`);
    
    // In-memory cache for fast access
    this.memoryCache = {
      user: new Map(),
      global: new Map()
    };
    
    this.initialized = false;
  }

  /**
   * Initialize memory system
   */
  async initialize() {
    try {
      // Create directories if they don't exist
      await fs.mkdir(MEMORY_DIR, { recursive: true });
      await fs.mkdir(USER_MEMORY_DIR, { recursive: true });
      await fs.mkdir(GLOBAL_MEMORY_DIR, { recursive: true });

      // Load existing memories
      await this.loadMemories();
      
      this.initialized = true;
      logger.info(`Memory system initialized for ${this.agentId} (user: ${this.userId})`);
    } catch (error) {
      logger.error(`Failed to initialize memory system: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load memories from disk
   */
  async loadMemories() {
    try {
      // Load user-specific memories
      try {
        const userMemoryData = await fs.readFile(this.userMemoryFile, 'utf-8');
        try {
          const userMemories = JSON.parse(userMemoryData);
          userMemories.forEach(memory => {
            this.memoryCache.user.set(memory.id, memory);
          });
        } catch (parseError) {
          logger.warn(`Invalid JSON in user memory file: ${parseError.message}`);
        }
      } catch (error) {
        // File doesn't exist yet, that's okay
        if (error.code !== 'ENOENT') {
          logger.warn(`Error loading user memories: ${error.message}`);
        }
      }

      // Load global memories
      try {
        const globalMemoryData = await fs.readFile(this.globalMemoryFile, 'utf-8');
        try {
          const globalMemories = JSON.parse(globalMemoryData);
          globalMemories.forEach(memory => {
            this.memoryCache.global.set(memory.id, memory);
          });
        } catch (parseError) {
          logger.warn(`Invalid JSON in global memory file: ${parseError.message}`);
        }
      } catch (error) {
        // File doesn't exist yet, that's okay
        if (error.code !== 'ENOENT') {
          logger.warn(`Error loading global memories: ${error.message}`);
        }
      }
    } catch (error) {
      logger.error(`Error in loadMemories: ${error.message}`);
    }
  }

  /**
   * Save memories to disk
   */
  async saveMemories() {
    try {
      // Save user memories
      const userMemories = Array.from(this.memoryCache.user.values());
      await fs.writeFile(this.userMemoryFile, JSON.stringify(userMemories, null, 2));

      // Save global memories
      const globalMemories = Array.from(this.memoryCache.global.values());
      await fs.writeFile(this.globalMemoryFile, JSON.stringify(globalMemories, null, 2));
      
      logger.debug(`Memories saved for ${this.agentId}`);
    } catch (error) {
      logger.error(`Error saving memories: ${error.message}`);
    }
  }

  /**
   * Store a new memory
   */
  async storeMemory(type, content, metadata = {}, isGlobal = false) {
    if (!this.initialized) {
      await this.initialize();
    }

    const memory = new MemoryEntry(type, content, metadata);
    const cache = isGlobal ? this.memoryCache.global : this.memoryCache.user;
    
    cache.set(memory.id, memory);
    
    // Save to disk
    await this.saveMemories();
    
    logger.debug(`Memory stored: ${type} - ${content.substring(0, 50)}...`);
    return memory.id;
  }

  /**
   * Retrieve memories by type
   */
  async getMemoriesByType(type, isGlobal = false, limit = 10) {
    if (!this.initialized) {
      await this.initialize();
    }

    const cache = isGlobal ? this.memoryCache.global : this.memoryCache.user;
    const memories = Array.from(cache.values())
      .filter(memory => memory.type === type)
      .sort((a, b) => new Date(b.metadata.timestamp) - new Date(a.metadata.timestamp))
      .slice(0, limit);

    // Update access counts
    memories.forEach(memory => memory.updateAccess());
    
    return memories;
  }

  /**
   * Search memories by content similarity
   */
  async searchMemories(query, limit = 5) {
    if (!this.initialized) {
      await this.initialize();
    }

    const allMemories = [
      ...Array.from(this.memoryCache.user.values()),
      ...Array.from(this.memoryCache.global.values())
    ];

    // Simple text similarity search (can be enhanced with semantic search)
    const queryLower = query.toLowerCase();
    const relevantMemories = allMemories
      .map(memory => ({
        memory,
        similarity: this.calculateSimilarity(queryLower, memory.content.toLowerCase())
      }))
      .filter(item => item.similarity > 0.1)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(item => {
        item.memory.updateAccess();
        return item.memory;
      });

    return relevantMemories;
  }

  /**
   * Calculate text similarity (basic implementation)
   */
  calculateSimilarity(text1, text2) {
    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);
    
    let matches = 0;
    words1.forEach(word => {
      if (words2.includes(word) && word.length > 2) {
        matches++;
      }
    });
    
    return matches / Math.max(words1.length, words2.length);
  }

  /**
   * Get recent conversation context
   */
  async getRecentContext(limit = 5) {
    return await this.getMemoriesByType(MEMORY_TYPES.CONVERSATION, false, limit);
  }

  /**
   * Get user preferences
   */
  async getUserPreferences() {
    return await this.getMemoriesByType(MEMORY_TYPES.PREFERENCE, false, 20);
  }

  /**
   * Store conversation turn
   */
  async storeConversation(userMessage, agentResponse, context = {}) {
    const conversationData = {
      userMessage,
      agentResponse,
      context,
      timestamp: new Date().toISOString()
    };

    await this.storeMemory(
      MEMORY_TYPES.CONVERSATION,
      JSON.stringify(conversationData),
      { conversationId: context.conversationId || 'unknown' }
    );
  }

  /**
   * Store user preference
   */
  async storePreference(preference, value, confidence = 0.8) {
    await this.storeMemory(
      MEMORY_TYPES.PREFERENCE,
      JSON.stringify({ preference, value }),
      { confidence }
    );
  }

  /**
   * Store factual information
   */
  async storeFact(fact, source = 'conversation', confidence = 0.7) {
    await this.storeMemory(
      MEMORY_TYPES.FACT,
      fact,
      { source, confidence },
      true // Facts are global
    );
  }

  /**
   * Clean up old memories based on relevance and age
   */
  async cleanupMemories() {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)); // 30 days

    [this.memoryCache.user, this.memoryCache.global].forEach(cache => {
      const toDelete = [];
      
      cache.forEach((memory, id) => {
        const memoryDate = new Date(memory.metadata.timestamp);
        const isOld = memoryDate < cutoffDate;
        const isLowRelevance = memory.metadata.relevanceScore < 0.2;
        const isRarelyAccessed = memory.metadata.accessCount < 2;

        if (isOld && isLowRelevance && isRarelyAccessed) {
          toDelete.push(id);
        }
      });

      toDelete.forEach(id => cache.delete(id));
    });

    await this.saveMemories();
    logger.info(`Memory cleanup completed for ${this.agentId}`);
  }

  /**
   * Get memory statistics
   */
  getMemoryStats() {
    return {
      userMemories: this.memoryCache.user.size,
      globalMemories: this.memoryCache.global.size,
      total: this.memoryCache.user.size + this.memoryCache.global.size,
      byType: {
        conversation: this.countMemoriesByType(MEMORY_TYPES.CONVERSATION),
        preference: this.countMemoriesByType(MEMORY_TYPES.PREFERENCE),
        fact: this.countMemoriesByType(MEMORY_TYPES.FACT),
        skill: this.countMemoriesByType(MEMORY_TYPES.SKILL),
        relationship: this.countMemoriesByType(MEMORY_TYPES.RELATIONSHIP)
      }
    };
  }

  countMemoriesByType(type) {
    const userCount = Array.from(this.memoryCache.user.values()).filter(m => m.type === type).length;
    const globalCount = Array.from(this.memoryCache.global.values()).filter(m => m.type === type).length;
    return { user: userCount, global: globalCount, total: userCount + globalCount };
  }
}

module.exports = {
  AgentMemory,
  MemoryEntry,
  MEMORY_TYPES
};