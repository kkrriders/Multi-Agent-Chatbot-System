/**
 * Intelligent Model Management System
 * Handles GPU memory optimization, model persistence, and request queuing
 */

const axios = require('axios');
const { logger } = require('./logger');

class ModelManager {
  constructor(options = {}) {
    this.ollamaBase = options.ollamaBase || process.env.OLLAMA_API_BASE || 'http://172.18.224.1:11434/api';
    this.maxGPUMemory = options.maxGPUMemory || 7 * 1024 * 1024 * 1024; // 7GB
    this.requestQueue = new Map(); // agent -> queue of requests
    this.modelStats = new Map(); // model -> usage stats
    this.activeModel = null;
    this.modelLoadPromises = new Map(); // Prevent concurrent loads
    this.lastUsed = new Map(); // model -> timestamp
    
    // Model sizes (approximate in bytes)
    this.modelSizes = {
      'llama3:latest': 4.3 * 1024 * 1024 * 1024,      // 4.3GB
      'mistral:latest': 4.1 * 1024 * 1024 * 1024,     // 4.1GB  
      'phi3:latest': 2.2 * 1024 * 1024 * 1024,        // 2.2GB
      'qwen2.5-coder:latest': 4.7 * 1024 * 1024 * 1024 // 4.7GB
    };
    
    // Initialize queues for each agent
    ['agent-1', 'agent-2', 'agent-3', 'agent-4'].forEach(agentId => {
      this.requestQueue.set(agentId, []);
    });
  }

  /**
   * Get model for agent with smart caching
   */
  getModelForAgent(agentId) {
    const modelMap = {
      'agent-1': 'llama3:latest',
      'agent-2': 'mistral:latest', 
      'agent-3': 'phi3:latest',
      'agent-4': 'qwen2.5-coder:latest'
    };
    return modelMap[agentId];
  }

  /**
   * Queue a request and process intelligently
   */
  async queueRequest(agentId, requestData) {
    return new Promise((resolve, reject) => {
      const request = {
        agentId,
        data: requestData,
        resolve,
        reject,
        timestamp: Date.now()
      };
      
      const queue = this.requestQueue.get(agentId);
      queue.push(request);
      
      // Process queue immediately
      this.processQueue(agentId);
    });
  }

  /**
   * Process request queue for an agent
   */
  async processQueue(agentId) {
    const queue = this.requestQueue.get(agentId);
    if (queue.length === 0) return;
    
    const model = this.getModelForAgent(agentId);
    
    // If model is already active, process immediately
    if (this.activeModel === model) {
      const request = queue.shift();
      this.processRequest(request);
      return;
    }
    
    // If different model needed, ensure it's loaded first
    try {
      await this.ensureModelLoaded(model);
      
      // Process all queued requests for this model
      while (queue.length > 0) {
        const request = queue.shift();
        await this.processRequest(request);
      }
    } catch (error) {
      // Reject all queued requests if model loading fails
      while (queue.length > 0) {
        const request = queue.shift();
        request.reject(error);
      }
    }
  }

  /**
   * Ensure model is loaded and ready
   */
  async ensureModelLoaded(modelName) {
    // If already loading, wait for it
    if (this.modelLoadPromises.has(modelName)) {
      return this.modelLoadPromises.get(modelName);
    }
    
    // If already active, nothing to do
    if (this.activeModel === modelName) {
      return Promise.resolve();
    }
    
    // Load the model
    const loadPromise = this.loadModel(modelName);
    this.modelLoadPromises.set(modelName, loadPromise);
    
    try {
      await loadPromise;
      this.activeModel = modelName;
      this.lastUsed.set(modelName, Date.now());
      this.updateModelStats(modelName, 'loaded');
      
      logger.info(`Model ${modelName} loaded and ready`);
    } finally {
      this.modelLoadPromises.delete(modelName);
    }
  }

  /**
   * Load model with warming request
   */
  async loadModel(modelName) {
    const startTime = Date.now();
    
    try {
      logger.info(`Loading model ${modelName}...`);
      
      await axios.post(`${this.ollamaBase}/generate`, {
        model: modelName,
        prompt: 'System ready',
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 1
        }
      }, {
        timeout: 90000 // 90 second timeout for model loading
      });
      
      const duration = Date.now() - startTime;
      logger.info(`Model ${modelName} loaded in ${duration}ms`);
      
    } catch (error) {
      logger.error(`Failed to load model ${modelName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process individual request
   */
  async processRequest(request) {
    try {
      const { generateResponse } = require('./ollama');
      const model = this.getModelForAgent(request.agentId);
      
      const response = await generateResponse(model, request.data.prompt, request.data.options);
      
      this.updateModelStats(model, 'used');
      request.resolve(response);
      
    } catch (error) {
      logger.error(`Request processing failed for ${request.agentId}: ${error.message}`);
      request.reject(error);
    }
  }

  /**
   * Update model usage statistics
   */
  updateModelStats(modelName, action) {
    if (!this.modelStats.has(modelName)) {
      this.modelStats.set(modelName, {
        loads: 0,
        uses: 0,
        lastUsed: null,
        totalTime: 0
      });
    }
    
    const stats = this.modelStats.get(modelName);
    
    if (action === 'loaded') {
      stats.loads++;
    } else if (action === 'used') {
      stats.uses++;
      stats.lastUsed = Date.now();
    }
  }

  /**
   * Get performance analytics
   */
  getAnalytics() {
    const analytics = {
      activeModel: this.activeModel,
      queueLengths: {},
      modelStats: Object.fromEntries(this.modelStats),
      recommendations: []
    };
    
    // Queue lengths
    for (const [agentId, queue] of this.requestQueue) {
      analytics.queueLengths[agentId] = queue.length;
    }
    
    // Performance recommendations
    const mostUsedModel = this.getMostUsedModel();
    if (mostUsedModel && mostUsedModel !== this.activeModel) {
      analytics.recommendations.push(`Consider keeping ${mostUsedModel} as primary model`);
    }
    
    return analytics;
  }

  /**
   * Get most frequently used model
   */
  getMostUsedModel() {
    let maxUses = 0;
    let mostUsed = null;
    
    for (const [model, stats] of this.modelStats) {
      if (stats.uses > maxUses) {
        maxUses = stats.uses;
        mostUsed = model;
      }
    }
    
    return mostUsed;
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.ollamaBase}/version`, { timeout: 5000 });
      return {
        status: 'healthy',
        version: response.data.version,
        activeModel: this.activeModel,
        queueSizes: Object.fromEntries(
          Array.from(this.requestQueue.entries()).map(([agent, queue]) => [agent, queue.length])
        )
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

module.exports = { ModelManager };