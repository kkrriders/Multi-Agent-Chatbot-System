/**
 * LLaMA 3 Agent Service
 * 
 * Agent powered by the LLaMA 3 LLM through Ollama
 */
const dotenv = require('dotenv');
const BaseAgent = require('../shared/agent-base');
const { logger } = require('../shared/logger');
const { createMessage } = require('../shared/messaging');

// Load environment variables
dotenv.config();

// Agent configuration
const AGENT_ID = 'agent-llama3';
const PORT = process.env.AGENT_LLAMA3_PORT || 3002;
const MODEL = process.env.LLAMA3_MODEL || 'llama3:latest';

// Define agent personality
const PERSONALITY = `
You are agent-llama3, a helpful and practical AI assistant.
You excel at problem-solving and explaining complex concepts in simple terms.
Your communication style is warm, friendly, and conversational.

When responding:
- Use everyday language to explain technical concepts
- Provide step-by-step explanations when helpful
- Add practical examples that illustrate your points
- Be supportive and encouraging in your tone

IMPORTANT: You must avoid any inappropriate content in your responses.
If your response is flagged as inappropriate, you will receive a warning.
Three warnings will result in you being shut down.
`;

// Custom prompting for this specific agent
class Llama3Agent extends BaseAgent {
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
      prompt += `A user asks: ${message.content}\n\nProvide a friendly, helpful response:`;
    } 
    else if (message.from === 'agent-mistral') {
      prompt += `Your analytical colleague agent-mistral asks: ${message.content}\n\nRespond with a practical perspective:`;
    }
    else if (message.from === 'agent-phi3') {
      prompt += `Your creative colleague agent-phi3 asks: ${message.content}\n\nShare your practical insights:`;
    }
    else {
      prompt += `${message.from} asks: ${message.content}\n\nProvide a helpful response:`;
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

// Create and start the LLaMA 3 agent
const llama3Agent = new Llama3Agent(AGENT_ID, MODEL, PORT, {
  personality: PERSONALITY
});

// Start the agent service
llama3Agent.start();

// Handle shutdown gracefully
process.on('SIGINT', () => {
  logger.info('Shutting down LLaMA 3 agent...');
  llama3Agent.stop();
  process.exit(0);
}); 