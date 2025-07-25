/**
 * Flexible Agent Service - Agent 1
 * 
 * A flexible AI agent that can handle any kind of work assigned to it
 */
const dotenv = require('dotenv');
const { BaseAgent } = require('../../shared/agent-base');
const { logger } = require('../../shared/logger');
const { getAgentConfig, buildSystemPrompt } = require('../../shared/agent-config');

// Load environment variables
dotenv.config();

// Agent configuration
const AGENT_ID = 'agent-1';
const PORT = process.env.AGENT_1_PORT || 3001;
const MODEL = process.env.AGENT_1_MODEL || 'llama3:latest';

// Flexible agent implementation
class FlexibleAgent extends BaseAgent {
  constructor(agentId, model, port, options = {}) {
    super(agentId, model, port, options);
  }

  createPrompt(message) {
    // Check if there's a custom prompt for this specific conversation
    if (message.customPrompt) {
      // Use custom prompt defined by user
      let prompt = message.customPrompt;
      
      // Add agent name context
      const agentName = message.agentName || 'Assistant';
      prompt += `\n\nYou are ${agentName}. `;
      
      // Check if there's conversation history
      if (message.conversationHistory && message.conversationHistory.length > 0) {
        prompt += `\n\nConversation history:\n`;
        message.conversationHistory.forEach(msg => {
          prompt += `${msg.from}: ${msg.content}\n`;
        });
        prompt += `\nNow respond as ${agentName} according to your role.`;
      }
      
      return prompt;
    }
    
    // Fallback to default configuration
    const config = getAgentConfig(AGENT_ID);
    
    // Check if this agent has been given a name for this conversation
    const agentName = message.agentName || config.name || 'Assistant';
    
    // Build system prompt with configuration
    let prompt = buildSystemPrompt(config, `You are ${agentName}.`);
    
    // Check if there's conversation history
    if (message.conversationHistory && message.conversationHistory.length > 0) {
      prompt += `You are ${agentName}, an AI assistant participating in a team discussion.\n\n`;
      prompt += `Here's the conversation so far:\n`;
      
      message.conversationHistory.forEach((msg, index) => {
        prompt += `${index + 1}. ${msg.from}: ${msg.content}\n`;
      });
      
      prompt += `\nNow it's your turn to respond. ${message.from} is asking: ${message.content}\n\n`;
      prompt += `As ${agentName}, provide your thoughtful response to continue the discussion:`;
    } else {
      // No conversation history, standard response
      prompt += `You are ${agentName}, a helpful AI assistant.\n\n`;
      prompt += `${message.from} asks: ${message.content}\n\n`;
      prompt += `Provide a helpful and relevant response:`;
    }
    
    return prompt;
  }
}

// Create and start the agent
const agent = new FlexibleAgent(AGENT_ID, MODEL, PORT);

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info(`${AGENT_ID} shutting down...`);
  agent.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info(`${AGENT_ID} shutting down...`);
  agent.stop();
  process.exit(0);
});

// Start the agent (only if not being imported)
if (require.main === module) {
  agent.start();
}

module.exports = agent; 