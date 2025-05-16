/**
 * Content moderation utility for agent messages
 */
const flaggedWords = require('./badwords');
const { moderateWithLLM } = require('./ollama');
const { logFlaggedContent } = require('./logger');
const axios = require('axios');

/**
 * Rule-based moderation using a dictionary of flagged words
 * 
 * @param {string} content - Content to check
 * @returns {Object} - Result with flagged status and reason if flagged
 */
function moderateWithRules(content) {
  if (!content || typeof content !== 'string') {
    return { 
      flagged: false,
      reason: null 
    };
  }

  const contentLower = content.toLowerCase();
  const foundWords = [];

  // Check for each flagged word
  for (const word of flaggedWords) {
    // Simple word boundary check
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(contentLower)) {
      foundWords.push(word);
    }
  }

  if (foundWords.length > 0) {
    return {
      flagged: true,
      reason: `Contains flagged word(s): ${foundWords.join(', ')}`
    };
  }

  return {
    flagged: false,
    reason: null
  };
}

/**
 * Combined moderation approach using both rule-based and LLM-based methods
 * 
 * @param {string} content - Content to moderate
 * @param {string} model - LLM model to use for moderation if needed
 * @param {boolean} useLLM - Whether to also use LLM-based moderation
 * @returns {Promise<Object>} - Moderation result
 */
async function moderateContent(content, model, useLLM = true) {
  // First check with rule-based approach (fast)
  const ruleCheck = moderateWithRules(content);
  
  if (ruleCheck.flagged) {
    return ruleCheck;
  }

  // If rule-based check passes and LLM check is enabled, use LLM
  if (useLLM) {
    try {
      const isLLMFlagged = await moderateWithLLM(model, content);
      
      if (isLLMFlagged) {
        return {
          flagged: true,
          reason: 'LLM detected potentially inappropriate content'
        };
      }
    } catch (error) {
      console.error('Error in LLM moderation:', error.message);
      // Changed to fail-open strategy: If LLM moderation fails, assume content is safe
      console.warn('LLM moderation failed; continuing with content unflagged');
    }
  }

  return {
    flagged: false,
    reason: null
  };
}

/**
 * Issues a warning to an agent for inappropriate content
 *
 * @param {string} agentId - ID of the agent to warn
 * @returns {Promise<number>} - The current warning count after incrementing
 */
async function issueWarningToAgent(agentId) {
  try {
    const agentPort = getAgentPort(agentId);
    if (!agentPort) {
      throw new Error(`Unknown agent ID: ${agentId}`);
    }

    const response = await axios.post(`http://localhost:${agentPort}/warning`, {});
    return response.data.warningCount;
  } catch (error) {
    console.error(`Failed to issue warning to ${agentId}:`, error.message);
    return -1; // Unable to issue warning
  }
}

/**
 * Get the port number for a given agent ID
 * 
 * @param {string} agentId - The agent ID
 * @returns {number|null} - Port number or null if not found
 */
function getAgentPort(agentId) {
  switch (agentId) {
    case 'agent-mistral':
      return process.env.AGENT_MISTRAL_PORT || 3001;
    case 'agent-llama3':
      return process.env.AGENT_LLAMA3_PORT || 3002;
    case 'agent-phi3':
      return process.env.AGENT_PHI3_PORT || 3003;
    default:
      return null;
  }
}

/**
 * Moderate a message and log if it's flagged
 * 
 * @param {Object} message - Message to moderate
 * @param {string} model - LLM model to use
 * @param {boolean} useLLM - Whether to use LLM-based moderation
 * @returns {Promise<Object>} - Moderation result with the message
 */
async function moderateMessage(message, model, useLLM = true) {
  const content = message.content;
  const moderationResult = await moderateContent(content, model, useLLM);
  
  if (moderationResult.flagged) {
    // Log the flagged content
    logFlaggedContent(message, moderationResult.reason);
    
    // Issue a warning to the agent if it's not the user
    if (message.from !== 'user') {
      const warningCount = await issueWarningToAgent(message.from);
      moderationResult.warningCount = warningCount;
      moderationResult.agentShutDown = warningCount >= 3;
    }
  }
  
  return {
    message,
    ...moderationResult
  };
}

module.exports = {
  moderateWithRules,
  moderateContent,
  moderateMessage,
  issueWarningToAgent
}; 