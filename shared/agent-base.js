/**
 * Base Agent Implementation
 * 
 * Provides common functionality for all agent services including:
 * - Message handling
 * - Express server setup
 * - LLM interaction via Ollama
 */
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');

// Import shared utilities
const { logger } = require('./logger');
const { generateResponse } = require('./ollama');
const { PERFORMATIVES, createMessage, validateMessage } = require('./messaging');
const { AgentMemory, MEMORY_TYPES } = require('./memory');

// Load environment variables
dotenv.config();

/**
 * Base Agent class with shared functionality
 */
class BaseAgent {
  /**
   * Initialize a new agent
   * 
   * @param {string} agentId - Unique identifier for this agent (e.g., 'agent-mistral')
   * @param {string} model - Ollama model to use
   * @param {number} port - Port to run this agent's HTTP server
   * @param {Object} options - Additional agent options
   */
  constructor(agentId, model, port, options = {}) {
    this.agentId = agentId;
    this.model = model;
    this.port = port;
    this.options = options;
    this.personality = options.personality || '';

    // Initialize memory system
    this.memory = null;
    this.memoryInitialized = false;

    // Create Express app
    this.app = express();
    
    // Configure middleware
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(morgan('dev'));
    
    // Initialize routes
    this.setupRoutes();
  }

  /**
   * Initialize memory system for a specific user
   */
  async initializeMemory(userId = 'default') {
    if (!this.memoryInitialized || (this.memory && this.memory.userId !== userId)) {
      this.memory = new AgentMemory(this.agentId, userId);
      await this.memory.initialize();
      this.memoryInitialized = true;
      logger.info(`Memory initialized for ${this.agentId} (user: ${userId})`);
    }
  }

  /**
   * Set up Express routes
   */
  setupRoutes() {
    // Handle incoming messages
    this.app.post('/message', async (req, res) => {
      try {
        const message = req.body;
        const userId = message.userId || 'default';
        
        logger.info(`${this.agentId} received message`, { from: message.from, userId });
        
        // Initialize memory for this user
        await this.initializeMemory(userId);
        
        // Validate incoming message structure
        if (!message.from || !message.content) {
          return res.status(400).json({ 
            error: 'Message must contain from and content fields' 
          });
        }
        
        // Ensure message has valid performative
        if (!message.performative || !Object.values(PERFORMATIVES).includes(message.performative)) {
          message.performative = PERFORMATIVES.INFORM;
        }
        
        // Create proper message structure
        const structuredMessage = createMessage(
          message.from,
          this.agentId,
          message.content,
          message.performative,
          message.metadata || {}
        );
        
        // Generate response using the LLM with memory
        const response = await this.generateAgentResponse(structuredMessage);
        
        res.json(response);
      } catch (error) {
        logger.error(`${this.agentId} error:`, error.message);
        res.status(500).json({ 
          error: `Error processing message: ${error.message}` 
        });
      }
    });
    
    // Status endpoint
    this.app.get('/status', async (req, res) => {
      const memoryStats = this.memory ? this.memory.getMemoryStats() : null;
      res.json({
        status: 'online',
        agent: this.agentId,
        model: this.model,
        memory: memoryStats
      });
    });

    // Memory endpoint
    this.app.get('/memory/:userId?', async (req, res) => {
      try {
        const userId = req.params.userId || 'default';
        await this.initializeMemory(userId);
        
        const stats = this.memory.getMemoryStats();
        const recentContext = await this.memory.getRecentContext(5);
        const preferences = await this.memory.getUserPreferences();
        
        res.json({
          stats,
          recentContext,
          preferences
        });
      } catch (error) {
        logger.error(`Error retrieving memory: ${error.message}`);
        res.status(500).json({ error: 'Failed to retrieve memory' });
      }
    });
  }

  /**
   * Generate a prompt for the LLM based on the incoming message
   * 
   * @param {Object} message - Incoming message
   * @returns {Promise<string>} - Prompt for the LLM
   */
  async createPrompt(message) {
    // Base prompt with personality if specified
    let prompt = this.personality ? `${this.personality}\n\n` : '';
    
    prompt += `You are ${this.agentId}, an AI assistant.`;

    // Add memory context if available
    if (this.memory) {
      try {
        // Get relevant memories
        const relevantMemories = await this.memory.searchMemories(message.content, 3);
        const recentContext = await this.memory.getRecentContext(2);
        const preferences = await this.memory.getUserPreferences();

        // Add memory context to prompt
        if (relevantMemories.length > 0) {
          prompt += `\n\nRelevant memories:`;
          relevantMemories.forEach(memory => {
            prompt += `\n- ${memory.content}`;
          });
        }

        if (recentContext.length > 0) {
          prompt += `\n\nRecent conversation context:`;
          recentContext.forEach(context => {
            try {
              const contextData = JSON.parse(context.content);
              prompt += `\n- User: ${contextData.userMessage}`;
              prompt += `\n- You: ${contextData.agentResponse}`;
            } catch (e) {
              // Skip malformed context
            }
          });
        }

        if (preferences.length > 0) {
          prompt += `\n\nUser preferences:`;
          preferences.forEach(pref => {
            try {
              const prefData = JSON.parse(pref.content);
              prompt += `\n- ${prefData.preference}: ${prefData.value}`;
            } catch (e) {
              // Skip malformed preferences
            }
          });
        }
      } catch (error) {
        logger.warn(`Error retrieving memory context: ${error.message}`);
      }
    }

    prompt += `\n\n${message.from} asks: ${message.content}

Keep your response clear, helpful, and concise. Use your memory to provide personalized and contextually relevant responses.`;

    return prompt;
  }

