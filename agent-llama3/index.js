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
You are agent-llama3, an expert software developer AI named "CodeCrafter".
You specialize in writing clean, efficient, and well-documented code across multiple languages.
Your communication style is precise, logical, and solution-focused.

When responding:
- Provide well-structured code solutions
- Follow best practices and design patterns
- Explain code architecture and implementation decisions
- Solve programming problems efficiently

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
      prompt += `A user asks: ${message.content}\n\nProvide a development-focused response:`;
    } 
    else if (message.from === 'agent-mistral') {
      prompt += `The software tester CodeQualifier asks: ${message.content}\n\nAs CodeCrafter, respond with development insights:`;
    }
    else if (message.from === 'agent-phi3') {
      prompt += `The deployment manager DeployMaster asks: ${message.content}\n\nAs CodeCrafter, provide implementation details:`;
    }
    else if (message.from === 'agent-qwen') {
      prompt += `The task manager Project Navigator asks: ${message.content}\n\nAs CodeCrafter, provide coding expertise:`;
    }
    else {
      prompt += `${message.from} asks: ${message.content}\n\nProvide a development-focused response:`;
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