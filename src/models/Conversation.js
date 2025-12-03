const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  agentId: {
    type: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  metadata: {
    model: String,
    responseTime: Number,
    confidence: Number,
  },
});

const conversationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  title: {
    type: String,
    default: 'New Conversation',
    trim: true,
  },
  messages: [messageSchema],
  agentType: {
    type: String,
    enum: ['manager', 'agent-1', 'agent-2', 'agent-3', 'agent-4'],
    default: 'manager',
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active',
  },
  summary: {
    type: String,
  },
  tags: [{
    type: String,
    trim: true,
  }],
  metadata: {
    totalMessages: {
      type: Number,
      default: 0,
    },
    lastMessageAt: {
      type: Date,
    },
    averageResponseTime: {
      type: Number,
    },
  },
  pdfExports: [{
    createdAt: {
      type: Date,
      default: Date.now,
    },
    fileName: String,
    fileSize: Number,
    data: Buffer, // Store PDF as binary data
    mimeType: {
      type: String,
      default: 'application/pdf',
    },
  }],
}, {
  timestamps: true,
});

// Index for efficient querying
conversationSchema.index({ userId: 1, createdAt: -1 });
conversationSchema.index({ userId: 1, status: 1 });

// Update metadata before saving
conversationSchema.pre('save', function(next) {
  if (this.messages && this.messages.length > 0) {
    this.metadata.totalMessages = this.messages.length;
    const lastMessage = this.messages[this.messages.length - 1];
    this.metadata.lastMessageAt = lastMessage.timestamp;

    // Auto-generate title from first user message if not set
    if (this.title === 'New Conversation' && this.messages.length > 0) {
      const firstUserMessage = this.messages.find(msg => msg.role === 'user');
      if (firstUserMessage) {
        this.title = firstUserMessage.content.substring(0, 50) +
                    (firstUserMessage.content.length > 50 ? '...' : '');
      }
    }
  }
  next();
});

// Method to add a message
conversationSchema.methods.addMessage = function(role, content, agentId = null, metadata = {}) {
  this.messages.push({
    role,
    content,
    agentId,
    timestamp: new Date(),
    metadata,
  });
  return this.save();
};

// Static method to get user's conversations
conversationSchema.statics.getUserConversations = function(userId, status = 'active', limit = 50) {
  return this.find({ userId, status })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select('-messages') // Exclude messages for list view
    .lean();
};

// Static method to get conversation with messages
conversationSchema.statics.getConversationById = function(conversationId, userId) {
  return this.findOne({ _id: conversationId, userId })
    .lean();
};

// Method to add tags
conversationSchema.methods.addTags = function(tags) {
  const newTags = Array.isArray(tags) ? tags : [tags];
  const uniqueTags = [...new Set([...this.tags, ...newTags])];
  this.tags = uniqueTags.map(tag => tag.toLowerCase().trim());
  return this.save();
};

// Method to remove tags
conversationSchema.methods.removeTags = function(tags) {
  const tagsToRemove = Array.isArray(tags) ? tags : [tags];
  const normalizedTags = tagsToRemove.map(tag => tag.toLowerCase().trim());
  this.tags = this.tags.filter(tag => !normalizedTags.includes(tag));
  return this.save();
};

// Static method to get all unique tags for a user
conversationSchema.statics.getUserTags = async function(userId) {
  const conversations = await this.find({ userId, status: { $ne: 'deleted' } })
    .select('tags')
    .lean();

  const allTags = conversations.reduce((acc, conv) => {
    return [...acc, ...conv.tags];
  }, []);

  const uniqueTags = [...new Set(allTags)];

  // Count occurrences
  const tagCounts = uniqueTags.map(tag => ({
    tag,
    count: allTags.filter(t => t === tag).length
  })).sort((a, b) => b.count - a.count);

  return tagCounts;
};

// Static method to search conversations by tags
conversationSchema.statics.findByTags = function(userId, tags, status = 'active') {
  const searchTags = Array.isArray(tags) ? tags : [tags];
  const normalizedTags = searchTags.map(tag => tag.toLowerCase().trim());

  return this.find({
    userId,
    status,
    tags: { $in: normalizedTags }
  })
    .sort({ updatedAt: -1 })
    .select('-messages')
    .lean();
};

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
