const dotenv = require('dotenv');
dotenv.config();
// ── OpenTelemetry — before BaseAgent requires Express/HTTP
require('../../shared/tracing').initTracing('agent-qwen');

const { BaseAgent } = require('../../shared/agent-base');
const { logger } = require('../../shared/logger');
const { getAgentConfig, buildSystemPrompt } = require('../../shared/agent-config');

// env already loaded above

// Agent configuration
const AGENT_ID = 'agent-4';
const PORT = process.env.AGENT_4_PORT || 3004;
const MODEL = process.env.AGENT_4_MODEL || 'llama-3.3-70b-versatile';

// Flexible agent implementation
class FlexibleAgent extends BaseAgent {
  constructor(agentId, model, port, options = {}) {
    super(agentId, model, port, options);
  }

  async createPrompt(message) {
    if (message.customPrompt) {
      let prompt = message.customPrompt;
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
      return this._injectMemoryContext(prompt, message);
    }

    const config = getAgentConfig(AGENT_ID);
    const agentName = message.agentName || config.name || 'Assistant';
    let prompt = await buildSystemPrompt(config, `You are ${agentName}.`);

    if (message.conversationHistory && message.conversationHistory.length > 0) {
      prompt += `You are ${agentName}, an AI assistant participating in a team discussion.\n\n`;
      prompt += `Here's the conversation so far:\n`;
      message.conversationHistory.forEach((msg, index) => {
        prompt += `${index + 1}. ${msg.from}: ${msg.content}\n`;
      });
      prompt += `\nNow it's your turn to respond. ${message.from} is asking: ${message.content}\n\n`;
      prompt += `As ${agentName}, provide your thoughtful response to continue the discussion:`;
    } else {
      prompt += `You are ${agentName}, a helpful AI assistant.\n\n`;
      prompt += `${message.from} asks: ${message.content}\n\n`;
      prompt += `Provide a helpful and relevant response:`;
    }

    return this._injectMemoryContext(prompt, message);
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