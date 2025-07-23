/**
 * Environment Setup Script
 * 
 * Creates a .env file with default configuration for the Multi-Agent Chatbot System
 */
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

// Default environment configuration
const defaultConfig = {
  // Manager Configuration
  MANAGER_PORT: '3000',
  MANAGER_MODEL: 'llama3:latest',
  
  // Agent Ports (4 flexible agents)
  AGENT_1_PORT: '3001',
  AGENT_2_PORT: '3002', 
  AGENT_3_PORT: '3003',
  AGENT_4_PORT: '3004',
  
  // Agent Models
  AGENT_1_MODEL: 'llama3:latest',
  AGENT_2_MODEL: 'mistral:latest',
  AGENT_3_MODEL: 'phi3:latest', 
  AGENT_4_MODEL: 'qwen:latest',
  
  // Ollama Configuration
  OLLAMA_API_URL: 'http://localhost:11434',
  
  // Timeout Settings
  OLLAMA_TIMEOUT: '60000',
  AGENT_TIMEOUT: '60000',
  
  // Logging
  LOG_LEVEL: 'info',
  LOG_DIR: './logs'
};

function createEnvFile() {
  let envContent = `# Multi-Agent Chatbot System Configuration
# Generated on ${new Date().toISOString()}

`;

  // Add each configuration with comments
  const sections = {
    'Manager Configuration': ['MANAGER_PORT', 'MANAGER_MODEL'],
    'Agent Ports': ['AGENT_1_PORT', 'AGENT_2_PORT', 'AGENT_3_PORT', 'AGENT_4_PORT'],
    'Agent Models': ['AGENT_1_MODEL', 'AGENT_2_MODEL', 'AGENT_3_MODEL', 'AGENT_4_MODEL'],
    'Ollama Configuration': ['OLLAMA_API_URL'],
    'Timeout Settings': ['OLLAMA_TIMEOUT', 'AGENT_TIMEOUT'],
    'Logging': ['LOG_LEVEL', 'LOG_DIR']
  };

  Object.entries(sections).forEach(([sectionName, keys]) => {
    envContent += `# ${sectionName}\n`;
    keys.forEach(key => {
      envContent += `${key}=${defaultConfig[key]}\n`;
    });
    envContent += '\n';
  });

  // Write the file
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env file with default configuration');
}

function validateConfig() {
  console.log('🔍 Validating configuration...');
  
  const requiredKeys = Object.keys(defaultConfig);
  const missing = [];
  
  requiredKeys.forEach(key => {
    if (!defaultConfig[key]) {
      missing.push(key);
    }
  });
  
  if (missing.length > 0) {
    console.log('❌ Missing required configuration:', missing);
    return false;
  }
  
  console.log('✅ Configuration validation passed');
  return true;
}

function main() {
  console.log('🚀 Setting up Multi-Agent Chatbot System environment...\n');
  
  // Check if .env already exists
  if (fs.existsSync(envPath)) {
    console.log('⚠️  .env file already exists');
    console.log('Would you like to overwrite it? (This will reset all custom settings)');
    console.log('If you want to keep your current settings, press Ctrl+C now.');
    console.log('Otherwise, the file will be overwritten in 5 seconds...\n');
    
    setTimeout(() => {
      createEnvFile();
      validateAndComplete();
    }, 5000);
  } else {
    createEnvFile();
    validateAndComplete();
  }
}

function validateAndComplete() {
  if (validateConfig()) {
    console.log('\n📋 Configuration Summary:');
    console.log(`Manager will run on: http://localhost:${defaultConfig.MANAGER_PORT}`);
    console.log(`Agent-1 will run on: http://localhost:${defaultConfig.AGENT_1_PORT}`);
    console.log(`Agent-2 will run on: http://localhost:${defaultConfig.AGENT_2_PORT}`);
    console.log(`Agent-3 will run on: http://localhost:${defaultConfig.AGENT_3_PORT}`);
    console.log(`Agent-4 will run on: http://localhost:${defaultConfig.AGENT_4_PORT}`);
    console.log(`Ollama API: ${defaultConfig.OLLAMA_API_URL}`);
    
    console.log('\n🎉 Environment setup complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Ensure Ollama is running locally');
    console.log('2. Run: npm run download-models');
    console.log('3. Run: npm start');
    console.log('\n💡 You can modify the .env file to customize the configuration');
  } else {
    console.log('❌ Environment setup failed');
    process.exit(1);
  }
}

// Run the setup
main(); 