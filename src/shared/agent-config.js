/**
 * Agent Configuration System
 * 
 * Manages custom prompts and configurations for agents
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');

// Default configuration directory
const CONFIG_DIR = path.join(__dirname, '..', 'config');
const AGENT_CONFIG_FILE = path.join(CONFIG_DIR, 'agent-configs.json');

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Default agent configurations
const DEFAULT_CONFIGS = {
  'agent-1': {
    name: 'Assistant',
    systemPrompt: 'You are a helpful AI assistant. Provide clear, accurate, and helpful responses.',
    personality: 'friendly and professional',
    specialties: ['general assistance', 'problem solving'],
    responseStyle: 'balanced',
    maxTokens: 1000,
    temperature: 0.7
  },
  'agent-2': {
    name: 'Analyst',
    systemPrompt: 'You are an analytical AI that excels at breaking down complex problems and providing detailed analysis.',
    personality: 'analytical and thorough',
    specialties: ['data analysis', 'research', 'critical thinking'],
    responseStyle: 'detailed',
    maxTokens: 1500,
    temperature: 0.3
  },
  'agent-3': {
    name: 'Creative',
    systemPrompt: 'You are a creative AI that thinks outside the box and provides innovative solutions and ideas.',
    personality: 'creative and imaginative',
    specialties: ['brainstorming', 'creative writing', 'innovation'],
    responseStyle: 'creative',
    maxTokens: 1200,
    temperature: 0.9
  },
  'agent-4': {
    name: 'Specialist',
    systemPrompt: 'You are a specialized AI that provides expert-level knowledge and technical assistance.',
    personality: 'expert and precise',
    specialties: ['technical support', 'expertise', 'problem resolution'],
    responseStyle: 'technical',
    maxTokens: 1000,
    temperature: 0.5
  }
};

/**
 * Load agent configurations from file
 */
function loadAgentConfigs() {
  try {
    if (fs.existsSync(AGENT_CONFIG_FILE)) {
      const data = fs.readFileSync(AGENT_CONFIG_FILE, 'utf8');
      const configs = JSON.parse(data);
      
      // Merge with defaults to ensure all fields are present
      const mergedConfigs = {};
      for (const agentId in DEFAULT_CONFIGS) {
        mergedConfigs[agentId] = {
          ...DEFAULT_CONFIGS[agentId],
          ...configs[agentId]
        };
      }
      
      return mergedConfigs;
    }
  } catch (error) {
    logger.error('Error loading agent configurations:', error.message);
  }
  
  return DEFAULT_CONFIGS;
}

/**
 * Save agent configurations to file
 */
function saveAgentConfigs(configs) {
  try {
    fs.writeFileSync(AGENT_CONFIG_FILE, JSON.stringify(configs, null, 2));
    logger.info('Agent configurations saved successfully');
    return true;
  } catch (error) {
    logger.error('Error saving agent configurations:', error.message);
    return false;
  }
}

/**
 * Get configuration for a specific agent
 */
function getAgentConfig(agentId) {
  const configs = loadAgentConfigs();
  return configs[agentId] || DEFAULT_CONFIGS[agentId];
}

/**
 * Update configuration for a specific agent
 */
function updateAgentConfig(agentId, newConfig) {
  const configs = loadAgentConfigs();
  
  if (!configs[agentId]) {
    logger.warn(`Agent ${agentId} not found, creating new configuration`);
    configs[agentId] = { ...DEFAULT_CONFIGS[agentId] };
  }
  
  // Merge new configuration with existing one
  configs[agentId] = {
    ...configs[agentId],
    ...newConfig,
    updatedAt: new Date().toISOString()
  };
  
  return saveAgentConfigs(configs);
}

/**
 * Reset agent configuration to default
 */
function resetAgentConfig(agentId) {
  const configs = loadAgentConfigs();
  configs[agentId] = { ...DEFAULT_CONFIGS[agentId] };
  return saveAgentConfigs(configs);
}

/**
 * Get all agent configurations
 */
function getAllAgentConfigs() {
  return loadAgentConfigs();
}

/**
 * Validate agent configuration
 */
function validateAgentConfig(config) {
  const requiredFields = ['name', 'systemPrompt', 'personality', 'specialties', 'responseStyle'];
  const errors = [];
  
  for (const field of requiredFields) {
    if (!config[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  if (config.maxTokens && (typeof config.maxTokens !== 'number' || config.maxTokens < 100 || config.maxTokens > 4000)) {
    errors.push('maxTokens must be a number between 100 and 4000');
  }
  
  if (config.temperature && (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2)) {
    errors.push('temperature must be a number between 0 and 2');
  }
  
  if (config.specialties && !Array.isArray(config.specialties)) {
    errors.push('specialties must be an array');
  }
  
  return errors;
}

/**
 * Build system prompt for agent based on configuration
 */
function buildSystemPrompt(agentConfig, conversationContext = null) {
  let prompt = agentConfig.systemPrompt;
  
  // Add personality and specialties
  if (agentConfig.personality) {
    prompt += `\n\nPersonality: You should be ${agentConfig.personality}.`;
  }
  
  if (agentConfig.specialties && agentConfig.specialties.length > 0) {
    prompt += `\n\nYour specialties include: ${agentConfig.specialties.join(', ')}.`;
  }
  
  // Add response style guidance
  if (agentConfig.responseStyle) {
    switch (agentConfig.responseStyle) {
      case 'concise':
        prompt += '\n\nKeep your responses concise and to the point.';
        break;
      case 'detailed':
        prompt += '\n\nProvide detailed, comprehensive responses with explanations.';
        break;
      case 'creative':
        prompt += '\n\nFeel free to be creative and think outside the box in your responses.';
        break;
      case 'technical':
        prompt += '\n\nProvide technical, precise responses with accurate information.';
        break;
      default:
        prompt += '\n\nProvide balanced responses that are helpful and informative.';
    }
  }
  
  // Add conversation context if provided
  if (conversationContext) {
    prompt += `\n\nConversation context: ${conversationContext}`;
  }
  
  return prompt;
}

module.exports = {
  loadAgentConfigs,
  saveAgentConfigs,
  getAgentConfig,
  updateAgentConfig,
  resetAgentConfig,
  getAllAgentConfigs,
  validateAgentConfig,
  buildSystemPrompt,
  DEFAULT_CONFIGS
};