  /**
   * Generate a response to an incoming message
   * 
   * @param {Object} message - Incoming message
   * @returns {Promise<Object>} - Structured response message
   */
  async generateAgentResponse(message) {
    const prompt = await this.createPrompt(message);
    
    try {
      // Adjust generation parameters based on prompt length
      const promptLength = prompt.length;
      let numPredict = 300; // Default length limit
      
      // For very long prompts, reduce the expected output length to help avoid timeouts
      if (promptLength > 8000) {
        numPredict = 200;
        logger.info(`${this.agentId}: Long prompt detected (${promptLength} chars). Reducing output length.`);
      } else if (promptLength > 4000) {
        numPredict = 250;
      }
      
      // Generate response using Ollama with timeout and retry
      let content;
      let retries = 3;
      
      while (retries >= 0) {
        try {
          // Log attempt for debugging
          if (retries < 3) {
            logger.info(`${this.agentId}: Retry attempt ${3-retries} for message from ${message.from}`);
          }
          
          content = await generateResponse(this.model, prompt, { 
            temperature: 0.7,
            num_predict: numPredict
          });
          
          // Validate content before proceeding
          if (content && content.trim().length > 0) {
            break; // Exit loop if successful and content is valid
          } else {
            throw new Error('Empty response received');
          }
        } catch (err) {
          if (retries === 0) {
            // On final failure, log detailed error
            logger.error(`${this.agentId}: All retries failed for message from ${message.from}. Error: ${err.message}`);
            throw err;
          }
          retries--;
          logger.warn(`${this.agentId}: Generation failed. Retrying... (${retries} attempts left). Error: ${err.message}`);
          
          // Wait progressively longer before retrying
          await new Promise(resolve => setTimeout(resolve, (4-retries) * 1000));
        }
      }
      
      // If content is still undefined or null, use a fallback message
      if (!content) {
        logger.warn(`${this.agentId}: Empty response received after successful API call`);
        content = "I received your message, but I'm having trouble generating a specific response right now.";
      }
      
      // Store conversation in memory
      if (this.memory) {
        try {
          await this.memory.storeConversation(
            message.content,
            content,
            {
              conversationId: message.conversationId || 'unknown',
              messageId: message.id,
              timestamp: new Date().toISOString()
            }
          );

          // Extract and store potential preferences from the conversation
          await this.extractAndStorePreferences(message.content, content);
        } catch (error) {
          logger.warn(`Error storing conversation memory: ${error.message}`);
        }
      }
      
      // Create structured response message with correct parameter order: from, to, content, performative
      return createMessage(
        this.agentId,                 // from
        message.from,                 // to
        content,                      // content
        PERFORMATIVES.RESPOND         // performative
      );
    } catch (error) {
      logger.error(`Error generating response with ${this.model}:`, error.message);
      
      // Provide a more helpful error message for timeouts
      let errorMessage = "I apologize, but I'm having trouble generating a response at the moment.";
      
      if (error.message.includes('timeout')) {
        errorMessage = "I apologize, but your request is too complex for me to process right now. Please try a shorter or simpler request.";
      }
      
      // Return error message if LLM fails
      return createMessage(
        this.agentId,                 // from
        message.from,                 // to
        errorMessage,                 // content
        PERFORMATIVES.RESPOND         // performative
      );
    }
  }

  /**
   * Extract and store user preferences from conversation
   */
  async extractAndStorePreferences(userMessage, agentResponse) {
    if (!this.memory) return;

    try {
      // Simple heuristic-based preference extraction
      const userLower = userMessage.toLowerCase();
      
      // Language preferences
      if (userLower.includes('speak in') || userLower.includes('language')) {
        const languageMatch = userLower.match(/speak in (\w+)|language.*?(\w+)/);
        if (languageMatch) {
          const language = languageMatch[1] || languageMatch[2];
          await this.memory.storePreference('language', language, 0.7);
        }
      }
      
      // Communication style preferences
      if (userLower.includes('brief') || userLower.includes('short')) {
        await this.memory.storePreference('responseStyle', 'brief', 0.6);
      }
      if (userLower.includes('detailed') || userLower.includes('explain')) {
        await this.memory.storePreference('responseStyle', 'detailed', 0.6);
      }
      
      // Topic interests
      if (userLower.includes('interested in') || userLower.includes('like')) {
        const interestMatch = userLower.match(/interested in (.+?)[.!?]|like (.+?)[.!?]/);
        if (interestMatch) {
          const interest = interestMatch[1] || interestMatch[2];
          await this.memory.storePreference('interests', interest, 0.5);
        }
      }
      
      // Professional context
      if (userLower.includes('work') || userLower.includes('job') || userLower.includes('profession')) {
        const workMatch = userLower.match(/work.+?as.+?(\w+)|job.+?(\w+)|profession.+?(\w+)/);
        if (workMatch) {
          const profession = workMatch[1] || workMatch[2] || workMatch[3];
          await this.memory.storePreference('profession', profession, 0.8);
        }
      }
    } catch (error) {
      logger.warn(`Error extracting preferences: ${error.message}`);
    }
  }

  /**
   * Start the agent's HTTP server
   */
  start() {
    this.server = this.app.listen(this.port, () => {
      logger.info(`${this.agentId} running on port ${this.port}`);
    });

    // Set up periodic memory cleanup
    this.memoryCleanupInterval = setInterval(async () => {
      if (this.memory) {
        try {
          await this.memory.cleanupMemories();
        } catch (error) {
          logger.warn(`Memory cleanup failed: ${error.message}`);
        }
      }
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  /**
   * Stop the agent's HTTP server
   */
  stop() {
    if (this.server) {
      this.server.close();
    }
    
    // Clear memory cleanup interval
    if (this.memoryCleanupInterval) {
      clearInterval(this.memoryCleanupInterval);
    }
  }
}

module.exports = BaseAgent; 