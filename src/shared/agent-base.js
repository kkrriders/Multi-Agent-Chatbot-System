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
const { generateResponseWithMeta, generateResponseWithMetaJson, generateResponseJson, generateResponseStream } = require('./ollama');
const { tracedGenerate } = require('./llmTracer');
const { routeModel } = require('./modelRouter');
const { verifyAgentRequest } = require('./agentAuth');
const { buildPromptContext } = require('./summarizer');
const { PERFORMATIVES, createMessage, validateMessage } = require('./messaging');
const { AgentMemory, MEMORY_TYPES } = require('./memory');
const { ModelManager } = require('./model-manager');

// Load environment variables
dotenv.config();

// Global Model Manager instance (singleton)
let globalModelManager = null;

function getModelManager() {
  if (!globalModelManager) {
    globalModelManager = new ModelManager({
      ollamaBase: process.env.OLLAMA_API_BASE || 'http://172.18.224.1:11434/api',
      maxGPUMemory: 7 * 1024 * 1024 * 1024 // 7GB for RTX 4070
    });
  }
  return globalModelManager;
}

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
    this.app.use(cors({ origin: false })); // agents accept no cross-origin browser requests
    // Capture raw body so agentAuth HMAC can verify the exact bytes sent by the manager
    this.app.use(express.json({
      verify: (req, _res, buf) => { req.rawBody = buf; }
    }));
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
    // Verify HMAC signature on all state-changing agent endpoints.
    // /status is intentionally excluded so health checks work without signing.
    const agentAuthMiddleware = verifyAgentRequest(process.env.AGENT_SHARED_SECRET || '');

    // Handle incoming messages
    this.app.post('/message', agentAuthMiddleware, async (req, res) => {
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
    
    // Streaming endpoint — returns tokens via Server-Sent Events
    this.app.post('/message/stream', agentAuthMiddleware, async (req, res) => {
      // Set SSE headers before anything async so the client stays connected
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      const writeEvent = (data) => {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      };

      try {
        const message = req.body;
        const userId = message.userId || 'default';

        await this.initializeMemory(userId);

        if (!message.from || !message.content) {
          writeEvent({ error: 'Message must contain from and content fields', done: true });
          return res.end();
        }

        if (!message.performative || !Object.values(PERFORMATIVES).includes(message.performative)) {
          message.performative = PERFORMATIVES.INFORM;
        }

        const structuredMessage = createMessage(
          message.from,
          this.agentId,
          message.content,
          message.performative,
          message.metadata || {}
        );

        const prompt = await this.createPrompt(structuredMessage);

        const promptLength = prompt.length;
        let numPredict = 300;
        if (promptLength > 8000) numPredict = 200;
        else if (promptLength > 4000) numPredict = 250;

        // Stream tokens directly from Ollama — bypasses model manager queue
        // intentionally: streaming responses hold the connection open and cannot
        // be queued the same way as fire-and-forget requests.
        const fullContent = await generateResponseStream(this.model, prompt, {
          temperature: 0.7,
          num_predict: numPredict
        }, (token) => {
          writeEvent({ token });
        });

        // Streaming uses free-form text (not JSON mode) — store content directly
        const streamedContent = fullContent.trim();

        // Persist to memory
        if (this.memory) {
          try {
            await this.memory.storeConversation(
              message.content,
              streamedContent,
              {
                conversationId: message.conversationId || 'unknown',
                messageId: message.id,
                timestamp: new Date().toISOString(),
              }
            );
            await this.extractAndStorePreferences(message.content);
          } catch (err) {
            logger.warn(`Error storing streaming conversation memory: ${err.message}`);
          }
        }

        writeEvent({
          done: true,
          content: streamedContent,
          agentId: this.agentId
        });
        res.end();
      } catch (error) {
        logger.error(`${this.agentId} stream error:`, error.message);
        writeEvent({ error: error.message, done: true });
        res.end();
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
          // Use summarizer for long histories to avoid silently exceeding context window
          const { promptContext } = await buildPromptContext(
            recentContext.map(c => {
              try { return JSON.parse(c.content); } catch { return { from: 'user', content: c.content }; }
            }),
            null // no cached summary at this layer — memory system handles caching
          );
          if (promptContext) {
            prompt += `\n\nConversation context:\n${promptContext}`;
          }
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
   * Generate a response to an incoming message.
   * Uses Ollama's native JSON mode to get structured output — answer + confidence — in a
   * single LLM call, replacing the previous heuristic regex-based confidence detection.
   *
   * @param {Object} message - Incoming message
   * @returns {Promise<Object>} - Structured response message
   */
  async generateAgentResponse(message) {
    const basePrompt = await this.createPrompt(message);

    // Append JSON format instruction. The model must return {"answer": "...", "confidence": 0-100}.
    const jsonPrompt =
      `${basePrompt}\n\n` +
      `Respond ONLY with valid JSON in this exact format — no other text:\n` +
      `{"answer": "your complete response here", "confidence": 75}\n` +
      `Where confidence is 0–100 reflecting how certain you are about the answer.`;

    try {
      const promptLength = jsonPrompt.length;
      let numPredict = 600;
      if (promptLength > 8000) numPredict = 400;
      else if (promptLength > 4000) numPredict = 500;

      const { model: routedModel, reason } = routeModel(message.content);
      if (routedModel !== this.model) {
        logger.info(`${this.agentId}: model router → ${routedModel} (${reason})`);
      }

      const meta = await tracedGenerate(generateResponseWithMetaJson, {
        model:   routedModel,
        prompt:  jsonPrompt,
        options: { temperature: 0.7, num_predict: numPredict },
        agentId: this.agentId,
      });

      // Parse structured output — fall back to raw text if the model misbehaves despite JSON mode
      let content = '';
      let confidence = 75;
      try {
        const parsed = JSON.parse(meta.text);
        content    = String(parsed.answer || '').trim();
        confidence = Math.min(100, Math.max(0, Number(parsed.confidence) || 75));
      } catch (_) {
        logger.warn(`${this.agentId}: model returned non-JSON; using raw text`);
        content = meta.text.trim();
      }

      if (!content) {
        logger.warn(`${this.agentId}: empty content after parsing`);
        content = "I received your message, but I'm having trouble generating a response right now.";
      }

      if (this.memory) {
        try {
          await this.memory.storeConversation(message.content, content, {
            conversationId: message.conversationId || 'unknown',
            messageId: message.id,
            timestamp: new Date().toISOString(),
            confidence,
          });
          await this.extractAndStorePreferences(message.content);
        } catch (error) {
          logger.warn(`Error storing conversation memory: ${error.message}`);
        }
      }

      const responseMessage = createMessage(
        this.agentId,
        message.from,
        content,
        PERFORMATIVES.RESPOND
      );
      responseMessage.confidence = confidence;
      responseMessage.tokenUsage = {
        inputTokens:  meta.inputTokens,
        outputTokens: meta.outputTokens,
        totalTokens:  meta.inputTokens + meta.outputTokens,
      };
      responseMessage.routedModel = routedModel;

      return responseMessage;
    } catch (error) {
      logger.error(`Error generating response with ${this.model}:`, error.message);

      let errorMessage = "I apologize, but I'm having trouble generating a response at the moment.";
      if (error.message.includes('timeout')) {
        errorMessage = "I apologize, but your request is too complex for me to process right now. Please try a shorter or simpler request.";
      }

      return createMessage(
        this.agentId,
        message.from,
        errorMessage,
        PERFORMATIVES.RESPOND
      );
    }
  }

  /**
   * Extract and store explicit user preferences using a structured LLM call.
   * Replaces the previous heuristic regex approach with JSON-mode inference,
   * which is reliable across different phrasings and languages.
   *
   * @param {string} userMessage - The user's message to analyse
   */
  async extractAndStorePreferences(userMessage) {
    if (!this.memory) return;

    const prompt =
      `Extract any explicit user preferences from the message below.\n` +
      `Only extract preferences the user explicitly states (e.g. "I prefer Python", "please be brief", "I work as a doctor").\n` +
      `Do NOT infer preferences that are not clearly stated.\n\n` +
      `Message: "${userMessage.slice(0, 500)}"\n\n` +
      `Respond ONLY with valid JSON:\n` +
      `{"preferences": [{"key": "preference_name", "value": "preference_value"}]}\n` +
      `If no explicit preferences are mentioned, return: {"preferences": []}`;

    try {
      const result = await generateResponseJson(
        process.env.SUMMARIZER_MODEL || 'phi3:latest',
        prompt,
        { temperature: 0.1, num_predict: 200 }
      );
      for (const pref of (result.preferences || [])) {
        if (pref.key && pref.value) {
          await this.memory.storePreference(String(pref.key), String(pref.value), 0.8);
        }
      }
    } catch (err) {
      logger.warn(`Preference extraction failed: ${err.message}`);
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
    return new Promise((resolve) => {
      // Stop accepting new requests; wait for in-flight requests to complete
      if (this.server) {
        this.server.close(() => {
          logger.info(`${this.agentId} HTTP server closed`);
          resolve();
        });
      } else {
        resolve();
      }

      // Clear memory cleanup interval regardless of server state
      if (this.memoryCleanupInterval) {
        clearInterval(this.memoryCleanupInterval);
      }
    });
  }
}

module.exports = { BaseAgent, getModelManager }; 