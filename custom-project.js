/**
 * Custom Project Chat Script
 * 
 * Takes a user prompt about what to build, assigns roles to agents,
 * and generates a conversation about the project
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const readline = require('readline');
const { createMessage, PERFORMATIVES } = require('./shared/messaging');
const { execSync } = require('child_process');

// Agent IDs
const AGENTS = {
  SENIOR_MANAGER: 'agent-llama3', // Executive Overseer
  DEVELOPER: 'agent-llama3',      // CodeCrafter 
  TESTER: 'agent-mistral',        // CodeQualifier
  DEPLOYMENT: 'agent-phi3',       // DeployMaster
  TASK_MANAGER: 'agent-qwen'      // Project Navigator
};

// Manager endpoint
const MANAGER_ENDPOINT = 'http://localhost:3000/message';

// Create recordings directory if it doesn't exist
const recordingsDir = path.join(__dirname, 'recordings', 'custom-projects');
if (!fs.existsSync(path.join(__dirname, 'recordings'))) {
  fs.mkdirSync(path.join(__dirname, 'recordings'));
}
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir);
}

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Send a message through the manager and get the response
 */
async function sendMessage(from, to, content) {
  const message = createMessage(from, to, PERFORMATIVES.INFORM, content);
  
  console.log(`\n[${from} -> ${to}]: ${content}`);
  
  try {
    const response = await axios.post(MANAGER_ENDPOINT, message);
    const agentResponse = response.data.agentResponse;
    
    console.log(`\n[${agentResponse.from} -> ${agentResponse.to}]: ${agentResponse.content}`);
    console.log(`\n[Summary]: ${response.data.summary}`);
    
    return {
      message: agentResponse,
      summary: response.data.summary
    };
  } catch (error) {
    console.error('Error sending message:', error.message);
    if (error.response) {
      console.error('Server response:', error.response.data);
    }
    throw error;
  }
}

/**
 * Parse the user's project prompt and generate role-specific instructions
 */
function parseProjectPrompt(prompt) {
  // We'll create specialized instructions for each agent based on the prompt
  const projectName = prompt.split(' ').slice(0, 3).join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
  
  return {
    projectName,
    instructions: {
      taskManager: `As the Project Navigator, organize the development of this project: ${prompt}. Break it down into tasks and assign them to the team.`,
      developer: `As the CodeCrafter, you need to develop this: ${prompt}. Provide a technical approach and implementation plan.`,
      tester: `As the CodeQualifier, create a testing strategy for this project: ${prompt}. Consider all aspects that should be tested.`,
      deployment: `As the DeployMaster, suggest a deployment strategy for: ${prompt}. Consider the infrastructure and CI/CD pipeline needed.`,
      seniorManager: `As the Executive Overseer, review the team's plan for: ${prompt}. Provide feedback and guidance for the project.`
    }
  };
}

/**
 * Run the custom project scenario
 */
