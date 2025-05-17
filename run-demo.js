/**
 * Run Demo Script
 * 
 * Executes the test scenario and records the output to a file
 */
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Timestamp for the log file
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(logsDir, `team-demo-${timestamp}.log`);

console.log(`Starting AI Development Team demo...`);
console.log(`Recording output to: ${logFile}`);

try {
  // Execute the test scenario and capture the output
  const output = execSync('node test-chat-scenario.js', { encoding: 'utf8' });
  
  // Write the output to the log file
  fs.writeFileSync(logFile, `AI DEVELOPMENT TEAM DEMO - ${new Date().toISOString()}\n\n${output}`);
  
  console.log(`Demo completed and recorded to ${logFile}`);
  console.log(`To view the recorded demo, use: cat ${logFile}`);
} catch (error) {
  console.error('Error running the demo:', error.message);
  
  // Save error output if available
  if (error.stdout || error.stderr) {
    fs.writeFileSync(
      logFile, 
      `ERROR RUNNING DEMO - ${new Date().toISOString()}\n\n` +
      `STDOUT:\n${error.stdout || 'None'}\n\n` +
      `STDERR:\n${error.stderr || 'None'}`
    );
    console.log(`Error details saved to ${logFile}`);
  }
} 