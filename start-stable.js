#!/usr/bin/env node

/**
 * Stable startup script for Multi-Agent Chatbot System
 * Ensures proper initialization and connection handling
 */

const { spawn } = require('child_process');
const axios = require('axios');
const dotenv = require('dotenv');

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
  const ollamaBase = process.env.OLLAMA_API_BASE || 'http://172.18.224.1:11434/api';
  console.log(`${colors.blue}🔍 Checking Ollama connectivity at ${ollamaBase}...${colors.reset}`);
  
  try {
    const response = await axios.get(`${ollamaBase}/version`, { timeout: 10000 });
    console.log(`${colors.green}✅ Ollama connected successfully (version: ${response.data.version})${colors.reset}`);
    
    // Check available models
    const modelsResponse = await axios.get(`${ollamaBase}/tags`, { timeout: 10000 });
    const models = modelsResponse.data.models?.map(m => m.name) || [];
    console.log(`${colors.green}📚 Available models: ${models.join(', ')}${colors.reset}`);
    
    return true;
  } catch (error) {
    console.error(`${colors.red}❌ Ollama connection failed: ${error.message}${colors.reset}`);
    console.error(`${colors.yellow}💡 Please ensure:${colors.reset}`);
    console.error(`   - Ollama is running on Windows with: ollama serve --host 0.0.0.0`);
    console.error(`   - Windows Firewall allows port 11434`);
    console.error(`   - OLLAMA_MODELS environment variable points to your D drive models`);
    return false;
  }
}

// Pre-warm all models
async function warmAllModels() {
  console.log(`${colors.yellow}🔥 Pre-warming models for faster responses...${colors.reset}`);
  
  const models = ['llama3:latest', 'mistral:latest', 'phi3:latest', 'qwen2.5-coder:latest'];
  
  for (const model of models) {
    try {
      console.log(`${colors.blue}  Warming ${model}...${colors.reset}`);
      await axios.post(`${process.env.OLLAMA_API_BASE || 'http://172.18.224.1:11434/api'}/generate`, {
        model: model,
        prompt: 'Ready',
        stream: false,
        options: { temperature: 0.1, num_predict: 5 }
      }, { timeout: 45000 });
      console.log(`${colors.green}  ✅ ${model} warmed${colors.reset}`);
    } catch (error) {
      console.log(`${colors.yellow}  ⚠️ ${model} warming failed (will try later)${colors.reset}`);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Start services with improved error handling
async function startServices() {
  const isOllamaReady = await checkOllamaConnection();
  
  if (!isOllamaReady) {
    console.error(`${colors.red}🛑 Cannot start services without Ollama connection${colors.reset}`);
    process.exit(1);
  }
  
  // Pre-warm models
  await warmAllModels();
  
  console.log(`${colors.bright}\n📡 Starting all services...${colors.reset}`);
  
  const services = [
    { name: 'MONITOR', script: 'performance-monitor.js', color: colors.cyan },
    { name: 'MANAGER', script: 'manager/index.js', color: colors.blue },
    { name: 'AGENT-1', script: 'agent-llama3/index.js', color: colors.green },
    { name: 'AGENT-2', script: 'agent-mistral/index.js', color: colors.yellow },
    { name: 'AGENT-3', script: 'agent-phi3/index.js', color: colors.magenta },
    { name: 'AGENT-4', script: 'agent-qwen/index.js', color: colors.red }
  ];
  
  const processes = [];
  
  for (const service of services) {
    console.log(`${service.color}[${service.name}]${colors.reset} Starting...`);
    
    const childProcess = spawn('node', [service.script], {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env }
    });
    
    childProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        console.log(`${service.color}[${service.name}]${colors.reset} ${line}`);
      });
    });
    
    childProcess.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        console.error(`${service.color}[${service.name}]${colors.reset} ${colors.red}${line}${colors.reset}`);
      });
    });
    
    childProcess.on('exit', (code, signal) => {
      if (signal !== 'SIGINT' && signal !== 'SIGTERM') {
        console.error(`${service.color}[${service.name}]${colors.reset} ${colors.red}exited unexpectedly (code: ${code}, signal: ${signal})${colors.reset}`);
      }
    });
    
    processes.push({ name: service.name, process: childProcess });
    
    // Small delay between starts
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Wait a bit for services to initialize
  await new Promise(resolve => setTimeout(resolve, 5000));
  
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
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log(`${colors.yellow}\n🛑 Shutting down all services...${colors.reset}`);
    processes.forEach(({ name, process }) => {
      console.log(`${colors.blue}Stopping ${name}...${colors.reset}`);
      process.kill('SIGINT');
    });
    
    setTimeout(() => {
      console.log(`${colors.green}👋 All services stopped${colors.reset}`);
      process.exit(0);
    }, 3000);
  });
  
  // Keep the main process alive
  process.stdin.resume();
}

startServices().catch(error => {
  console.error(`${colors.red}❌ Failed to start services:${colors.reset}`, error);
  process.exit(1);
});