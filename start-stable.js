#!/usr/bin/env node

/**
 * Multi-Agent Chatbot System Stable Startup Script
 * Starts all agents, manager, and monitoring services
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { getDynamicOllamaURL } = require('./src/shared/wsl-network');

// Load environment variables
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

console.log(`${colors.bright}🚀 Starting Multi-Agent Chatbot System (Stable Mode)...${colors.reset}\n`);

// Check Ollama connectivity first
async function checkOllamaConnection() {
  console.log(`${colors.blue}🔍 Detecting Ollama connection...${colors.reset}`);
  
  try {
    const ollamaURL = await getDynamicOllamaURL();
    console.log(`${colors.blue}🔍 Checking Ollama connectivity at ${ollamaURL}...${colors.reset}`);
    
    const response = await fetch(`${ollamaURL.replace('/api', '')}/api/version`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`${colors.green}✅ Ollama connected successfully (version: ${data.version})${colors.reset}`);
    
    // Check available models
    try {
      const modelsResponse = await fetch(`${ollamaURL.replace('/api', '')}/api/tags`);
      if (modelsResponse.ok) {
        const modelsData = await modelsResponse.json();
        const modelNames = modelsData.models.map(m => m.name).join(', ');
        console.log(`${colors.green}📚 Available models: ${modelNames}${colors.reset}`);
        
        // Pre-warm models for faster responses
        await warmModels(modelsData.models);
      }
    } catch (modelsError) {
      console.log(`${colors.yellow}⚠️  Could not fetch models list: ${modelsError.message}${colors.reset}`);
    }
    
    return true;
  } catch (error) {
    console.error(`${colors.red}❌ Ollama connection failed: ${error.message}${colors.reset}`);
    console.log(`${colors.yellow}💡 Please ensure:${colors.reset}`);
    console.log(`   - Ollama is running on Windows with: ollama serve --host 0.0.0.0`);
    console.log(`   - Windows Firewall allows port 11434`);
    console.log(`   - OLLAMA_MODELS environment variable points to your D drive models`);
    console.log(`   - WSL2 network connectivity is working`);
    console.log(`${colors.red}🛑 Cannot start services without Ollama connection${colors.reset}`);
    process.exit(1);
  }
}

// Pre-warm models for faster responses
async function warmModels(models) {
  console.log(`${colors.yellow}🔥 Pre-warming models for faster responses...${colors.reset}`);
  
  const modelsToWarm = ['llama3:latest', 'mistral:latest', 'phi3:latest', 'qwen2.5-coder:latest'];
  const availableModels = models.map(m => m.name);
  
  for (const modelName of modelsToWarm) {
    if (availableModels.includes(modelName)) {
      try {
        console.log(`${colors.blue}  Warming ${modelName}...${colors.reset}`);
        const ollamaURL = await getDynamicOllamaURL();
        
        const response = await fetch(`${ollamaURL.replace('/api', '')}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelName,
            prompt: 'Hello',
            stream: false,
            options: { num_predict: 1 }
          })
        });
        
        if (response.ok) {
          console.log(`${colors.green}  ✅ ${modelName} warmed${colors.reset}`);
        }
      } catch (error) {
        console.log(`${colors.yellow}  ⚠️  Could not warm ${modelName}: ${error.message}${colors.reset}`);
      }
    }
  }
}

// Main startup function
async function startServices() {
  await checkOllamaConnection();
  
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
  
  // Start all services
  services.forEach(service => {
    console.log(`${service.color}[${service.name}]${colors.reset} Starting...`);
    
    const childProcess = spawn('node', [service.script], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '1' }
    });
    
    // Handle process output
    childProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        console.log(`${service.color}[${service.name}]${colors.reset} ${line}`);
      });
    });
    
    childProcess.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
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
  
  // Wait a moment for services to start
  setTimeout(() => {
    console.log(`${colors.bright}\n📊 System Status:${colors.reset}`);
    console.log(`🎯 Performance Monitor: ${colors.cyan}http://localhost:3099${colors.reset}`);
    console.log(`🎛️  Manager API: ${colors.green}http://localhost:3000${colors.reset}`);
    console.log(`🤖 Agent-1 (llama3): ${colors.green}http://localhost:3001${colors.reset}`);
    console.log(`🤖 Agent-2 (mistral): ${colors.green}http://localhost:3002${colors.reset}`);
    console.log(`🤖 Agent-3 (phi3): ${colors.green}http://localhost:3003${colors.reset}`);
    console.log(`🤖 Agent-4 (qwen2.5-coder): ${colors.green}http://localhost:3004${colors.reset}`);
    
    console.log(`${colors.bright}\n💡 API Endpoints:${colors.reset}`);
    console.log(`POST /message - Send message to single agent`);
    console.log(`POST /team-conversation - Start team conversation`);
    console.log(`GET /conversation/:id - Get conversation history`);
    console.log(`GET /export-chat/:id - Export conversation as PDF`);
    console.log(`GET /status - System status`);
    
    console.log(`${colors.green}\n✅ All services started successfully!${colors.reset}`);
    console.log(`${colors.yellow}⚠️  Press Ctrl+C to stop all services${colors.reset}`);
  }, 3000);
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log(`\n${colors.yellow}🛑 Shutting down all services...${colors.reset}`);
    
    processes.forEach(({ name, process, color }) => {
      console.log(`${color}[${name}]${colors.reset} Stopping...`);
      process.kill('SIGTERM');
    });
    
    setTimeout(() => {
      console.log(`${colors.green}✅ All services stopped${colors.reset}`);
      process.exit(0);
    }, 2000);
  });
  
  // Keep the main process alive
  process.stdin.resume();
}

// Start the system
startServices().catch(error => {
  console.error(`${colors.red}❌ Failed to start system: ${error.message}${colors.reset}`);
  process.exit(1);
});