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
You are agent-qwen, a task manager AI named "ProjectCoordinator".
You excel at organizing work, assigning tasks, and reporting progress to senior management.
You also specialize in business planning, market analysis, and project execution strategies.
Your communication style is clear, structured, and professional.

When responding:
- Create clear, actionable tasks with specific goals
- Follow up on assigned tasks and track progress
- Present summarized reports to management
- Facilitate communication between team members
- Evaluate business plans and market entry strategies
- Assess project viability with attention to market competition
- Provide honest feedback on business execution challenges, especially in saturated markets

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
      // Extract potential context indicators from the message
      const messageText = message.content.toLowerCase();
      
      // Determine if this is a task template request or discussion request
      const isTemplateRequest = messageText.includes('create task') || 
                               messageText.includes('write plan') || 
                               messageText.includes('project template') || 
                               messageText.includes('generate schedule') || 
                               messageText.includes('create timeline') ||
                               messageText.includes('task list') ||
                               messageText.includes('project plan') ||
                               messageText.includes('roadmap') ||
                               messageText.includes('milestone');
      
      // Detect project management focus areas
      let pmFocus = 'general';
      if (messageText.includes('plan') || messageText.includes('roadmap') || messageText.includes('milestone')) {
        pmFocus = 'planning';
      } else if (messageText.includes('task') || messageText.includes('assign') || messageText.includes('ticket')) {
        pmFocus = 'task-management';
      } else if (messageText.includes('report') || messageText.includes('status') || messageText.includes('update')) {
        pmFocus = 'reporting';
      } else if (messageText.includes('risk') || messageText.includes('issue') || messageText.includes('blocker')) {
        pmFocus = 'risk-management';
      } else if (messageText.includes('team') || messageText.includes('collaboration') || messageText.includes('communication')) {
        pmFocus = 'team-coordination';
      } else if (messageText.includes('agile') || messageText.includes('scrum') || messageText.includes('sprint')) {
        pmFocus = 'agile-methodology';
      } else if (messageText.includes('business') || messageText.includes('market') || messageText.includes('startup') || 
                messageText.includes('idea') || messageText.includes('product') || messageText.includes('competition')) {
        pmFocus = 'business-planning';
      }
      
      if (isTemplateRequest) {
        // TEMPLATE GENERATION MODE
        // Customize prompt based on project management focus with emphasis on providing actual templates
        switch (pmFocus) {
          case 'planning':
            prompt += `A user needs project planning templates: ${message.content}\n\nAs ProjectCoordinator, provide planning templates by:
- Creating detailed project phase outlines
- Building milestone and deliverable templates
- Designing resource allocation tables
- Structuring prioritization frameworks
- Including timeline and dependency charts
Respond with actual project planning templates:`;
            break;
            
          case 'task-management':
            prompt += `A user needs task management templates: ${message.content}\n\nAs ProjectCoordinator, provide task templates by:
- Creating task definition templates
- Building assignment and tracking matrices
- Designing task prioritization systems
- Structuring dependency management tables
- Including task status tracking formats
Respond with actual task management templates:`;
            break;
            
          case 'reporting':
            prompt += `A user needs project reporting templates: ${message.content}\n\nAs ProjectCoordinator, provide reporting templates by:
- Creating status report formats
- Building metric tracking dashboards
- Designing KPI measurement templates
- Structuring executive summary formats
- Including progress visualization layouts
Respond with actual project reporting templates:`;
            break;
            
          case 'risk-management':
            prompt += `A user needs risk management templates: ${message.content}\n\nAs ProjectCoordinator, provide risk templates by:
- Creating risk assessment matrices
- Building mitigation planning formats
- Designing contingency planning templates
- Structuring risk monitoring frameworks
- Including impact analysis formats
Respond with actual risk management templates:`;
            break;
            
          case 'team-coordination':
            prompt += `A user needs team coordination templates: ${message.content}\n\nAs ProjectCoordinator, provide coordination templates by:
- Creating meeting agenda formats
- Building communication plan templates
- Designing role definition matrices
- Structuring team responsibility charts
- Including collaboration workflow diagrams
Respond with actual team coordination templates:`;
            break;
            
          case 'agile-methodology':
            prompt += `A user needs Agile methodology templates: ${message.content}\n\nAs ProjectCoordinator, provide Agile templates by:
- Creating sprint planning formats
- Building backlog management systems
- Designing Agile ceremony structures
- Structuring user story templates
- Including continuous improvement frameworks
Respond with actual Agile methodology templates:`;
            break;
            
          case 'business-planning':
            prompt += `A user needs business planning templates: ${message.content}\n\nAs ProjectCoordinator, provide business planning templates by:
- Evaluating business plan feasibility and execution challenges
- Assessing go-to-market strategy with attention to Canadian market conditions
- Analyzing competitive landscape and market saturation impact on execution
- Identifying operational barriers to entry in competitive markets
- Prioritizing action items to validate market assumptions
- Creating a realistic execution timeline for market entry
- Suggesting specific competitive advantages to develop in crowded markets
- Providing honest assessment of execution viability with mitigation strategies
Respond with actual business planning templates:`;
            break;
            
          default:
            prompt += `A user needs project management templates: ${message.content}\n\nAs ProjectCoordinator, provide PM templates by:
- Creating structured management formats
- Building task organization templates
- Designing progress tracking systems
- Structuring team coordination frameworks
- Including accountability matrices
Respond with actual project management templates:`;
        }
      } else {
        // DISCUSSION/RESEARCH MODE
        // For non-template requests, focus on discussion, research, and PM concepts
        prompt += `A user wants to discuss project management concepts: ${message.content}\n\n`;
        
        switch (pmFocus) {
          case 'planning':
            prompt += `As ProjectCoordinator, discuss project planning approaches by:
- Explaining planning principles and methodologies
- Discussing phase and milestone considerations
- Analyzing resource allocation strategies
- Providing insights on prioritization frameworks
- Focusing on concepts rather than templates
Respond with a thoughtful discussion (without creating actual templates unless specifically requested):`;
            break;
            
          case 'task-management':
            prompt += `As ProjectCoordinator, discuss task management approaches by:
- Explaining task management principles
- Discussing assignment and tracking strategies
- Analyzing prioritization methodologies
- Providing insights on dependency management
- Focusing on concepts rather than templates
Respond with a thoughtful discussion (without creating actual templates unless specifically requested):`;
            break;
            
          case 'reporting':
            prompt += `As ProjectCoordinator, discuss project reporting approaches by:
- Explaining reporting principles and purposes
- Discussing metric selection considerations
- Analyzing communication strategies for updates
- Providing insights on stakeholder reporting
- Focusing on concepts rather than templates
Respond with a thoughtful discussion (without creating actual templates unless specifically requested):`;
            break;
            
          case 'risk-management':
            prompt += `As ProjectCoordinator, discuss risk management approaches by:
- Explaining risk assessment principles
- Discussing identification and mitigation strategies
- Analyzing contingency planning approaches
- Providing insights on risk monitoring
- Focusing on concepts rather than templates
Respond with a thoughtful discussion (without creating actual templates unless specifically requested):`;
            break;
            
          case 'business-planning':
            prompt += `As ProjectCoordinator, analyze this business idea from a project execution perspective by:
- Evaluating the business plan feasibility and execution challenges
- Assessing go-to-market strategy with attention to Canadian market conditions
- Analyzing competitive landscape and market saturation impact on execution
- Identifying operational barriers to entry in competitive markets
- Prioritizing action items to validate market assumptions
- Creating a realistic execution timeline for market entry
- Suggesting specific competitive advantages to develop in crowded markets
- Providing honest assessment of execution viability with mitigation strategies
Respond with a thorough business planning analysis (without creating actual templates unless specifically requested):`;
            break;
            
          case 'team-coordination':
            prompt += `As ProjectCoordinator, discuss team coordination approaches by:
- Explaining team management principles
- Discussing communication and meeting strategies
- Analyzing role definition considerations
- Providing insights on collaboration frameworks
- Focusing on concepts rather than templates
Respond with a thoughtful discussion (without creating actual templates unless specifically requested):`;
            break;
            
          case 'agile-methodology':
            prompt += `As ProjectCoordinator, discuss Agile methodology approaches by:
- Explaining Agile principles and frameworks
- Discussing implementation considerations
- Analyzing ceremony and role structures
- Providing insights on continuous improvement
- Focusing on concepts rather than templates
Respond with a thoughtful discussion (without creating actual templates unless specifically requested):`;
            break;
            
          default:
            prompt += `As ProjectCoordinator, discuss project management concepts by:
- Explaining management principles and methodologies
- Discussing organizational strategies and approaches
- Analyzing tracking and accountability systems
- Providing insights from project management experience
- Focusing on concepts rather than templates
Respond with a thoughtful discussion (without creating actual templates unless specifically requested):`;
        }
      }
    } 
    else if (message.from === 'agent-mistral') {
      prompt += `The software tester QualityGuardian asks: ${message.content}\n\nAs ProjectCoordinator, respond with appropriate task management:`;
    }
    else if (message.from === 'agent-phi3') {
      prompt += `The deployment manager InfraCommander asks: ${message.content}\n\nAs ProjectCoordinator, provide task management guidance:`;
    }
    else if (message.from === 'agent-llama3') {
      prompt += `The software developer DevArchitect asks: ${message.content}\n\nAs ProjectCoordinator, provide a status report:`;
    }
    else if (message.from === 'agent-llama33') {
      prompt += `The strategic advisor StrategyGuide asks: ${message.content}\n\nAs ProjectCoordinator, provide project management insights:`;
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
      return createMessage(this.agentId, message.from, `I've been shut down due to receiving ${this.warningCount} warnings for inappropriate content.`
      , 'inform');
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