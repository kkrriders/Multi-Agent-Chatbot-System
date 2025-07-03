/**
 * Start All Services Script
 * 
 * Starts the manager and all 4 flexible agents
 */
const { spawn } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Service configurations
const services = [
  {
    name: 'Manager',
    script: 'manager/index.js',
    port: process.env.MANAGER_PORT || 3000,
    color: '\x1b[34m' // Blue
  },
  {
    name: 'Agent-1',
    script: 'agent-llama3/index.js',
    port: process.env.AGENT_1_PORT || 3001,
    color: '\x1b[32m' // Green
  },
  {
    name: 'Agent-2', 
    script: 'agent-mistral/index.js',
    port: process.env.AGENT_2_PORT || 3002,
    color: '\x1b[33m' // Yellow
  },
  {
    name: 'Agent-3',
    script: 'agent-phi3/index.js', 
    port: process.env.AGENT_3_PORT || 3003,
    color: '\x1b[35m' // Magenta
  },
  {
    name: 'Agent-4',
    script: 'agent-qwen/index.js',
    port: process.env.AGENT_4_PORT || 3004,
    color: '\x1b[36m' // Cyan
  }
];

const processes = [];

// Function to start a service
function startService(service) {
  console.log(`${service.color}[${service.name}]\x1b[0m Starting on port ${service.port}...`);
  
  const child = spawn('node', [service.script], {
    stdio: 'pipe',
    cwd: process.cwd()
  });

  // Handle stdout
  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      console.log(`${service.color}[${service.name}]\x1b[0m ${line}`);
    });
  });

  // Handle stderr
  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      console.log(`${service.color}[${service.name}]\x1b[31m ERROR:\x1b[0m ${line}`);
    });
  });

  // Handle process exit
  child.on('close', (code) => {
    if (code !== 0) {
      console.log(`${service.color}[${service.name}]\x1b[31m Process exited with code ${code}\x1b[0m`);
    } else {
      console.log(`${service.color}[${service.name}]\x1b[0m Process exited normally`);
    }
  });

  processes.push({ name: service.name, process: child });
  return child;
}

// Start all services
console.log('\x1b[1m🚀 Starting Multi-Agent Chatbot System...\x1b[0m\n');

services.forEach(service => {
  startService(service);
});

// Handle cleanup on exit
function cleanup() {
  console.log('\n\x1b[1m🛑 Shutting down all services...\x1b[0m');
  
  processes.forEach(({ name, process }) => {
    console.log(`Stopping ${name}...`);
    process.kill('SIGTERM');
  });
  
  setTimeout(() => {
    process.exit(0);
  }, 2000);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Display startup information
setTimeout(() => {
  console.log('\n\x1b[1m📡 System Status:\x1b[0m');
  console.log('Manager API: http://localhost:3000');
  console.log('Agent-1: http://localhost:3001');
  console.log('Agent-2: http://localhost:3002'); 
  console.log('Agent-3: http://localhost:3003');
  console.log('Agent-4: http://localhost:3004');
  console.log('\n\x1b[1m💡 API Endpoints:\x1b[0m');
  console.log('POST /message - Send message to single agent');
  console.log('POST /team-conversation - Start team conversation');
  console.log('GET /conversation/:id - Get conversation history');
  console.log('GET /export-chat/:id - Export conversation as PDF');
  console.log('GET /status - System status');
  console.log('\n\x1b[32m✅ All services started successfully!\x1b[0m');
  console.log('\x1b[33m⚠️  Press Ctrl+C to stop all services\x1b[0m\n');
}, 3000); 