async function runCustomProjectScenario(projectDetails) {
  const { projectName, instructions } = projectDetails;
  
  // Setup recording
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const recordFile = path.join(recordingsDir, `${projectName}-${timestamp}.txt`);
  const conversationLog = [];
  const summaryLog = [];
  
  try {
    console.log('\n===== MULTI-AGENT CHATBOT SYSTEM - CUSTOM PROJECT =====\n');
    console.log('Project: ' + instructions.taskManager.split(': ')[1]);
    console.log('\nTeam Members:');
    console.log('- Executive Overseer (Llama3.3): Senior Manager');
    console.log('- CodeCrafter (Llama3): Software Developer');
    console.log('- CodeQualifier (Mistral): Software Tester');
    console.log('- DeployMaster (Phi3): Deployment Manager');
    console.log('- Project Navigator (Qwen): Task Manager\n');
    
    // Record for structured log
    function recordInteraction(fromAgent, toAgent, content, summary) {
      conversationLog.push({
        from: fromAgent,
        to: toAgent,
        content: content
      });
      
      if (summary) {
        summaryLog.push(summary);
      }
    }
    
    // 1. User assigns task to the Task Manager
    const taskManagerPrompt = instructions.taskManager;
    const taskManagerResponse = await sendMessage('user', AGENTS.TASK_MANAGER, taskManagerPrompt);
    recordInteraction('user', AGENTS.TASK_MANAGER, taskManagerPrompt, taskManagerResponse.summary);
    
    // 2. Task Manager assigns a task to the Developer
    const developerPrompt = instructions.developer;
    const developerResponse = await sendMessage(AGENTS.TASK_MANAGER, AGENTS.DEVELOPER, developerPrompt);
    recordInteraction(AGENTS.TASK_MANAGER, AGENTS.DEVELOPER, developerPrompt, developerResponse.summary);
    
    // 3. Developer responds with implementation plan
    const devResponseContent = developerResponse.message.content;
    const devFeedbackToManager = "I've analyzed the requirements and here's my implementation plan: " + devResponseContent.substring(0, 200) + "...";
    const devManagerResponse = await sendMessage(AGENTS.DEVELOPER, AGENTS.TASK_MANAGER, devFeedbackToManager);
    recordInteraction(AGENTS.DEVELOPER, AGENTS.TASK_MANAGER, devFeedbackToManager, devManagerResponse.summary);
    
    // 4. Task Manager informs the Tester
    const testerPrompt = instructions.tester + ` The developer has proposed: ${devResponseContent.substring(0, 100)}...`;
    const testerResponse = await sendMessage(AGENTS.TASK_MANAGER, AGENTS.TESTER, testerPrompt);
    recordInteraction(AGENTS.TASK_MANAGER, AGENTS.TESTER, testerPrompt, testerResponse.summary);
    
    // 5. Tester responds with testing plan
    const testResponseContent = testerResponse.message.content;
    const testFeedbackToManager = "Here's my testing strategy: " + testResponseContent.substring(0, 200) + "...";
    const testerManagerResponse = await sendMessage(AGENTS.TESTER, AGENTS.TASK_MANAGER, testFeedbackToManager);
    recordInteraction(AGENTS.TESTER, AGENTS.TASK_MANAGER, testFeedbackToManager, testerManagerResponse.summary);
    
    // 6. Task Manager informs the Deployment Manager
    const deployPrompt = instructions.deployment + ` The developer will use: ${devResponseContent.substring(0, 100)}...`;
    const deployResponse = await sendMessage(AGENTS.TASK_MANAGER, AGENTS.DEPLOYMENT, deployPrompt);
    recordInteraction(AGENTS.TASK_MANAGER, AGENTS.DEPLOYMENT, deployPrompt, deployResponse.summary);
    
    // 7. Deployment Manager responds
    const deployResponseContent = deployResponse.message.content;
    const deployFeedbackToManager = "I recommend this deployment strategy: " + deployResponseContent.substring(0, 200) + "...";
    const deployManagerResponse = await sendMessage(AGENTS.DEPLOYMENT, AGENTS.TASK_MANAGER, deployFeedbackToManager);
    recordInteraction(AGENTS.DEPLOYMENT, AGENTS.TASK_MANAGER, deployFeedbackToManager, deployManagerResponse.summary);
    
    // 8. Task Manager reports to Senior Manager
    const seniorManagerPrompt = `${instructions.seniorManager}\n\nHere's our team's plan:\n\n1. Development: ${devResponseContent.substring(0, 100)}...\n2. Testing: ${testResponseContent.substring(0, 100)}...\n3. Deployment: ${deployResponseContent.substring(0, 100)}...\n\nWhat are your thoughts on this approach?`;
    const seniorManagerResponse = await sendMessage(AGENTS.TASK_MANAGER, AGENTS.SENIOR_MANAGER, seniorManagerPrompt);
    recordInteraction(AGENTS.TASK_MANAGER, AGENTS.SENIOR_MANAGER, seniorManagerPrompt, seniorManagerResponse.summary);
    
    // 9. Senior Manager provides feedback
    const finalFeedback = seniorManagerResponse.message.content;
    const finalResponse = await sendMessage(AGENTS.SENIOR_MANAGER, AGENTS.TASK_MANAGER, finalFeedback);
    recordInteraction(AGENTS.SENIOR_MANAGER, AGENTS.TASK_MANAGER, finalFeedback, finalResponse.summary);
    
    console.log('\n===== CUSTOM PROJECT SCENARIO COMPLETE =====\n');
    
    // Create structured record
    const structuredRecord = formatStructuredRecord(projectName, instructions.taskManager.split(': ')[1], conversationLog, summaryLog);
    fs.writeFileSync(recordFile, structuredRecord);
    
    console.log(`Conversation record saved to: ${recordFile}`);
    console.log(`Use "type ${recordFile}" to view the full record.`);
    
    return recordFile;
  } catch (error) {
    console.error('Error running custom project scenario:', error.message);
    
    // Still try to save whatever conversation happened
    if (conversationLog.length > 0) {
      const structuredRecord = formatStructuredRecord(projectName, instructions.taskManager.split(': ')[1], conversationLog, summaryLog);
      fs.writeFileSync(recordFile, structuredRecord);
      console.log(`Partial conversation record saved to: ${recordFile}`);
    }
  }
}

