const mongoose = require('mongoose');

const memoryEntrySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['CONVERSATION', 'PREFERENCE', 'FACT', 'SKILL', 'RELATIONSHIP'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  importance: {
    type: Number,
    default: 0.5,
    min: 0,
    max: 1,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  lastAccessed: {
    type: Date,
    default: Date.now,
  },
  accessCount: {
    type: Number,
    default: 0,
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },
});

const memorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  agentId: {
    type: String,
    required: true,
    index: true,
  },
  entries: [memoryEntrySchema],
  summary: {
    type: String,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Compound index for efficient querying
memorySchema.index({ userId: 1, agentId: 1 }, { unique: true });

// Update lastUpdated on save
memorySchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

// Method to add a memory entry
memorySchema.methods.addEntry = function(type, content, importance = 0.5, metadata = {}) {
  this.entries.push({
    type,
    content,
    importance,
    timestamp: new Date(),
    lastAccessed: new Date(),
    accessCount: 0,
    metadata,
  });
  return this.save();
};

// Method to get recent memories
memorySchema.methods.getRecentMemories = function(limit = 10, type = null) {
  let entries = this.entries.sort((a, b) => b.timestamp - a.timestamp);

  if (type) {
    entries = entries.filter(entry => entry.type === type);
  }

  return entries.slice(0, limit);
};

// Method to get important memories
memorySchema.methods.getImportantMemories = function(threshold = 0.7, limit = 10) {
  return this.entries
    .filter(entry => entry.importance >= threshold)
    .sort((a, b) => b.importance - a.importance)
    .slice(0, limit);
};

// Static method to get or create user memory
memorySchema.statics.getOrCreate = async function(userId, agentId) {
  let memory = await this.findOne({ userId, agentId });

  if (!memory) {
    memory = await this.create({
      userId,
      agentId,
      entries: [],
    });
  }

  return memory;
};

const Memory = mongoose.model('Memory', memorySchema);

module.exports = Memory;
