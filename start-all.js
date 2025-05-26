/**
 * Multi-Agent Chatbot System Launcher
 * 
 * This script starts all agent services in parallel.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Define the color codes for console output
const colors = {
  manager: '\x1b[36m',    // Cyan
  mistral: '\x1b[32m',    // Green
  llama3: '\x1b[33m',     // Yellow
  phi3: '\x1b[35m',       // Magenta
  qwen: '\x1b[34m',       // Blue
  llama33: '\x1b[31m',    // Red
  reset: '\x1b[0m'        // Reset
};

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define all services based on actual file locations
const services = [
  {
    name: 'manager',
    command: 'node',
    args: ['manager/index.js'],
    logFile: path.join(logsDir, 'manager.log')
  },
  {
    name: 'agent-mistral',
    command: 'node',
    args: ['agent-mistral/index.js'],
    logFile: path.join(logsDir, 'agent-mistral.log')
  },
  {
    name: 'agent-llama3',
    command: 'node',
    args: ['agent-llama3/index.js'],
    logFile: path.join(logsDir, 'agent-llama3.log')
  },
  {
    name: 'agent-phi3',
    command: 'node',
    args: ['agent-phi3/index.js'],
    logFile: path.join(logsDir, 'agent-phi3.log')
  },
  {
    name: 'agent-qwen',
    command: 'node',
    args: ['agent-qwen/index.js'],
    logFile: path.join(logsDir, 'agent-qwen.log')
  },
  {
    name: 'agent-llama33',
    command: 'node',
    args: ['agent-llama33/index.js'],
    logFile: path.join(logsDir, 'agent-llama33.log')
  }
];

// Track running processes
const processes = {};

// Function to start a service
function startService(service) {
  console.log(`${colors[service.name.replace('agent-', '')] || colors.reset}Starting ${service.name}...${colors.reset}`);
  
  // Create log file stream
  const logStream = fs.createWriteStream(service.logFile, { flags: 'a' });
  
  // Spawn the process
  const process = spawn(service.command, service.args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  });
  
  // Store the process
  processes[service.name] = process;
  
  // Handle stdout
  process.stdout.on('data', (data) => {
    const output = data.toString().trim();
    console.log(`${colors[service.name.replace('agent-', '')] || colors.reset}[${service.name}] ${output}${colors.reset}`);
    logStream.write(`[${new Date().toISOString()}] [STDOUT] ${output}\n`);
  });
  
  // Handle stderr
  process.stderr.on('data', (data) => {
    const output = data.toString().trim();
    console.error(`${colors[service.name.replace('agent-', '')] || colors.reset}[${service.name}] ERROR: ${output}${colors.reset}`);
    logStream.write(`[${new Date().toISOString()}] [STDERR] ${output}\n`);
  });
  
  // Handle process exit
  process.on('exit', (code) => {
    console.log(`${colors[service.name.replace('agent-', '')] || colors.reset}[${service.name}] exited with code ${code}${colors.reset}`);
    logStream.write(`[${new Date().toISOString()}] Process exited with code ${code}\n`);
    logStream.end();
    
    // Remove from processes
    delete processes[service.name];
    
    // If in auto-restart mode, restart the service
    if (autoRestart) {
      console.log(`${colors[service.name.replace('agent-', '')] || colors.reset}Restarting ${service.name}...${colors.reset}`);
      setTimeout(() => startService(service), 1000);
    }
  });
  
  return process;
}

// Start all services
console.log('Starting all Multi-Agent Chatbot System services...');

// Auto-restart flag
let autoRestart = true;

// Start each service
services.forEach(service => {
  startService(service);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nShutting down all services...');
  
  // Disable auto-restart
  autoRestart = false;
  
  // Kill all child processes
  Object.values(processes).forEach(process => {
    process.kill();
  });
  
  // Exit after a timeout to ensure all processes are terminated
  setTimeout(() => {
    console.log('All services stopped.');
    process.exit(0);
  }, 2000);
});

console.log('\n🚀 All services started! Press Ctrl+C to stop all services.\n'); 