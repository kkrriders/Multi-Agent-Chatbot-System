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
   * Set up Express routes
   */
  setupRoutes() {
    // Handle incoming messages
    this.app.post('/message', async (req, res) => {
      try {
        const message = req.body;
        logger.info(`${this.agentId} received message`, { from: message.from });
        
        // Validate incoming message
        const validation = validateMessage(message);
        if (!validation.isValid) {
          return res.status(400).json({ error: validation.error });
        }
        
        // Generate response using the LLM
        const response = await this.generateAgentResponse(message);
        
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
      res.json({
        status: 'online',
        agent: this.agentId,
        model: this.model
      });
    });
  }

  /**
   * Generate a prompt for the LLM based on the incoming message
   * 
   * @param {Object} message - Incoming message
   * @returns {string} - Prompt for the LLM
   */
  createPrompt(message) {
    // Base prompt with personality if specified
    let prompt = this.personality ? `${this.personality}\n\n` : '';
    
    prompt += `You are ${this.agentId}, an AI assistant.

${message.from} asks: ${message.content}

Keep your response clear, helpful, and concise.`;

    return prompt;
  }

  /**
   * Generate a response to an incoming message
   * 
   * @param {Object} message - Incoming message
   * @returns {Promise<Object>} - Structured response message
   */
  async generateAgentResponse(message) {
    const prompt = this.createPrompt(message);
    
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
      let retries = 2;
      
      while (retries >= 0) {
        try {
          // Log attempt for debugging
          if (retries < 2) {
            logger.info(`${this.agentId}: Retry attempt ${2-retries} for message from ${message.from}`);
          }
          
          content = await generateResponse(this.model, prompt, { 
            temperature: 0.7,
            num_predict: numPredict
          });
          break; // Exit loop if successful
        } catch (err) {
          if (retries === 0) {
            // On final failure, log detailed error
            logger.error(`${this.agentId}: All retries failed for message from ${message.from}. Error: ${err.message}`);
            throw err;
          }
          retries--;
          logger.warn(`${this.agentId}: Generation failed. Retrying... (${retries} attempts left)`);
          
          // Wait a moment before retrying to allow system resources to recover
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // If content is still undefined or null, use a fallback message
      if (!content) {
        logger.warn(`${this.agentId}: Empty response received after successful API call`);
        content = "I received your message, but I'm having trouble generating a specific response right now.";
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
   * Start the agent's HTTP server
   */
  start() {
    this.server = this.app.listen(this.port, () => {
      logger.info(`${this.agentId} running on port ${this.port}`);
    });
  }

  /**
   * Stop the agent's HTTP server
   */
  stop() {
    if (this.server) {
      this.server.close();
    }
  }
}

module.exports = BaseAgent; 