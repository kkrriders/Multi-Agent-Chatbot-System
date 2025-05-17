/** * Download all required Ollama models *  * This script pulls the Ollama models needed for the multi-agent system: * - Mistral * - LLaMA 3  * - Phi-3 * - Qwen 2.5coder:3b */
const dotenv = require('dotenv');
const { pullModel } = require('./shared/ollama');
const { logger } = require('./shared/logger');

// Load environment variables
dotenv.config();

const models = [
  process.env.MISTRAL_MODEL || 'mistral:latest',
  process.env.LLAMA3_MODEL || 'llama3:latest',
  process.env.PHI3_MODEL || 'phi3:3.8b',
  process.env.QWEN_MODEL || 'qwen2.5-coder:3b',
  process.env.MANAGER_MODEL || 'llama3:latest'
];

/**
 * Download all required models
 */
async function downloadModels() {
  logger.info('Starting model downloads...');
  
  // Track failures
  const failures = [];
  
  // Pull each model
  for (const model of models) {
    try {
      logger.info(`Downloading model: ${model}`);
      const success = await pullModel(model);
      
      if (success) {
        logger.info(`Successfully downloaded ${model}`);
      } else {
        logger.error(`Failed to download ${model}`);
        failures.push(model);
      }
    } catch (error) {
      logger.error(`Error downloading ${model}:`, error.message);
      failures.push(model);
    }
  }
  
  // Report results
  if (failures.length === 0) {
    logger.info('✅ All models downloaded successfully!');
  } else {
    logger.error(`❌ Failed to download ${failures.length} model(s): ${failures.join(', ')}`);
    logger.info('You may need to download these models manually using Ollama.');
  }
}

// Run the download
downloadModels().catch(error => {
  logger.error('Fatal error:', error.message);
  process.exit(1);
}); 