/**
 * Format the structured record
 */
function formatStructuredRecord(projectName, projectDescription, conversations, summaries) {
  let structured = [];
  
  // Format the header with timestamp and team information
  structured.push('='.repeat(80));
  structured.push(`AI DEVELOPMENT TEAM - CUSTOM PROJECT: ${projectName}`);
  structured.push(`TIMESTAMP: ${new Date().toISOString()}`);
  structured.push('='.repeat(80));
  structured.push(`\nPROJECT DESCRIPTION: ${projectDescription}`);
  structured.push('\nTEAM MEMBERS:');
  structured.push('- Executive Overseer (Llama3.3): Senior Manager');
  structured.push('- CodeCrafter (Llama3): Software Developer');
  structured.push('- CodeQualifier (Mistral): Software Tester');
  structured.push('- DeployMaster (Phi3): Deployment Manager');
  structured.push('- Project Navigator (Qwen): Task Manager');
  structured.push('='.repeat(80) + '\n');
  
  // Format the conversation section
  structured.push('CONVERSATION LOG:');
  structured.push('-'.repeat(80));
  
  conversations.forEach((msg, index) => {
    structured.push(`MESSAGE ${index + 1}:`);
    structured.push(`FROM: ${msg.from}`);
    structured.push(`TO: ${msg.to}`);
    structured.push(`CONTENT:\n${msg.content}\n`);
    structured.push('-'.repeat(40));
  });
  
  // Format the summaries section
  structured.push('\nMANAGER SUMMARIES:');
  structured.push('-'.repeat(80));
  
  summaries.forEach((summary, index) => {
    structured.push(`SUMMARY ${index + 1}:\n${summary}\n`);
    structured.push('-'.repeat(40));
  });
  
  structured.push('\n' + '='.repeat(80));
  structured.push('END OF CONVERSATION RECORD');
  structured.push('='.repeat(80));
  
  return structured.join('\n');
}

/**
 * Main function to start the process
 */
async function main() {
  console.log('\n=== MULTI-AGENT CUSTOM PROJECT GENERATOR ===\n');
  console.log('This tool will create a conversation between AI agents about a project of your choice.');
  
  // Check if services are running
  try {
    console.log('\nChecking if all services are running...');
    await axios.get('http://localhost:3000/status');
    console.log('Services are running!');
  } catch (error) {
    console.log('Services are not running. Starting services...');
    try {
      execSync('npm run start-all', { stdio: 'inherit' });
    } catch (error) {
      console.error('Failed to start services automatically. Please run "npm run start-all" in another terminal.');
      rl.question('Press Enter to continue once services are running...', () => {});
      return;
    }
  }
  
  // Get project prompt
  rl.question('\nWhat would you like the AI team to build? Describe your project: ', async (prompt) => {
    if (prompt.trim() === '') {
      console.log('Project description cannot be empty. Please try again.');
      rl.close();
      return;
    }
    
    console.log('\nParsing your project prompt...');
    const projectDetails = parseProjectPrompt(prompt);
    
    console.log(`\nProject name: ${projectDetails.projectName}`);
    console.log('Project instructions generated for each agent role');
    
    rl.question('\nPress Enter to start the conversation or Ctrl+C to cancel...', async () => {
      const recordFile = await runCustomProjectScenario(projectDetails);
      rl.close();
    });
  });
}

// Run the main function
main(); 