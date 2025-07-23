#!/usr/bin/env node

/**
 * Model Pre-warming Script
 * Loads all models into GPU memory before starting the multi-agent system
 */

const axios = require('axios');
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

const OLLAMA_API_BASE = process.env.OLLAMA_API_BASE || 'http://172.18.224.1:11434/api';

const models = [
  'llama3:latest',
  'mistral:latest', 
  'phi3:latest',
  'qwen2.5-coder:latest'
];

async function warmModel(modelName) {
  const startTime = Date.now();
  console.log(`${colors.blue}🔥 Warming ${modelName}...${colors.reset}`);
  
  try {
    const response = await axios.post(`${OLLAMA_API_BASE}/generate`, {
      model: modelName,
      prompt: 'Hi, please respond with just "Ready"',
      stream: false,
      options: {
        temperature: 0.1,
        num_predict: 10
      }
    }, {
      timeout: 60000
    });
    
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`${colors.green}✅ ${modelName} warmed in ${duration}s${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}❌ Failed to warm ${modelName}: ${error.message}${colors.reset}`);
    return false;
  }
}

async function warmAllModels() {
  console.log(`${colors.bright}🚀 Pre-warming all models for faster response times...${colors.reset}\n`);
  
  // Check Ollama connectivity first
  try {
    await axios.get(`${OLLAMA_API_BASE}/version`, { timeout: 5000 });
    console.log(`${colors.green}✅ Ollama connected${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}❌ Cannot connect to Ollama: ${error.message}${colors.reset}`);
    process.exit(1);
  }
  
  const results = [];
  
  // Warm models sequentially to avoid GPU memory conflicts
  for (const model of models) {
    const success = await warmModel(model);
    results.push({ model, success });
    
    // Small delay between models
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`${colors.bright}\n📊 Pre-warming Results:${colors.reset}`);
  results.forEach(({ model, success }) => {
    const status = success ? `${colors.green}✅ Ready${colors.reset}` : `${colors.red}❌ Failed${colors.reset}`;
    console.log(`  ${model}: ${status}`);
  });
  
  const successCount = results.filter(r => r.success).length;
  
  if (successCount === models.length) {
    console.log(`${colors.green}\n🎉 All models pre-warmed successfully!${colors.reset}`);
    console.log(`${colors.yellow}💡 Your agents will now respond much faster${colors.reset}`);
  } else {
    console.log(`${colors.yellow}\n⚠️  ${successCount}/${models.length} models warmed successfully${colors.reset}`);
  }
}

warmAllModels().catch(error => {
  console.error(`${colors.red}❌ Pre-warming failed:${colors.reset}`, error);
  process.exit(1);
});