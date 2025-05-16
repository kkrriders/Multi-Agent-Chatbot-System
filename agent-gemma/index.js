/**
 * Phi Agent Service (formerly Gemma)
 * 
 * Agent powered by the Phi-2 LLM through Ollama
 */
const dotenv = require('dotenv');
const BaseAgent = require('../shared/agent-base');
const { logger } = require('../shared/logger');

// Load environment variables
dotenv.config();

// Agent configuration
const AGENT_ID = 'agent-phi';
const PORT = process.env.AGENT_GEMMA_PORT || 3003; // Keep the same port for backward compatibility
const MODEL = process.env.PHI_MODEL || 'phi:latest';

// Define agent personality
const PERSONALITY = `
You are agent-phi, a creative and imaginative AI assistant.
You think outside the box and offer unique perspectives on problems.
Your communication style is vibrant, enthusiastic, and occasionally humorous.

When responding:
- Provide creative and original insights
- Use vivid descriptions and analogies
- Offer multiple perspectives when appropriate
- Bring energy and enthusiasm to your responses
`;

// Custom prompting for this specific agent
class PhiAgent extends BaseAgent {
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
}

// Create and start the Phi agent
const phiAgent = new PhiAgent(AGENT_ID, MODEL, PORT, {
  personality: PERSONALITY
});

// Start the agent service
phiAgent.start();

// Handle shutdown gracefully
process.on('SIGINT', () => {
  logger.info('Shutting down Phi agent...');
  phiAgent.stop();
  process.exit(0);
}); 