#!/usr/bin/env node

/**
 * Multi-Agent Chatbot System Service Stopper
 * Gracefully stops all running services
 */

const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

async function stopServices() {
  console.log(`${colors.bright}🛑 Stopping Multi-Agent Chatbot System...${colors.reset}\n`);
  
  try {
    // Find and kill Node.js processes related to this project
    const commands = [
      // Kill processes by script name patterns
      'pkill -f "enhanced-performance-monitor"',
      'pkill -f "agent-llama3"',
      'pkill -f "agent-mistral"',
      'pkill -f "agent-phi3"',
      'pkill -f "agent-qwen"',
      'pkill -f "manager/index"',
      'pkill -f "start-stable"',
      
      // Kill by port (backup method)
      'fuser -k 3000/tcp 2>/dev/null || true',
      'fuser -k 3001/tcp 2>/dev/null || true',
      'fuser -k 3002/tcp 2>/dev/null || true',
      'fuser -k 3003/tcp 2>/dev/null || true',
      'fuser -k 3004/tcp 2>/dev/null || true',
      'fuser -k 3099/tcp 2>/dev/null || true'
    ];
    
    console.log(`${colors.yellow}Stopping all Node.js processes on this project...${colors.reset}`);
    
    for (const command of commands) {
      try {
        await execAsync(command);
      } catch (error) {
        // Ignore errors for processes that don't exist
      }
    }
    
    // Wait a moment for processes to terminate
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`${colors.green}All services stopped successfully.${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}Error stopping services: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run the stop function
stopServices();