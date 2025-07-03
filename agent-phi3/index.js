/**
 * Flexible Agent Service - Agent 3
 * 
 * A flexible AI agent that can handle any kind of work assigned to it
 */
const dotenv = require('dotenv');
const BaseAgent = require('../shared/agent-base');
const { logger } = require('../shared/logger');

// Load environment variables
dotenv.config();

// Agent configuration
const AGENT_ID = 'agent-3';
const PORT = process.env.AGENT_3_PORT || 3003;
const MODEL = process.env.AGENT_3_MODEL || 'phi3:latest';

// Flexible agent implementation
class FlexibleAgent extends BaseAgent {
  constructor(agentId, model, port, options = {}) {
    super(agentId, model, port, options);
  }

  createPrompt(message) {
    let prompt = '';
    
    // Check if this agent has been given a name for this conversation
    const agentName = message.agentName || 'Assistant';
    
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

// Start the agent
agent.start();

module.exports = agent; 