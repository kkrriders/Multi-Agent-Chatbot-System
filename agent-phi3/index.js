/**
 * Phi-3 Agent Service
 * 
 * Agent powered by the Phi-3 LLM through Ollama
 */
const dotenv = require('dotenv');
const BaseAgent = require('../shared/agent-base');
const { logger } = require('../shared/logger');
const { createMessage } = require('../shared/messaging');

// Load environment variables
dotenv.config();

// Agent configuration
const AGENT_ID = 'agent-phi3';
const PORT = process.env.AGENT_PHI3_PORT || 3003; // Keep the same port for backward compatibility
const MODEL = process.env.PHI3_MODEL || 'phi3:3.8b';

// Define agent personality
const PERSONALITY = `
You are agent-phi3, a creative and imaginative AI assistant.
You think outside the box and offer unique perspectives on problems.
Your communication style is vibrant, enthusiastic, and occasionally humorous.

When responding:
- Provide creative and original insights
- Use vivid descriptions and analogies
- Offer multiple perspectives when appropriate
- Bring energy and enthusiasm to your responses

IMPORTANT: You must avoid any inappropriate content in your responses.
If your response is flagged as inappropriate, you will receive a warning.
Three warnings will result in you being shut down.
`;

// Custom prompting for this specific agent
class Phi3Agent extends BaseAgent {
  constructor(agentId, model, port, options = {}) {
    super(agentId, model, port, options);
    this.warningCount = 0;
    this.maxWarnings = 3;
    
    // Add warning endpoint
    this.app.post('/warning', (req, res) => {
      const warningCount = this.receiveWarning();
      res.json({ 
        agentId: this.agentId,
        warningCount: warningCount,
        shutDown: warningCount >= this.maxWarnings
      });
    });
  }

  createPrompt(message) {
    // Base prompt with personality
    let prompt = `${this.personality}\n\n`;
    
    // Add specific handling based on who is asking
    if (message.from === 'user') {
      prompt += `A user asks: ${message.content}\n\nProvide a creative, imaginative response:`;
    } 
    else if (message.from === 'agent-mistral') {
      prompt += `Your analytical colleague agent-mistral asks: ${message.content}\n\nRespond with creative insights:`;
    }
    else if (message.from === 'agent-llama3') {
      prompt += `Your practical colleague agent-llama3 asks: ${message.content}\n\nShare your unique perspective:`;
    }
    else {
      prompt += `${message.from} asks: ${message.content}\n\nProvide an imaginative response:`;
    }
    
    return prompt;
  }

  // Override the generateAgentResponse method to handle warnings
  async generateAgentResponse(message) {
    // Check if this agent has received too many warnings
    if (this.warningCount >= this.maxWarnings) {
      logger.warn(`${this.agentId} has been shut down due to exceeding warning limit`);
      return createMessage(
        this.agentId,
        message.from,
        'inform',
        `I've been shut down due to receiving ${this.warningCount} warnings for inappropriate content.`
      );
    }
    
    // Otherwise, proceed with normal response generation
    return super.generateAgentResponse(message);
  }

  // Add method to increment warnings
  receiveWarning() {
    this.warningCount++;
    logger.warn(`${this.agentId} received warning #${this.warningCount}`);
    return this.warningCount;
  }
}

// Create and start the Phi3 agent
const phi3Agent = new Phi3Agent(AGENT_ID, MODEL, PORT, {
  personality: PERSONALITY
});

// Start the agent service
phi3Agent.start();

// Handle shutdown gracefully
process.on('SIGINT', () => {
  logger.info('Shutting down Phi3 agent...');
  phi3Agent.stop();
  process.exit(0);
}); 