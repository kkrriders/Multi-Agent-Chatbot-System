#!/usr/bin/env node

/**
 * Multi-Agent Chatbot System Startup Script
 * Starts all agents, manager, and monitoring services
 */

const { spawn } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

console.log(`${colors.bright}🚀 Starting Multi-Agent Chatbot System...${colors.reset}\n`);

function checkGroqKey() {
  if (!process.env.GROQ_API_KEY) {
    console.error(`${colors.red}❌ GROQ_API_KEY is not set.${colors.reset}`);
    console.log(`${colors.yellow}💡 Add it to your .env file:${colors.reset}`);
    console.log(`   GROQ_API_KEY=gsk_...`);
    process.exit(1);
  }
  console.log(`${colors.green}✅ Groq API key found${colors.reset}`);
}

async function startServices() {
  checkGroqKey();

  console.log(`${colors.bright}\n📡 Starting all services...${colors.reset}`);

  const services = [
    { name: 'MONITOR', script: 'src/monitoring/enhanced-performance-monitor.js', color: colors.cyan },
    { name: 'MANAGER', script: 'src/agents/manager/index.js', color: colors.blue },
    { name: 'AGENT-1', script: 'src/agents/agent-llama3/index.js', color: colors.green },
    { name: 'AGENT-2', script: 'src/agents/agent-mistral/index.js', color: colors.yellow },
    { name: 'AGENT-3', script: 'src/agents/agent-phi3/index.js', color: colors.magenta },
    { name: 'AGENT-4', script: 'src/agents/agent-qwen/index.js', color: colors.red }
  ];

  const processes = [];

  services.forEach(service => {
    console.log(`${service.color}[${service.name}]${colors.reset} Starting...`);

    const childProcess = spawn('node', [service.script], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '1' }
    });

    childProcess.stdout.on('data', (data) => {
      data.toString().split('\n').filter(l => l.trim()).forEach(line => {
        console.log(`${service.color}[${service.name}]${colors.reset} ${line}`);
      });
    });

    childProcess.stderr.on('data', (data) => {
      data.toString().split('\n').filter(l => l.trim()).forEach(line => {
        console.log(`${service.color}[${service.name}]${colors.reset} ${colors.red}${line}${colors.reset}`);
      });
    });

    childProcess.on('close', (code, signal) => {
      if (code !== 0) {
        console.log(`${service.color}[${service.name}]${colors.reset} ${colors.red}exited unexpectedly (code: ${code}, signal: ${signal})${colors.reset}`);
      }
    });

    processes.push({ name: service.name, process: childProcess, color: service.color });
  });

  setTimeout(() => {
    console.log(`${colors.bright}\n📊 System Status:${colors.reset}`);
    console.log(`🎯 Monitor:  ${colors.cyan}http://localhost:${process.env.PERFORMANCE_MONITOR_PORT || 3099}${colors.reset}`);
    console.log(`🎛️  Manager:  ${colors.green}http://localhost:${process.env.MANAGER_PORT || 3000}${colors.reset}`);
    console.log(`🤖 Agent-1 (llama3-8b):   ${colors.green}http://localhost:${process.env.AGENT_1_PORT || 3005}${colors.reset}`);
    console.log(`🤖 Agent-2 (mixtral-8x7b): ${colors.green}http://localhost:${process.env.AGENT_2_PORT || 3006}${colors.reset}`);
    console.log(`🤖 Agent-3 (gemma2-9b):   ${colors.green}http://localhost:${process.env.AGENT_3_PORT || 3007}${colors.reset}`);
    console.log(`🤖 Agent-4 (llama3-70b):  ${colors.green}http://localhost:${process.env.AGENT_4_PORT || 3008}${colors.reset}`);
    console.log(`${colors.green}\n✅ All services started${colors.reset}`);
    console.log(`${colors.yellow}⚠️  Press Ctrl+C to stop all services${colors.reset}`);
  }, 3000);

  process.on('SIGINT', () => {
    console.log(`\n${colors.yellow}🛑 Shutting down...${colors.reset}`);
    processes.forEach(({ name, process: p, color }) => {
      console.log(`${color}[${name}]${colors.reset} Stopping...`);
      p.kill('SIGTERM');
    });
    setTimeout(() => {
      console.log(`${colors.green}✅ All services stopped${colors.reset}`);
      process.exit(0);
    }, 2000);
  });

  process.stdin.resume();
}

startServices().catch(error => {
  console.error(`${colors.red}❌ Failed to start: ${error.message}${colors.reset}`);
  process.exit(1);
});
