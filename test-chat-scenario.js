/**
 * Test Chat Scenario
 * 
 * Demonstrates an interaction between the AI agents in their specialized roles
 */
const axios = require('axios');
const chalk = require('chalk');
const { createMessage, PERFORMATIVES } = require('./shared/messaging');

// Manager endpoint
const MANAGER_ENDPOINT = 'http://localhost:3000/message';

// Agent IDs
const AGENTS = {
  SENIOR_MANAGER: 'agent-llama3', // Executive Overseer (Senior Manager)
  DEVELOPER: 'agent-llama3',      // CodeCrafter (Developer)
  TESTER: 'agent-mistral',        // CodeQualifier (Tester)
  DEPLOYMENT: 'agent-phi3',       // DeployMaster (Deployment)
  TASK_MANAGER: 'agent-qwen'      // Project Navigator (Task Manager)
};

/**
 * Send a message through the manager and get the response
 */
async function sendMessage(from, to, content) {
  const message = createMessage(from, to, PERFORMATIVES.INFORM, content);
  
  console.log(chalk.blue(`\n[${from} -> ${to}]: `) + content);
  
  try {
    const response = await axios.post(MANAGER_ENDPOINT, message);
    const agentResponse = response.data.agentResponse;
    
    console.log(chalk.green(`\n[${agentResponse.from} -> ${agentResponse.to}]: `) + agentResponse.content);
    console.log(chalk.yellow('\n[Summary]: ') + response.data.summary);
    
    return agentResponse;
  } catch (error) {
    console.error('Error sending message:', error.message);
    if (error.response) {
      console.error('Server response:', error.response.data);
    }
    throw error;
  }
}

/**
 * Run the test scenario
 */
async function runScenario() {
  try {
    console.log(chalk.magenta('\n===== MULTI-AGENT CHATBOT SYSTEM - AI DEVELOPMENT TEAM DEMO =====\n'));
    console.log(chalk.cyan('Team Members:'));
    console.log('- Executive Overseer (Llama3.3): Senior Manager');
    console.log('- CodeCrafter (Llama3): Software Developer');
    console.log('- CodeQualifier (Mistral): Software Tester');
    console.log('- DeployMaster (Phi3): Deployment Manager');
    console.log('- Project Navigator (Qwen): Task Manager\n');
    
    // Scenario: Web App Development Project
    
    // 1. User assigns task to the Task Manager
    await sendMessage('user', AGENTS.TASK_MANAGER, 
      'We need to develop a new web application for customer feedback. Please coordinate the team to make this happen.');
    
    // 2. Task Manager assigns a task to the Developer
    await sendMessage(AGENTS.TASK_MANAGER, AGENTS.DEVELOPER,
      'CodeCrafter, we need to develop a customer feedback web app. Please create the initial framework with a form that collects customer name, email, rating (1-5 stars), and feedback text.');
    
    // 3. Developer responds with implementation plan
    const devResponse = await sendMessage(AGENTS.DEVELOPER, AGENTS.TASK_MANAGER,
      'I\'ll implement the customer feedback form using React for the frontend and Node.js with Express for the backend. The form will have validations for all fields, and I\'ll use a responsive design approach.');
    
    // 4. Task Manager informs the Tester
    await sendMessage(AGENTS.TASK_MANAGER, AGENTS.TESTER,
      `CodeQualifier, CodeCrafter is implementing a customer feedback form with the following approach: ${devResponse.content.substring(0, 150)}... Please prepare a testing strategy.`);
    
    // 5. Tester responds with testing plan
    const testResponse = await sendMessage(AGENTS.TESTER, AGENTS.TASK_MANAGER,
      'I\'ll create test cases for form validation, responsive design testing, and backend API validation. I\'ll use Jest for unit tests, Cypress for E2E testing, and will verify both happy paths and edge cases.');
    
    // 6. Task Manager informs the Deployment Manager
    await sendMessage(AGENTS.TASK_MANAGER, AGENTS.DEPLOYMENT,
      `DeployMaster, we're building a customer feedback app. CodeCrafter is using React and Node.js, and CodeQualifier will test with Jest and Cypress. Please suggest a deployment strategy.`);
    
    // 7. Deployment Manager responds
    const deployResponse = await sendMessage(AGENTS.DEPLOYMENT, AGENTS.TASK_MANAGER,
      'I recommend a CI/CD pipeline with GitHub Actions. We can deploy the frontend to Vercel and the backend to Heroku for quick iterations. For production, we should consider AWS with Elastic Beanstalk for scalability.');
    
    // 8. Task Manager reports to Senior Manager
    await sendMessage(AGENTS.TASK_MANAGER, AGENTS.SENIOR_MANAGER,
      `Executive Overseer, here's our plan for the customer feedback application:\n\n1. Development (CodeCrafter): ${devResponse.content.substring(0, 100)}...\n2. Testing (CodeQualifier): ${testResponse.content.substring(0, 100)}...\n3. Deployment (DeployMaster): ${deployResponse.content.substring(0, 100)}...\n\nWhat are your thoughts on this approach?`);
    
    // 9. Senior Manager provides feedback
    await sendMessage(AGENTS.SENIOR_MANAGER, AGENTS.TASK_MANAGER,
      'Thank you for the comprehensive plan. Please ensure we have proper data security for customer information and GDPR compliance. Also, consider adding analytics to track feedback trends. Schedule a progress review next week.');
    
    console.log(chalk.magenta('\n===== SCENARIO COMPLETE =====\n'));
    
  } catch (error) {
    console.error('Error running scenario:', error.message);
  }
}

// Run the scenario
runScenario(); 