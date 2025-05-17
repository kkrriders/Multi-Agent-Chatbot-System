/**
 * Run Custom Project Script
 * 
 * Runs a custom project with a predefined project description
 * and saves all conversations to a text file
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
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

// Predefined project description
const PROJECT_DESCRIPTION = "Create a mobile app for tracking and sharing hiking trails with friends, including GPS tracking, photo sharing, and difficulty ratings.";

// Create a unique filename based on project description and timestamp
function generateOutputFileName(projectDesc) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const projectName = projectDesc.split(' ').slice(0, 3).join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
  return `${projectName}-${timestamp}.txt`;
}

// Create recordings directory if it doesn't exist
const recordingsDir = path.join(__dirname, 'recordings', 'custom-projects');
if (!fs.existsSync(path.join(__dirname, 'recordings'))) {
  fs.mkdirSync(path.join(__dirname, 'recordings'));
}
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir);
}

// Generate output file path
const OUTPUT_FILE = path.join(recordingsDir, generateOutputFileName(PROJECT_DESCRIPTION));
const output = fs.createWriteStream(OUTPUT_FILE);

/**
 * Log to both console and file
 */
function log(message) {
  console.log(message);
  output.write(message + '\n');
}

/**
 * Send a message through the manager and get the response
 */
async function sendMessage(from, to, content) {
  const message = createMessage(from, to, PERFORMATIVES.INFORM, content);
  
  log(`\n[${from} -> ${to}]: ${content}`);
  
  try {
    const response = await axios.post(MANAGER_ENDPOINT, message);
    const agentResponse = response.data.agentResponse;
    
    log(`\n[${agentResponse.from} -> ${agentResponse.to}]: ${agentResponse.content}`);
    log(`\n[Summary]: ${response.data.summary}`);
    
    return {
      message: agentResponse,
      summary: response.data.summary
    };
  } catch (error) {
    console.error('Error sending message:', error.message);
    log(`\n[ERROR]: ${error.message}`);
    if (error.response) {
      console.error('Server response:', error.response.data);
      log(`\n[ERROR RESPONSE]: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Parse the project prompt and generate role-specific instructions
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
 * Format the structured record
 */
function formatStructuredRecord(projectName, projectDescription, conversations) {
  const timestamp = new Date().toISOString();
  let structured = [];
  
  // Format the header with timestamp and team information
  structured.push('='.repeat(80));
  structured.push(`AI DEVELOPMENT TEAM - PROJECT RECORD (${timestamp})`);
  structured.push('='.repeat(80));
  structured.push('');
  structured.push(`Project: ${projectDescription}`);
  structured.push('');
  structured.push('Team Members:');
  structured.push('- Executive Overseer (Llama3.3): Senior Manager');
  structured.push('- CodeCrafter (Llama3): Software Developer');
  structured.push('- CodeQualifier (Mistral): Software Tester');
  structured.push('- DeployMaster (Phi3): Deployment Manager');
  structured.push('- Project Navigator (Qwen): Task Manager');
  structured.push('');
  structured.push('='.repeat(80));
  structured.push('CONVERSATION RECORD');
  structured.push('='.repeat(80));
  structured.push('');
  
  // Add all messages with proper formatting
  conversations.forEach(msg => {
    structured.push(`[${msg.from} -> ${msg.to}]:`);
    structured.push(msg.content);
    structured.push('');
    
    if (msg.summary) {
      structured.push(`Summary: ${msg.summary}`);
      structured.push('');
    }
    
    structured.push('-'.repeat(80));
    structured.push('');
  });
  
  return structured.join('\n');
}

/**
 * Run the custom project scenario
 */
async function runCustomProjectScenario() {
  const conversationLog = [];
  const projectDetails = parseProjectPrompt(PROJECT_DESCRIPTION);
  
  try {
    log('\n===== MULTI-AGENT CHATBOT SYSTEM - CUSTOM PROJECT =====\n');
    log('Project: ' + PROJECT_DESCRIPTION);
    log('\nTeam Members:');
    log('- Executive Overseer (Llama3.3): Senior Manager');
    log('- CodeCrafter (Llama3): Software Developer');
    log('- CodeQualifier (Mistral): Software Tester');
    log('- DeployMaster (Phi3): Deployment Manager');
    log('- Project Navigator (Qwen): Task Manager\n');
    
    // Record for structured log
    function recordInteraction(fromAgent, toAgent, content, summary) {
      conversationLog.push({
        from: fromAgent,
        to: toAgent,
        content: content,
        summary: summary
      });
    }
    
    // 1. User assigns task to the Task Manager
    const taskManagerPrompt = projectDetails.instructions.taskManager;
    const taskManagerResponse = await sendMessage('user', AGENTS.TASK_MANAGER, taskManagerPrompt);
    recordInteraction('user', AGENTS.TASK_MANAGER, taskManagerPrompt, taskManagerResponse.summary);
    
    // 2. Task Manager assigns a task to the Developer
    const developerPrompt = projectDetails.instructions.developer;
    const developerResponse = await sendMessage(AGENTS.TASK_MANAGER, AGENTS.DEVELOPER, developerPrompt);
    recordInteraction(AGENTS.TASK_MANAGER, AGENTS.DEVELOPER, developerPrompt, developerResponse.summary);
    
    // 3. Developer responds with implementation plan
    const devResponseContent = developerResponse.message.content;
    const devFeedbackToManager = "I've analyzed the requirements and here's my implementation plan: " + devResponseContent.substring(0, 200) + "...";
    const devManagerResponse = await sendMessage(AGENTS.DEVELOPER, AGENTS.TASK_MANAGER, devFeedbackToManager);
    recordInteraction(AGENTS.DEVELOPER, AGENTS.TASK_MANAGER, devFeedbackToManager, devManagerResponse.summary);
    
    // 4. Task Manager informs the Tester
    const testerPrompt = projectDetails.instructions.tester + ` The developer has proposed: ${devResponseContent.substring(0, 100)}...`;
    const testerResponse = await sendMessage(AGENTS.TASK_MANAGER, AGENTS.TESTER, testerPrompt);
    recordInteraction(AGENTS.TASK_MANAGER, AGENTS.TESTER, testerPrompt, testerResponse.summary);
    
    // 5. Tester responds with testing plan
    const testResponseContent = testerResponse.message.content;
    const testFeedbackToManager = "Here's my testing strategy: " + testResponseContent.substring(0, 200) + "...";
    const testerManagerResponse = await sendMessage(AGENTS.TESTER, AGENTS.TASK_MANAGER, testFeedbackToManager);
    recordInteraction(AGENTS.TESTER, AGENTS.TASK_MANAGER, testFeedbackToManager, testerManagerResponse.summary);
    
    // 6. Task Manager informs the Deployment Manager
    const deployPrompt = projectDetails.instructions.deployment + ` The developer will use: ${devResponseContent.substring(0, 100)}...`;
    const deployResponse = await sendMessage(AGENTS.TASK_MANAGER, AGENTS.DEPLOYMENT, deployPrompt);
    recordInteraction(AGENTS.TASK_MANAGER, AGENTS.DEPLOYMENT, deployPrompt, deployResponse.summary);
    
    // 7. Deployment Manager responds
    const deployResponseContent = deployResponse.message.content;
    const deployFeedbackToManager = "I recommend this deployment strategy: " + deployResponseContent.substring(0, 200) + "...";
    const deployManagerResponse = await sendMessage(AGENTS.DEPLOYMENT, AGENTS.TASK_MANAGER, deployFeedbackToManager);
    recordInteraction(AGENTS.DEPLOYMENT, AGENTS.TASK_MANAGER, deployFeedbackToManager, deployManagerResponse.summary);
    
    // 8. Task Manager reports to Senior Manager
    const seniorManagerPrompt = `${projectDetails.instructions.seniorManager}\n\nHere's our team's plan:\n\n1. Development: ${devResponseContent.substring(0, 100)}...\n2. Testing: ${testResponseContent.substring(0, 100)}...\n3. Deployment: ${deployResponseContent.substring(0, 100)}...\n\nWhat are your thoughts on this approach?`;
    const seniorManagerResponse = await sendMessage(AGENTS.TASK_MANAGER, AGENTS.SENIOR_MANAGER, seniorManagerPrompt);
    recordInteraction(AGENTS.TASK_MANAGER, AGENTS.SENIOR_MANAGER, seniorManagerPrompt, seniorManagerResponse.summary);
    
    // 9. Senior Manager provides feedback
    const finalFeedback = seniorManagerResponse.message.content;
    const finalResponse = await sendMessage(AGENTS.SENIOR_MANAGER, AGENTS.TASK_MANAGER, finalFeedback);
    recordInteraction(AGENTS.SENIOR_MANAGER, AGENTS.TASK_MANAGER, finalFeedback, finalResponse.summary);
    
    log('\n===== CUSTOM PROJECT SCENARIO COMPLETE =====\n');
    
    // Write structured record to file
    const structuredRecord = formatStructuredRecord(
      projectDetails.projectName, 
      PROJECT_DESCRIPTION,
      conversationLog
    );
    
    // Make sure output stream is closed
    output.end();
    
    // Write the formatted record to the file
    fs.writeFileSync(OUTPUT_FILE, structuredRecord);
    
    log(`\nFull conversation has been saved to ${OUTPUT_FILE}`);
    
  } catch (error) {
    console.error('Error running custom project scenario:', error.message);
    log(`\n[ERROR]: Error running scenario: ${error.message}`);
    
    // Still try to save whatever conversation happened
    if (conversationLog.length > 0) {
      const structuredRecord = formatStructuredRecord(
        projectDetails.projectName,
        PROJECT_DESCRIPTION,
        conversationLog
      );
      fs.writeFileSync(OUTPUT_FILE, structuredRecord);
      console.log(`Partial conversation record saved to: ${OUTPUT_FILE}`);
    }
  } finally {
    output.end();
  }
}

/**
 * Main function to start the process
 */
async function main() {
  console.log(`\n=== RUNNING CUSTOM PROJECT: Hiking App ===\n`);
  console.log(`Each run creates a unique conversation file in: ${recordingsDir}`);
  console.log(`File name: ${path.basename(OUTPUT_FILE)}`);
  
  // Check if services are running
  try {
    console.log('\nChecking if all services are running...');
    await axios.get('http://localhost:3000/status');
    console.log('Services are running!');
    
    // Run the scenario
    await runCustomProjectScenario();
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('Services are not running. Please start them with: npm run start-all');
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run the main function
main(); 