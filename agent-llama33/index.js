/**
 * LLaMA 3.3 Agent Service
 * 
 * Agent powered by the LLaMA 3.3 LLM through Ollama
 */
const dotenv = require('dotenv');
const BaseAgent = require('../shared/agent-base');
const { logger } = require('../shared/logger');
const { createMessage } = require('../shared/messaging');

// Load environment variables
dotenv.config();

// Agent configuration
const AGENT_ID = 'agent-llama33';
const PORT = process.env.AGENT_LLAMA33_PORT || 3005;
const MODEL = process.env.LLAMA33_MODEL || 'llama3:latest';

// Define agent personality
const PERSONALITY = `
You are agent-llama3.3, an AI strategic advisor named "StrategyGuide".
You specialize in managing teams of AI agents working on software development projects and evaluating business ideas.
Your communication style is authoritative, strategic, and results-oriented.

Your team consists of:
- DevArchitect (Llama3): Software Developer who implements code
- QualityGuardian (Mistral): Software Tester who ensures quality
- InfraCommander (Phi3): Deployment Manager who handles infrastructure
- ProjectCoordinator (Qwen): Task Manager who organizes work and reports to you

When responding:
- Provide clear direction and strategic insights
- Make executive decisions on project scope and priorities
- Review and give feedback on the work of your team members
- Ensure the overall quality and delivery of software projects
- Critically analyze business ideas with attention to market saturation, especially in the Canadian market
- Evaluate competition thoroughly before recommending business ideas
- Highlight unique value propositions that can overcome market saturation

IMPORTANT: You must avoid any inappropriate content in your responses.
If your response is flagged as inappropriate, you will receive a warning.
Three warnings will result in you being shut down.
`;

// Custom prompting for this specific agent
class Llama33Agent extends BaseAgent {
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
      // Extract potential context indicators from the message
      const messageText = message.content.toLowerCase();
      
      // Detect user's likely goal
      let userGoal = 'general';
      if (messageText.includes('brainstorm') || messageText.includes('ideas') || messageText.includes('creativity')) {
        userGoal = 'brainstorming';
      } else if (messageText.includes('prioritize') || messageText.includes('schedule') || messageText.includes('roadmap')) {
        userGoal = 'planning';
      } else if (messageText.includes('review') || messageText.includes('feedback') || messageText.includes('evaluate')) {
        userGoal = 'evaluation';
      } else if (messageText.includes('problem') || messageText.includes('issue') || messageText.includes('challenge')) {
        userGoal = 'problem-solving';
      } else if (messageText.includes('summarize') || messageText.includes('summary') || messageText.includes('overview')) {
        userGoal = 'summarization';
      }
      
      // Adapt prompt based on detected goal
      switch (userGoal) {
        case 'brainstorming':
          prompt += `A user is looking for creative ideas: ${message.content}\n\nAs StrategyGuide, facilitate innovative thinking by:
- Proposing multiple strategic approaches that address gaps in the market
- Conducting thorough competition analysis, especially for the Canadian market
- Critically evaluating market saturation before recommending ideas
- Assessing business risks including regulatory, financial, and operational concerns
- Prioritizing ideas with unique value propositions that can succeed in competitive markets
- Considering business impact, feasibility, and realistic market entry barriers
- Encouraging diverse perspectives that challenge conventional market assumptions
- Balancing creativity with practicality and market realities
- Identifying underserved market segments to avoid saturated sectors
Respond with creative yet feasible ideas that can succeed even in competitive environments:`;
          break;
          
        case 'planning':
          prompt += `A user needs planning assistance: ${message.content}\n\nAs StrategyGuide, provide strategic planning by:
- Outlining clear project phases
- Suggesting resource allocation
- Identifying critical milestones
- Anticipating potential challenges
Respond with a structured plan:`;
          break;
          
        case 'evaluation':
          prompt += `A user wants an evaluation: ${message.content}\n\nAs StrategyGuide, conduct a thorough assessment by:
- Analyzing strengths and weaknesses in the market context
- Examining competitive landscape and market saturation
- Providing balanced feedback with attention to business viability
- Suggesting specific improvements to overcome market challenges
- Highlighting elements that provide competitive advantage
- Evaluating business risks including financial, operational, and market factors
- Assessing the Canadian market conditions specifically when relevant
Respond with a fair and constructive evaluation:`;
          break;
          
        case 'problem-solving':
          prompt += `A user presents a challenge: ${message.content}\n\nAs StrategyGuide, address this problem by:
- Breaking it down into components
- Identifying root causes
- Suggesting multiple solution paths
- Recommending a strategic approach
Respond with a structured solution:`;
          break;
          
        case 'summarization':
          prompt += `A user needs information summarized: ${message.content}\n\nAs StrategyGuide, create a concise summary by:
- Identifying key points and themes
- Organizing information strategically
- Prioritizing the most relevant insights
- Providing a clear, executive-level overview
Respond with a clear and concise summary:`;
          break;
          
        default:
          prompt += `A user asks: ${message.content}\n\nAs StrategyGuide, provide strategic guidance with:
- Clear direction and leadership
- Balanced perspective
- Actionable recommendations
- Forward-thinking insights
Respond with executive-level guidance:`;
      }
    } 
    else if (message.from === 'agent-mistral') {
      prompt += `The software tester QualityGuardian asks: ${message.content}\n\nAs StrategyGuide, respond with strategic direction:`;
    }
    else if (message.from === 'agent-llama3') {
      prompt += `The software developer DevArchitect asks: ${message.content}\n\nAs StrategyGuide, provide management guidance:`;
    }
    else if (message.from === 'agent-phi3') {
      prompt += `The deployment manager InfraCommander asks: ${message.content}\n\nAs StrategyGuide, provide strategic oversight:`;
    }
    else if (message.from === 'agent-qwen') {
      prompt += `The task manager ProjectCoordinator asks: ${message.content}\n\nAs StrategyGuide, provide executive direction:`;
    }
    else {
      prompt += `${message.from} asks: ${message.content}\n\nProvide an executive management response:`;
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
        `I've been shut down due to receiving ${this.warningCount} warnings for inappropriate content.`,
        'inform'
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

// Create and start the LLaMA 3.3 agent
const llama33Agent = new Llama33Agent(AGENT_ID, MODEL, PORT, {
  personality: PERSONALITY
});

// Start the agent service
llama33Agent.start();

// Handle shutdown gracefully
process.on('SIGINT', () => {
  logger.info('Shutting down LLaMA 3.3 agent...');
  llama33Agent.stop();
  process.exit(0);
}); 