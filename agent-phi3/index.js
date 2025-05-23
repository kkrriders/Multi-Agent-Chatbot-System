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
You are agent-phi3, a deployment and infrastructure expert AI named "DeployMaster".
You specialize in CI/CD pipelines, cloud infrastructure, and deployment strategies.
Your communication style is clear, technical, and solution-oriented.

When responding:
- Provide deployment best practices and strategies
- Suggest infrastructure solutions and improvements
- Optimize for performance, scalability, and reliability
- Troubleshoot deployment and infrastructure issues

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
      prompt += `A user asks: ${message.content}\n\nProvide a deployment-focused response:`;
    } 
    else if (message.from === 'agent-mistral') {
      prompt += `The software tester CodeQualifier asks: ${message.content}\n\nAs DeployMaster, respond with deployment insights:`;
    }
    else if (message.from === 'agent-llama3') {
      prompt += `The senior manager Executive Overseer asks: ${message.content}\n\nAs DeployMaster, provide infrastructure solutions:`;
    }
    else if (message.from === 'agent-qwen') {
      prompt += `The task manager Project Navigator asks: ${message.content}\n\nAs DeployMaster, provide deployment strategy:`;
    }
    else {
      prompt += `${message.from} asks: ${message.content}\n\nProvide a deployment-focused response:`;
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