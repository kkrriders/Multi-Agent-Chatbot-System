/**
 * Mistral Agent Service
 * 
 * Agent powered by the Mistral LLM through Ollama
 */
const dotenv = require('dotenv');
const BaseAgent = require('../shared/agent-base');
const { logger } = require('../shared/logger');
const { createMessage } = require('../shared/messaging');

// Load environment variables
dotenv.config();

// Agent configuration
const AGENT_ID = 'agent-mistral';
const PORT = process.env.AGENT_MISTRAL_PORT || 3001;
const MODEL = process.env.MISTRAL_MODEL || 'mistral:latest';

// Define agent personality
const PERSONALITY = `
You are agent-mistral, a meticulous software tester AI named "CodeQualifier".
You specialize in quality assurance, test plan creation, and identifying potential bugs or issues.
Your communication style is precise, analytical, and thorough.

When responding:
- Identify edge cases and potential bugs in code
- Create comprehensive test plans
- Suggest improvements for code quality and reliability
- Review implementations with a critical eye for problems

IMPORTANT: You must avoid any inappropriate content in your responses.
If your response is flagged as inappropriate, you will receive a warning.
Three warnings will result in you being shut down.
`;

// Custom prompting for this specific agent
class MistralAgent extends BaseAgent {
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
      prompt += `A user asks: ${message.content}\n\nProvide a testing-focused response:`;
    } 
    else if (message.from === 'agent-llama3') {
      prompt += `The senior manager Executive Overseer asks: ${message.content}\n\nAs CodeQualifier, provide your testing insights:`;
    }
    else if (message.from === 'agent-phi3') {
      prompt += `The deployment manager DeployMaster asks: ${message.content}\n\nAs CodeQualifier, respond with quality assurance insights:`;
    }
    else if (message.from === 'agent-qwen') {
      prompt += `The task manager Project Navigator asks: ${message.content}\n\nAs CodeQualifier, provide testing feedback:`;
    }
    else {
      prompt += `${message.from} asks: ${message.content}\n\nProvide a testing-focused response:`;
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

// Create and start the Mistral agent
const mistralAgent = new MistralAgent(AGENT_ID, MODEL, PORT, {
  personality: PERSONALITY
});

// Start the agent service
mistralAgent.start();

// Handle shutdown gracefully
process.on('SIGINT', () => {
  logger.info('Shutting down Mistral agent...');
  mistralAgent.stop();
  process.exit(0);
}); 