/**
 * Agent Configuration System
 *
 * Manages custom prompts and configurations for agents.
 * System prompts are resolved in priority order:
 *   1. Active PromptVersion document in MongoDB (cached 60 s)
 *   2. JSON file on disk (agent-configs.json)
 *   3. Hard-coded DEFAULT_CONFIGS in this module
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');

// ─── Prompt version cache ─────────────────────────────────────────────────────
// Keeps a short-lived in-process cache so every LLM call doesn't hit MongoDB.
// The cache is busted via invalidatePromptCache() when a version is activated.

const PROMPT_CACHE_TTL_MS = 60_000; // 1 minute
const _promptCache = new Map(); // agentId → { systemPrompt, expiresAt }

/**
 * Return the active system prompt from MongoDB (if any), or null.
 * Result is cached for PROMPT_CACHE_TTL_MS to minimise DB round-trips.
 */
async function getActiveSystemPrompt(agentId) {
  const cached = _promptCache.get(agentId);
  if (cached && Date.now() < cached.expiresAt) return cached.systemPrompt;

  try {
    // Lazy-require to avoid loading Mongoose before the DB is connected
    const PromptVersion = require('../models/PromptVersion');
    const active = await PromptVersion.getActive(agentId);
    if (active) {
      _promptCache.set(agentId, {
        systemPrompt: active.systemPrompt,
        expiresAt: Date.now() + PROMPT_CACHE_TTL_MS,
      });
      return active.systemPrompt;
    }
  } catch (err) {
    logger.warn(`Prompt version DB lookup failed for ${agentId}: ${err.message}`);
  }

  return null; // Fall through to file-based / default config
}

/**
 * Bust the in-process cache for a specific agent.
 * Called by the prompts router after a successful activation.
 */
function invalidatePromptCache(agentId) {
  _promptCache.delete(agentId);
}

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
 * Build system prompt for agent based on configuration.
 *
 * Resolves the system prompt in priority order:
 *   1. Active PromptVersion in MongoDB (cached 60 s)
 *   2. agentConfig.systemPrompt (file or DEFAULT_CONFIGS)
 *
 * @param {Object} agentConfig - Agent config object (must include .name or .agentId)
 * @param {string|null} conversationContext - Optional additional context
 * @returns {Promise<string>}
 */
async function buildSystemPrompt(agentConfig, conversationContext = null) {
  // Derive a stable agent ID to look up in the version registry
  const agentId = agentConfig.agentId || agentConfig.name?.toLowerCase().replace(/\s+/g, '-') || null;
  const versionedPrompt = agentId ? await getActiveSystemPrompt(agentId) : null;
  let prompt = versionedPrompt || agentConfig.systemPrompt;
  
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
  getActiveSystemPrompt,
  invalidatePromptCache,
  DEFAULT_CONFIGS
};