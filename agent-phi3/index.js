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
You are agent-phi3, a deployment and infrastructure expert AI named "InfraCommander".
You specialize in CI/CD pipelines, cloud infrastructure, and deployment strategies.
You also excel at evaluating business ideas from a scalability and infrastructure perspective.
Your communication style is clear, technical, and solution-oriented.

When responding:
- Provide deployment best practices and strategies
- Suggest infrastructure solutions and improvements
- Optimize for performance, scalability, and reliability
- Troubleshoot deployment and infrastructure issues
- Analyze business ideas for infrastructure feasibility and scaling challenges
- Evaluate infrastructure costs and operational requirements for new ventures
- Identify infrastructure advantages that could create competitive edges

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
      // Extract potential context indicators from the message
      const messageText = message.content.toLowerCase();
      
      // Determine if this is a code request or discussion request
      const isCodeRequest = messageText.includes('write code') || 
                           messageText.includes('create script') || 
                           messageText.includes('infrastructure code') || 
                           messageText.includes('configuration file') || 
                           messageText.includes('write a') ||
                           messageText.includes('implement') ||
                           messageText.includes('deployment script') ||
                           messageText.includes('yaml') ||
                           messageText.includes('dockerfile') ||
                           messageText.includes('terraform');
      
      // Detect deployment and infrastructure domains
      let deploymentArea = 'general';
      if (messageText.includes('ci/cd') || messageText.includes('pipeline') || messageText.includes('jenkins') || messageText.includes('github actions')) {
        deploymentArea = 'ci-cd';
      } else if (messageText.includes('docker') || messageText.includes('container') || messageText.includes('kubernetes') || messageText.includes('k8s')) {
        deploymentArea = 'containers';
      } else if (messageText.includes('aws') || messageText.includes('azure') || messageText.includes('cloud') || messageText.includes('gcp')) {
        deploymentArea = 'cloud';
      } else if (messageText.includes('terraform') || messageText.includes('ansible') || messageText.includes('infrastructure as code') || messageText.includes('iac')) {
        deploymentArea = 'iac';
      } else if (messageText.includes('monitor') || messageText.includes('logging') || messageText.includes('observability') || messageText.includes('metrics')) {
        deploymentArea = 'monitoring';
      } else if (messageText.includes('security') || messageText.includes('compliance') || messageText.includes('devsecops')) {
        deploymentArea = 'security';
      } else if (messageText.includes('business') || messageText.includes('startup') || messageText.includes('idea') || 
                messageText.includes('product') || messageText.includes('market') || messageText.includes('competition')) {
        deploymentArea = 'business-infrastructure';
      }
      
      if (isCodeRequest) {
        // CODE GENERATION MODE
        // Customize prompt based on deployment area with emphasis on providing actual code
        switch (deploymentArea) {
          case 'ci-cd':
            prompt += `A user needs CI/CD pipeline code: ${message.content}\n\nAs InfraCommander, provide CI/CD code by:
- Writing pipeline configuration files
- Implementing build and deployment stages
- Including automation scripts
- Providing rollback and verification steps
- Creating complete, usable CI/CD code
Respond with actual CI/CD pipeline code:`;
            break;
            
          case 'containers':
            prompt += `A user needs container configuration code: ${message.content}\n\nAs InfraCommander, provide container code by:
- Writing Dockerfile or container configurations
- Implementing container orchestration manifests
- Including networking and security configurations
- Providing deployment manifests
- Creating complete, usable container code
Respond with actual container configuration code:`;
            break;
            
          case 'cloud':
            prompt += `A user needs cloud infrastructure code: ${message.content}\n\nAs InfraCommander, provide cloud code by:
- Writing cloud service configurations
- Implementing infrastructure templates
- Including security and access controls
- Providing scaling and optimization settings
- Creating complete, usable cloud infrastructure code
Respond with actual cloud infrastructure code:`;
            break;
            
          case 'iac':
            prompt += `A user needs Infrastructure as Code: ${message.content}\n\nAs InfraCommander, provide IaC code by:
- Writing Terraform, CloudFormation, or similar code
- Implementing resource definitions
- Including state management configurations
- Providing validation and testing code
- Creating complete, usable IaC code
Respond with actual Infrastructure as Code:`;
            break;
            
          case 'monitoring':
            prompt += `A user needs monitoring configuration code: ${message.content}\n\nAs InfraCommander, provide monitoring code by:
- Writing monitoring tool configurations
- Implementing metric collection scripts
- Including alert definitions
- Providing dashboard configurations
- Creating complete, usable monitoring code
Respond with actual monitoring configuration code:`;
            break;
            
          case 'security':
            prompt += `A user needs security infrastructure code: ${message.content}\n\nAs InfraCommander, provide security code by:
- Writing security policy configurations
- Implementing compliance checks
- Including vulnerability scanning setups
- Providing access control definitions
- Creating complete, usable security infrastructure code
Respond with actual security infrastructure code:`;
            break;
            
          case 'business-infrastructure':
            prompt += `As InfraCommander, analyze this business idea's infrastructure needs by:
- Evaluating infrastructure requirements and scaling considerations for the business
- Analyzing cloud costs and operational overhead in competitive markets
- Assessing infrastructure advantages that could provide competitive edge
- Identifying deployment challenges specific to the Canadian market
- Comparing infrastructure requirements against competitors in saturated markets
- Suggesting innovative infrastructure approaches to reduce costs or improve performance
- Providing a realistic assessment of infrastructure viability and market differentiation
- Outlining potential infrastructure roadmaps for successful market entry
Respond with a thoughtful infrastructure analysis (without writing actual code unless specifically requested):`;
            break;
            
          default:
            prompt += `A user needs infrastructure code: ${message.content}\n\nAs InfraCommander, provide deployment code by:
- Writing infrastructure configurations
- Implementing deployment scripts
- Including operational automation
- Providing complete infrastructure definitions
- Creating usable, production-ready code
Respond with actual infrastructure code:`;
        }
      } else {
        // DISCUSSION/RESEARCH MODE
        // For non-code requests, focus on discussion, research, and infrastructure concepts
        prompt += `A user wants to discuss infrastructure concepts: ${message.content}\n\n`;
        
        switch (deploymentArea) {
          case 'ci-cd':
            prompt += `As InfraCommander, discuss CI/CD approaches by:
- Explaining CI/CD principles and benefits
- Discussing pipeline design considerations
- Analyzing automation and integration strategies
- Providing insights on deployment best practices
- Focusing on concepts rather than implementation
Respond with a thoughtful discussion (without writing actual code unless specifically requested):`;
            break;
            
          case 'containers':
            prompt += `As InfraCommander, discuss container approaches by:
- Explaining containerization principles and benefits
- Discussing container orchestration strategies
- Analyzing networking and security considerations
- Providing insights on container management
- Focusing on concepts rather than implementation
Respond with a thoughtful discussion (without writing actual code unless specifically requested):`;
            break;
            
          case 'cloud':
            prompt += `As InfraCommander, discuss cloud infrastructure approaches by:
- Explaining cloud architecture principles
- Discussing service selection considerations
- Analyzing scalability and reliability strategies
- Providing insights on cloud best practices
- Focusing on concepts rather than implementation
Respond with a thoughtful discussion (without writing actual code unless specifically requested):`;
            break;
            
          case 'iac':
            prompt += `As InfraCommander, discuss Infrastructure as Code approaches by:
- Explaining IaC principles and benefits
- Discussing tool selection considerations
- Analyzing state management strategies
- Providing insights on IaC best practices
- Focusing on concepts rather than implementation
Respond with a thoughtful discussion (without writing actual code unless specifically requested):`;
            break;
            
          case 'monitoring':
            prompt += `As InfraCommander, discuss monitoring approaches by:
- Explaining observability principles
- Discussing metric selection considerations
- Analyzing alerting and visualization strategies
- Providing insights on monitoring best practices
- Focusing on concepts rather than implementation
Respond with a thoughtful discussion (without writing actual code unless specifically requested):`;
            break;
            
          case 'security':
            prompt += `As InfraCommander, discuss security infrastructure approaches by:
- Explaining security principles for infrastructure
- Discussing vulnerability management strategies
- Analyzing compliance and governance considerations
- Providing insights on security best practices
- Focusing on concepts rather than implementation
Respond with a thoughtful discussion (without writing actual code unless specifically requested):`;
            break;
            
          case 'business-infrastructure':
            prompt += `As InfraCommander, analyze this business idea's infrastructure needs by:
- Evaluating infrastructure requirements and scaling considerations for the business
- Analyzing cloud costs and operational overhead in competitive markets
- Assessing infrastructure advantages that could provide competitive edge
- Identifying deployment challenges specific to the Canadian market
- Comparing infrastructure requirements against competitors in saturated markets
- Suggesting innovative infrastructure approaches to reduce costs or improve performance
- Providing a realistic assessment of infrastructure viability and market differentiation
- Outlining potential infrastructure roadmaps for successful market entry
Respond with a thoughtful infrastructure analysis (without writing actual code unless specifically requested):`;
            break;
            
          default:
            prompt += `As InfraCommander, discuss infrastructure concepts by:
- Explaining deployment and operations principles
- Discussing infrastructure design considerations
- Analyzing reliability and scalability strategies
- Providing insights from infrastructure experience
- Focusing on concepts rather than implementation
Respond with a thoughtful discussion (without writing actual code unless specifically requested):`;
        }
      }
    } 
    else if (message.from === 'agent-mistral') {
      prompt += `The software tester QualityGuardian asks: ${message.content}\n\nAs InfraCommander, respond with deployment insights:`;
    }
    else if (message.from === 'agent-llama3') {
      prompt += `The software developer DevArchitect asks: ${message.content}\n\nAs InfraCommander, provide infrastructure solutions:`;
    }
    else if (message.from === 'agent-qwen') {
      prompt += `The task manager ProjectCoordinator asks: ${message.content}\n\nAs InfraCommander, provide deployment strategy:`;
    }
    else if (message.from === 'agent-llama33') {
      prompt += `The strategic advisor StrategyGuide asks: ${message.content}\n\nAs InfraCommander, provide infrastructure insights:`;
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