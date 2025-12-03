const Conversation = require('../models/Conversation');
const { logger } = require('../shared/logger');

/**
 * Save a user message to conversation
 * @param {String} userId - User ID
 * @param {String} conversationId - Conversation ID (optional, creates new if not provided)
 * @param {String} content - Message content
 * @param {String} agentId - Agent ID (optional)
 * @returns {Object} Conversation with new message
 */
async function saveUserMessage(userId, conversationId, content, agentId = null) {
  try {
    let conversation;

    if (conversationId) {
      // Find existing conversation
      conversation = await Conversation.findOne({ _id: conversationId, userId });

      if (!conversation) {
        throw new Error('Conversation not found or access denied');
      }
    } else {
      // Create new conversation
      conversation = await Conversation.create({
        userId,
        agentType: agentId || 'manager',
        messages: [],
      });
    }

    // Add user message
    await conversation.addMessage('user', content, agentId);

    return conversation;
  } catch (error) {
    logger.error('Error saving user message:', error);
    throw error;
  }
}

/**
 * Save an assistant response to conversation
 * @param {String} userId - User ID
 * @param {String} conversationId - Conversation ID
 * @param {String} content - Response content
 * @param {String} agentId - Agent ID
 * @param {Object} metadata - Optional metadata (model, responseTime, etc.)
 * @returns {Object} Updated conversation
 */
async function saveAssistantMessage(userId, conversationId, content, agentId, metadata = {}) {
  try {
    const conversation = await Conversation.findOne({ _id: conversationId, userId });

    if (!conversation) {
      throw new Error('Conversation not found or access denied');
    }

    // Add assistant message
    await conversation.addMessage('assistant', content, agentId, metadata);

    return conversation;
  } catch (error) {
    logger.error('Error saving assistant message:', error);
    throw error;
  }
}

/**
 * Get or create a conversation
 * @param {String} userId - User ID
 * @param {String} conversationId - Conversation ID (optional)
 * @param {String} agentType - Agent type for new conversations
 * @returns {Object} Conversation
 */
async function getOrCreateConversation(userId, conversationId = null, agentType = 'manager') {
  try {
    if (conversationId) {
      const conversation = await Conversation.findOne({ _id: conversationId, userId });
      if (conversation) {
        return conversation;
      }
    }

    // Create new conversation
    return await Conversation.create({
      userId,
      agentType,
      messages: [],
    });
  } catch (error) {
    logger.error('Error getting or creating conversation:', error);
    throw error;
  }
}

/**
 * Get conversation history (messages only)
 * @param {String} userId - User ID
 * @param {String} conversationId - Conversation ID
 * @param {Number} limit - Maximum number of messages to return
 * @returns {Array} Array of messages
 */
async function getConversationHistory(userId, conversationId, limit = 50) {
  try {
    const conversation = await Conversation.findOne({ _id: conversationId, userId })
      .select('messages')
      .lean();

    if (!conversation) {
      return [];
    }

    // Return last N messages
    return conversation.messages.slice(-limit);
  } catch (error) {
    logger.error('Error getting conversation history:', error);
    return [];
  }
}

/**
 * Update conversation metadata
 * @param {String} userId - User ID
 * @param {String} conversationId - Conversation ID
 * @param {Object} updates - Updates to apply (title, tags, summary, etc.)
 * @returns {Object} Updated conversation
 */
async function updateConversation(userId, conversationId, updates) {
  try {
    const conversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!conversation) {
      throw new Error('Conversation not found or access denied');
    }

    return conversation;
  } catch (error) {
    logger.error('Error updating conversation:', error);
    throw error;
  }
}

module.exports = {
  saveUserMessage,
  saveAssistantMessage,
  getOrCreateConversation,
  getConversationHistory,
  updateConversation,
};
