/**
 * Structured Recording Script
 * 
 * Executes the test scenario and creates a structured text record
 */
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Create recordings directory if it doesn't exist
const recordingsDir = path.join(__dirname, 'recordings', 'structured');
if (!fs.existsSync(path.join(__dirname, 'recordings'))) {
  fs.mkdirSync(path.join(__dirname, 'recordings'));
}
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir);
}

// Timestamp for the record file
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const recordFile = path.join(recordingsDir, `team-conversation-${timestamp}.txt`);

console.log(`Starting AI Development Team demo with structured recording...`);
console.log(`Recording to: ${recordFile}`);

try {
  // Execute the test scenario and capture the output
  const output = execSync('node test-chat-scenario.js', { encoding: 'utf8' });
  
  // Process the output to create a structured format
  const structuredOutput = processOutput(output);
  
  // Write the structured output to file
  fs.writeFileSync(recordFile, structuredOutput);
  
  console.log(`\nDemo completed and recorded to ${recordFile}`);
  console.log(`To view the structured record, use: type ${recordFile}`);
} catch (error) {
  console.error('Error running the demo:', error.message);
  
  if (error.stdout) {
    // Even if there was an error, try to process what output we got
    const structuredOutput = processOutput(error.stdout);
    fs.writeFileSync(recordFile, structuredOutput);
    console.log(`Partial results saved to ${recordFile}`);
  }
}

/**
 * Process the raw output into a structured format
 * 
 * @param {string} rawOutput - The raw output from the test scenario
 * @returns {string} - Structured text format
 */
function processOutput(rawOutput) {
  // Split output by message sections
  const lines = rawOutput.split('\n');
  let structured = [];
  let currentSection = 'header';
  let conversation = [];
  let summaries = [];
  let currentMessage = null;
  
  // Format the header with timestamp and team information
  structured.push('='.repeat(80));
  structured.push(`AI DEVELOPMENT TEAM - CONVERSATION RECORD - ${new Date().toISOString()}`);
  structured.push('='.repeat(80));
  structured.push('\nTEAM MEMBERS:');
  structured.push('- Executive Overseer (Llama3.3): Senior Manager');
  structured.push('- CodeCrafter (Llama3): Software Developer');
  structured.push('- CodeQualifier (Mistral): Software Tester');
  structured.push('- DeployMaster (Phi3): Deployment Manager');
  structured.push('- Project Navigator (Qwen): Task Manager');
  structured.push('='.repeat(80) + '\n');
  
  // Parse each line of output
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect message blocks
    if (line.includes('[') && (line.includes(' -> ') || line.includes('Summary'))) {
      // Extract the from and to parts
      if (line.includes(' -> ')) {
        const messageMatch = line.match(/\[(.*?) -> (.*?)\]: (.*)/);
        if (messageMatch) {
          // If we were building a message, save it
          if (currentMessage) {
            conversation.push(currentMessage);
          }
          
          // Start a new message
          const [_, from, to, startContent] = messageMatch;
          currentMessage = {
            from: from.trim(),
            to: to.trim(),
            content: startContent.trim(),
            type: 'message'
          };
          currentSection = 'message';
        }
      } 
      // Extract summary
      else if (line.includes('Summary')) {
        const summaryMatch = line.match(/\[Summary\]: (.*)/);
        if (summaryMatch) {
          // If we were building a message, save it
          if (currentMessage) {
            conversation.push(currentMessage);
            currentMessage = null;
          }
          
          const [_, summaryContent] = summaryMatch;
          summaries.push(summaryContent.trim());
          currentSection = 'summary';
        }
      }
    }
    // Continue building the current message
    else if (currentSection === 'message' && currentMessage) {
      if (line.trim()) {
        currentMessage.content += ' ' + line.trim();
      }
    }
  }
  
  // Add the final message if there is one
  if (currentMessage) {
    conversation.push(currentMessage);
  }
  
  // Format the conversation section
  structured.push('CONVERSATION LOG:');
  structured.push('-'.repeat(80));
  
  conversation.forEach((msg, index) => {
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