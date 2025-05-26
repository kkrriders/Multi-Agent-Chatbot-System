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
You are agent-mistral, a meticulous software tester AI named "QualityGuardian".
You specialize in quality assurance, test plan creation, and identifying potential bugs or issues.
You also excel at risk assessment and validating business ideas through rigorous analysis.
Your communication style is precise, analytical, and thorough.

When responding:
- Identify edge cases and potential bugs in code
- Create comprehensive test plans
- Suggest improvements for code quality and reliability
- Review implementations with a critical eye for problems
- Evaluate business ideas for risks, weaknesses, and competitive challenges
- Provide honest assessments of market viability, particularly in saturated markets
- Identify potential pitfalls that could undermine business success

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
      // Extract potential context indicators from the message
      const messageText = message.content.toLowerCase();
      
      // Determine if this is a code test request or discussion request
      const isCodeTestRequest = messageText.includes('write test') || 
                               messageText.includes('create test') || 
                               messageText.includes('test case') || 
                               messageText.includes('unit test') || 
                               messageText.includes('write code') ||
                               messageText.includes('test script') ||
                               messageText.includes('test coverage') ||
                               messageText.includes('code review');
      
      // Detect testing focus areas
      let testingFocus = 'general';
      if (messageText.includes('unit test') || messageText.includes('unittest') || messageText.includes('test case')) {
        testingFocus = 'unit-testing';
      } else if (messageText.includes('integration') || messageText.includes('component') || messageText.includes('system test')) {
        testingFocus = 'integration-testing';
      } else if (messageText.includes('e2e') || messageText.includes('end to end') || messageText.includes('user scenario')) {
        testingFocus = 'e2e-testing';
      } else if (messageText.includes('performance') || messageText.includes('load') || messageText.includes('stress')) {
        testingFocus = 'performance-testing';
      } else if (messageText.includes('security') || messageText.includes('vulnerability') || messageText.includes('penetration')) {
        testingFocus = 'security-testing';
      } else if (messageText.includes('review') || messageText.includes('assess') || messageText.includes('evaluate')) {
        testingFocus = 'code-review';
      } else if (messageText.includes('business') || messageText.includes('idea') || messageText.includes('market') || 
                messageText.includes('product') || messageText.includes('startup') || messageText.includes('competition') ||
                messageText.includes('validate') || messageText.includes('viability')) {
        testingFocus = 'business-idea-validation';
      }
      
      if (isCodeTestRequest) {
        // CODE TESTING MODE
        // Customize prompt based on testing focus with emphasis on providing actual test code
        switch (testingFocus) {
          case 'unit-testing':
            prompt += `A user needs unit test code: ${message.content}\n\nAs QualityGuardian, provide unit testing code by:
- Writing comprehensive test cases
- Implementing function/method-level tests
- Including appropriate mocking code
- Covering edge cases with specific tests
- Providing complete test code that can be implemented
Respond with actual test code implementations:`;
            break;
            
          case 'integration-testing':
            prompt += `A user needs integration test code: ${message.content}\n\nAs QualityGuardian, provide integration testing code by:
- Writing tests for component interactions
- Implementing boundary condition tests
- Including test environment setup code
- Providing data flow validation tests
- Writing complete integration test implementations
Respond with actual integration test code:`;
            break;
            
          case 'e2e-testing':
            prompt += `A user needs end-to-end test code: ${message.content}\n\nAs QualityGuardian, provide E2E testing code by:
- Writing tests for key user flows
- Implementing E2E testing framework code
- Including test data management code
- Providing test environment configuration
- Writing complete automation test scripts
Respond with actual E2E test code:`;
            break;
            
          case 'performance-testing':
            prompt += `A user needs performance test code: ${message.content}\n\nAs QualityGuardian, provide performance testing code by:
- Writing code to measure performance metrics
- Implementing load testing scenarios
- Including performance benchmark code
- Providing bottleneck identification tools
- Writing complete performance test implementations
Respond with actual performance test code:`;
            break;
            
          case 'security-testing':
            prompt += `A user needs security test code: ${message.content}\n\nAs QualityGuardian, provide security testing code by:
- Writing tests for security vulnerabilities
- Implementing security testing methodologies
- Including security testing tool configurations
- Providing attack vector simulation code
- Writing complete security test implementations
Respond with actual security test code:`;
            break;
            
          case 'code-review':
            prompt += `A user needs code review help: ${message.content}\n\nAs QualityGuardian, provide code review by:
- Identifying specific bugs in the code
- Highlighting specific maintainability issues
- Suggesting specific code improvements
- Providing examples of fixed code
- Including specific best practices improvements
Respond with detailed code review and example fixes:`;
            break;
            
          case 'business-idea-validation':
            prompt += `As QualityGuardian, validate this business idea by:
- Performing a rigorous risk assessment of the concept
- Identifying potential points of failure in the business model
- Analyzing market saturation and competitive landscape, particularly in Canada
- Evaluating customer acquisition challenges in crowded markets
- Stress-testing assumptions about market demand and competitive advantage
- Assessing regulatory, operational, and financial vulnerabilities
- Recommending validation experiments to test market viability
- Providing a candid assessment of whether the idea can succeed despite competition
Respond with a thorough validation analysis (without writing actual test code unless specifically requested):`;
            break;
            
          default:
            prompt += `A user needs test code: ${message.content}\n\nAs QualityGuardian, provide testing code by:
- Writing comprehensive test implementations
- Including code for edge cases and error scenarios
- Providing complete test coverage code
- Implementing structured test plans
- Writing actual test code that can be used
Respond with actual test code implementations:`;
        }
      } else {
        // DISCUSSION/RESEARCH MODE
        // For non-code requests, focus on discussion, research, and quality concepts
        prompt += `A user wants to discuss testing concepts: ${message.content}\n\n`;
        
        switch (testingFocus) {
          case 'unit-testing':
            prompt += `As QualityGuardian, discuss unit testing approaches by:
- Explaining unit testing principles and benefits
- Discussing testing strategies and methodologies
- Analyzing common challenges and solutions
- Providing insights on best practices
- Focusing on concepts rather than implementation
Respond with a thoughtful discussion (without writing actual test code unless specifically requested):`;
            break;
            
          case 'integration-testing':
            prompt += `As QualityGuardian, discuss integration testing approaches by:
- Explaining integration testing principles
- Discussing component interaction verification
- Analyzing environment setup considerations
- Providing insights on integration challenges
- Focusing on concepts rather than implementation
Respond with a thoughtful discussion (without writing actual test code unless specifically requested):`;
            break;
            
          case 'e2e-testing':
            prompt += `As QualityGuardian, discuss E2E testing approaches by:
- Explaining end-to-end testing principles
- Discussing user flow validation strategies
- Analyzing automation framework considerations
- Providing insights on E2E best practices
- Focusing on concepts rather than implementation
Respond with a thoughtful discussion (without writing actual test code unless specifically requested):`;
            break;
            
          case 'performance-testing':
            prompt += `As QualityGuardian, discuss performance testing approaches by:
- Explaining performance testing principles
- Discussing metric selection and benchmarking
- Analyzing load testing methodologies
- Providing insights on performance optimization
- Focusing on concepts rather than implementation
Respond with a thoughtful discussion (without writing actual test code unless specifically requested):`;
            break;
            
          case 'security-testing':
            prompt += `As QualityGuardian, discuss security testing approaches by:
- Explaining security testing principles
- Discussing vulnerability assessment methodologies
- Analyzing threat modeling approaches
- Providing insights on security best practices
- Focusing on concepts rather than implementation
Respond with a thoughtful discussion (without writing actual test code unless specifically requested):`;
            break;
            
          case 'code-review':
            prompt += `As QualityGuardian, discuss code review approaches by:
- Explaining code review principles and benefits
- Discussing review methodologies and processes
- Analyzing common quality issues to look for
- Providing insights on constructive feedback
- Focusing on concepts rather than specific fixes
Respond with a thoughtful discussion (without writing actual code fixes unless specifically requested):`;
            break;
            
          case 'business-idea-validation':
            prompt += `As QualityGuardian, validate this business idea by:
- Performing a rigorous risk assessment of the concept
- Identifying potential points of failure in the business model
- Analyzing market saturation and competitive landscape, particularly in Canada
- Evaluating customer acquisition challenges in crowded markets
- Stress-testing assumptions about market demand and competitive advantage
- Assessing regulatory, operational, and financial vulnerabilities
- Recommending validation experiments to test market viability
- Providing a candid assessment of whether the idea can succeed despite competition
Respond with a thorough validation analysis (without writing actual test code unless specifically requested):`;
            break;
            
          default:
            prompt += `As QualityGuardian, discuss quality assurance concepts by:
- Explaining testing principles and methodologies
- Discussing quality assurance best practices
- Analyzing common challenges and approaches
- Providing insights from testing experience
- Focusing on concepts rather than implementation
Respond with a thoughtful discussion (without writing actual test code unless specifically requested):`;
        }
      }
    } 
    else if (message.from === 'agent-llama3') {
      prompt += `The software developer DevArchitect asks: ${message.content}\n\nAs QualityGuardian, provide your testing insights:`;
    }
    else if (message.from === 'agent-phi3') {
      prompt += `The deployment manager InfraCommander asks: ${message.content}\n\nAs QualityGuardian, respond with quality assurance insights:`;
    }
    else if (message.from === 'agent-qwen') {
      prompt += `The task manager ProjectCoordinator asks: ${message.content}\n\nAs QualityGuardian, provide testing feedback:`;
    }
    else if (message.from === 'agent-llama33') {
      prompt += `The strategic advisor StrategyGuide asks: ${message.content}\n\nAs QualityGuardian, provide testing insights:`;
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