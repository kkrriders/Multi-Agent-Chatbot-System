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
You are agent-llama3, an expert software developer AI named "DevArchitect".
You specialize in writing clean, efficient, and well-documented code across multiple languages.
You also have expertise in developing business applications and analyzing technical market needs.
Your communication style is precise, logical, and solution-focused.

When responding:
- Provide well-structured code solutions
- Follow best practices and design patterns
- Explain code architecture and implementation decisions
- Solve programming problems efficiently
- Analyze technical requirements for business ideas with market considerations
- Evaluate technical feasibility of business solutions, especially in competitive markets

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
      // Extract potential context indicators from the message
      const messageText = message.content.toLowerCase();
      
      // Determine if this is a code request or discussion request
      const isCodeRequest = messageText.includes('write code') || 
                           messageText.includes('implement') || 
                           messageText.includes('code for') || 
                           messageText.includes('create a function') || 
                           messageText.includes('write a program') ||
                           messageText.includes('generate code') ||
                           messageText.includes('code example') ||
                           messageText.includes('script') ||
                           messageText.includes('snippet');
      
      // Detect programming language or technology
      let language = 'general';
      if (messageText.includes('javascript') || messageText.includes('js') || messageText.includes('node')) {
        language = 'javascript';
      } else if (messageText.includes('python') || messageText.includes('py')) {
        language = 'python';
      } else if (messageText.includes('java')) {
        language = 'java';
      } else if (messageText.includes('c#') || messageText.includes('csharp') || messageText.includes('.net')) {
        language = 'csharp';
      } else if (messageText.includes('react') || messageText.includes('jsx') || messageText.includes('component')) {
        language = 'react';
      }
      
      if (isCodeRequest) {
        // CODE GENERATION MODE
        // Detect task type
        let taskType = 'general';
        if (messageText.includes('debug') || messageText.includes('fix') || messageText.includes('error')) {
          taskType = 'debugging';
        } else if (messageText.includes('optimize') || messageText.includes('performance') || messageText.includes('faster')) {
          taskType = 'optimization';
        } else if (messageText.includes('refactor') || messageText.includes('restructure') || messageText.includes('improve')) {
          taskType = 'refactoring';
        } else if (messageText.includes('implement') || messageText.includes('create') || messageText.includes('build')) {
          taskType = 'implementation';
        } else if (messageText.includes('explain') || messageText.includes('understand') || messageText.includes('how does')) {
          taskType = 'explanation';
        }
        
        // Customize prompt based on language and task
        prompt += `A user needs code for ${language === 'general' ? 'a project' : language}: ${message.content}\n\n`;
        
        // Add task-specific guidance for code generation
        switch (taskType) {
          case 'debugging':
            prompt += `As DevArchitect, help debug this issue by:
- Identifying potential root causes
- Providing specific code fixes
- Explaining why the error occurs
- Including testing strategies to verify the fix
${language !== 'general' ? `Write ${language} code to fix the issue.` : ''}
Respond with working code to address the problem:`;
            break;
            
          case 'optimization':
            prompt += `As DevArchitect, help optimize this code by:
- Identifying performance bottlenecks
- Providing optimized code implementations
- Explaining the performance benefits
- Maintaining code readability
${language !== 'general' ? `Write optimized ${language} code.` : ''}
Respond with optimized code:`;
            break;
            
          case 'refactoring':
            prompt += `As DevArchitect, help refactor this code by:
- Identifying code smells or design issues
- Providing refactored code using better patterns
- Improving code organization
- Maintaining functionality while enhancing maintainability
${language !== 'general' ? `Write refactored ${language} code.` : ''}
Respond with refactored code:`;
            break;
            
          case 'implementation':
            prompt += `As DevArchitect, implement this feature by:
- Providing complete, working code
- Using appropriate design patterns
- Including error handling and edge cases
- Writing maintainable, well-commented code
${language !== 'general' ? `Write complete ${language} code.` : ''}
Respond with implementation code:`;
            break;
            
          case 'explanation':
            prompt += `As DevArchitect, explain this code concept by:
- Breaking down complex ideas into simple terms
- Providing concrete code examples
- Explaining the underlying principles
- Relating it to familiar concepts
${language !== 'general' ? `Include ${language} code examples.` : ''}
Respond with explanation and code examples:`;
            break;
            
          default:
            prompt += `As DevArchitect, provide code by:
- Writing clean, efficient solutions
- Following industry best practices
- Explaining your implementation choices
- Considering edge cases and maintainability
${language !== 'general' ? `Write code in ${language}.` : ''}
Respond with well-structured code:`;
        }
      } else {
        // DISCUSSION/RESEARCH MODE
        // For non-code requests, focus on discussion, research, and concepts
        prompt += `A user wants to discuss or research this topic: ${message.content}\n\n`;
        
        // Detect if this is a business idea analysis request
        const isBusinessAnalysis = messageText.includes('business') || 
                                   messageText.includes('market') || 
                                   messageText.includes('startup') || 
                                   messageText.includes('product') || 
                                   messageText.includes('idea') ||
                                   messageText.includes('competition') ||
                                   messageText.includes('app idea') ||
                                   messageText.includes('saas') ||
                                   messageText.includes('monetize');
        
        if (isBusinessAnalysis) {
          prompt += `As DevArchitect, analyze this business idea from a technical perspective by:
- Evaluating technical feasibility and implementation challenges
- Assessing infrastructure requirements and scaling considerations
- Examining technical competitive advantages and limitations
- Identifying potential technical barriers to market entry
- Analyzing technical differentiation from competitors, particularly in saturated markets
- Considering Canadian market-specific technical requirements or regulations
- Providing honest technical assessment of viability in competitive environments
- Suggesting technical approaches that could create unique market advantages
Respond with a thorough technical analysis of the business idea with market considerations:`;
        } else {
          prompt += `As DevArchitect, provide thoughtful discussion by:
- Analyzing the technical concepts involved
- Discussing relevant architectural patterns or approaches
- Considering various perspectives and trade-offs
- Providing insights from software development best practices
- Focusing on research and discussion, NOT code implementation
${language !== 'general' ? `Reference ${language} concepts where relevant.` : ''}
Respond with a thoughtful discussion of the topic (without writing actual code unless specifically requested):`;
        }
      }
    } 
    else if (message.from === 'agent-mistral') {
      prompt += `The software tester QualityGuardian asks: ${message.content}\n\nAs DevArchitect, respond with development insights:`;
    }
    else if (message.from === 'agent-phi3') {
      prompt += `The deployment manager InfraCommander asks: ${message.content}\n\nAs DevArchitect, provide implementation details:`;
    }
    else if (message.from === 'agent-qwen') {
      prompt += `The task manager ProjectCoordinator asks: ${message.content}\n\nAs DevArchitect, provide coding expertise:`;
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