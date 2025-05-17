/**
 * Manager Agent
 * 
 * Coordinates communication between agents, handles message routing,
 * performs content moderation, and provides conversation summaries.
 */
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const morgan = require('morgan');

// Import shared utilities
const { logger } = require('../shared/logger');
const { moderateMessage } = require('../shared/moderation');
const { generateResponse } = require('../shared/ollama');
const { PERFORMATIVES, createMessage, createApologyMessage } = require('../shared/messaging');
const { recordMessage } = require('../shared/conversation-recorder');

// Load environment variables
dotenv.config();

// Constants
const PORT = process.env.MANAGER_PORT || 3000;
const MANAGER_MODEL = process.env.MANAGER_MODEL || 'llama3:latest';

// Agent service endpoints
const AGENT_ENDPOINTS = {
  'agent-mistral': `http://localhost:${process.env.AGENT_MISTRAL_PORT || 3001}/message`,
  'agent-llama3': `http://localhost:${process.env.AGENT_LLAMA3_PORT || 3002}/message`,
  'agent-phi3': `http://localhost:${process.env.AGENT_PHI3_PORT || 3003}/message`,
  'agent-qwen': `http://localhost:${process.env.AGENT_QWEN_PORT || 3004}/message`
};

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

/**
 * Route message to an agent
 * 
 * @param {Object} message - Message to route
 * @returns {Promise<Object>} - Agent's response
 */
async function routeMessageToAgent(message) {
  const targetAgent = message.to;
  
  if (!targetAgent.startsWith('agent-')) {
    throw new Error(`Invalid agent destination: ${targetAgent}`);
  }
  
  const endpoint = AGENT_ENDPOINTS[targetAgent];
  if (!endpoint) {
    throw new Error(`Unknown agent: ${targetAgent}`);
  }

  try {
    const response = await axios.post(endpoint, message);
    return response.data;
  } catch (error) {
    logger.error(`Error routing message to ${targetAgent}:`, error.message);
    throw new Error(`Failed to communicate with ${targetAgent}: ${error.message}`);
  }
}

/**
 * Summarize an agent interaction
 * 
 * @param {Object} originalMessage - The original message
 * @param {Object} agentResponse - The agent's response
 * @returns {Promise<string>} - Summary of the interaction
 */
async function summarizeInteraction(originalMessage, agentResponse) {
  const summaryPrompt = `You are the Executive Overseer, a senior manager AI using Llama 3.3.
Your job is to oversee a team of specialized AI agents working on software development projects.
Your team consists of:
- CodeCrafter (Llama3): Software Developer who implements code
- CodeQualifier (Mistral): Software Tester who ensures quality
- DeployMaster (Phi3): Deployment Manager who handles infrastructure
- Project Navigator (Qwen): Task Manager who organizes work and reports to you

Summarize this conversation in one concise sentence from your perspective as the Executive Overseer:
  
${originalMessage.from}: ${originalMessage.content}
${agentResponse.from}: ${agentResponse.content}`;

  try {
    const summary = await generateResponse(MANAGER_MODEL, summaryPrompt, {
      temperature: 0.5,
      num_predict: 100  // Keep summary short
    });
    
    // Return a default summary if generation failed
    if (!summary) {
      return `${originalMessage.from} asked ${agentResponse.from} a question and received a response.`;
    }
    
    return summary;
  } catch (error) {
    logger.error('Error generating summary:', error.message);
    return `${originalMessage.from} asked ${agentResponse.from} a question and received a response.`;
  }
}

// Routes

/**
 * Handle new messages, route them to agents, moderate responses,
 * and return the result with a summary
 */
app.post('/message', async (req, res) => {
  try {
    const message = req.body;
    logger.info('Received message', { from: message.from, to: message.to });
    
    // Record incoming message
    recordMessage(message);
    
    // Validate incoming message
    if (!message.from || !message.to || !message.content || !message.performative) {
      return res.status(400).json({ 
        error: 'Invalid message format. Must include from, to, content, and performative.' 
      });
    }
    
    // Moderate the incoming message - disable LLM moderation
    const moderationResult = await moderateMessage(message, MANAGER_MODEL, false);
    
    if (moderationResult.flagged) {
      logger.warn('Incoming message flagged', { reason: moderationResult.reason });
      
      return res.status(400).json({
        error: 'Message flagged for inappropriate content',
        reason: moderationResult.reason,
        flagged: true
      });
    }
    
    // Route message to target agent
    const agentResponse = await routeMessageToAgent(message);
    
    // Record agent response
    recordMessage(agentResponse);
    
    // Moderate the agent's response - disable LLM moderation
    const responseModeration = await moderateMessage(agentResponse, MANAGER_MODEL, false);
    
    // If agent response is flagged, create an apology message
    if (responseModeration.flagged) {
      logger.warn('Agent response flagged', { 
        agent: agentResponse.from, 
        reason: responseModeration.reason 
      });
      
      const apologyMessage = createApologyMessage(
        agentResponse.from,
        agentResponse.to,
        agentResponse.content
      );
      
      // Record flagged response with moderation result
      recordMessage(agentResponse, responseModeration);
      // Record the apology message
      recordMessage(apologyMessage);
      
      // Generate summary
      const summary = await summarizeInteraction(message, apologyMessage);
      
      return res.json({
        originalMessage: message,
        agentResponse: apologyMessage,
        flagged: true,
        reason: responseModeration.reason,
        summary
      });
    }
    
    // Generate interaction summary
    const summary = await summarizeInteraction(message, agentResponse);
    
    // Return the original message, agent response, and summary
    res.json({
      originalMessage: message,
      agentResponse,
      summary
    });
    
  } catch (error) {
    logger.error('Error processing message:', error.message);
    res.status(500).json({
      error: 'Error processing message',
      message: error.message
    });
  }
});

/**
 * Endpoint to get agent status
 */
app.get('/status', async (req, res) => {
  try {
    const status = {
      manager: {
        status: 'online',
        model: MANAGER_MODEL
      },
      agents: {}
    };
    
    // Check each agent's status
    for (const [agent, endpoint] of Object.entries(AGENT_ENDPOINTS)) {
      try {
        const baseEndpoint = endpoint.replace('/message', '/status');
        const response = await axios.get(baseEndpoint);
        status.agents[agent] = response.data;
      } catch (error) {
        status.agents[agent] = { status: 'offline', error: error.message };
      }
    }
    
    res.json(status);
  } catch (error) {
    logger.error('Error checking status:', error.message);
    res.status(500).json({ error: 'Failed to get system status' });
  }
});

// Start the server
app.listen(PORT, () => {
  logger.info(`Manager Agent running on port ${PORT}`);
}); 