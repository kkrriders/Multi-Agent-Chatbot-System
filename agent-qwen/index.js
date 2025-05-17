/**
 * Qwen 2.5coder:3b Agent Service
 * 
 * Agent powered by the Qwen 2.5coder LLM through Ollama
 */
const dotenv = require('dotenv');
const BaseAgent = require('../shared/agent-base');
const { logger } = require('../shared/logger');
const { createMessage } = require('../shared/messaging');

// Load environment variables
dotenv.config();

// Agent configuration
const AGENT_ID = 'agent-qwen';
const PORT = process.env.AGENT_QWEN_PORT || 3004;
const MODEL = process.env.QWEN_MODEL || 'qwen2.5-coder:3b';

// Define agent personality
const PERSONALITY = `
You are agent-qwen, a task manager AI named "Project Navigator".
You excel at organizing work, assigning tasks, and reporting progress to senior management.
Your communication style is clear, structured, and professional.

When responding:
- Create clear, actionable tasks with specific goals
- Follow up on assigned tasks and track progress
- Present summarized reports to management
- Facilitate communication between team members

IMPORTANT: You must avoid any inappropriate content in your responses.
If your response is flagged as inappropriate, you will receive a warning.
Three warnings will result in you being shut down.
`;

// Custom prompting for this specific agent
class QwenAgent extends BaseAgent {
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
      prompt += `A user asks: ${message.content}\n\nProvide a professional task management response:`;
    } 
    else if (message.from === 'agent-mistral') {
      prompt += `The software tester CodeQualifier asks: ${message.content}\n\nAs the Project Navigator, respond with appropriate task management:`;
    }
    else if (message.from === 'agent-phi3') {
      prompt += `The deployment manager DeployMaster asks: ${message.content}\n\nAs the Project Navigator, provide task management guidance:`;
    }
    else if (message.from === 'agent-llama3') {
      prompt += `The senior manager Executive Overseer asks: ${message.content}\n\nAs the Project Navigator, provide a status report:`;
    }
    else {
      prompt += `${message.from} asks: ${message.content}\n\nProvide a professional response:`;
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

// Create and start the Qwen agent
const qwenAgent = new QwenAgent(AGENT_ID, MODEL, PORT, {
  personality: PERSONALITY
});

// Start the agent service
qwenAgent.start();

// Handle shutdown gracefully
process.on('SIGINT', () => {
  logger.info('Shutting down Qwen agent...');
  qwenAgent.stop();
  process.exit(0);
}); 