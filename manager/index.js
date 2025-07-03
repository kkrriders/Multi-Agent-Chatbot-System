/**
 * Manager Agent
 * 
 * Coordinates communication between agents, handles message routing,
 * and manages sequential conversations with dynamic agent naming.
 */
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const pdf = require('html-pdf');

// Import shared utilities
const { logger } = require('../shared/logger');
const { generateResponse } = require('../shared/ollama');
const { PERFORMATIVES, createMessage } = require('../shared/messaging');

// Load environment variables
dotenv.config();

// Constants
const PORT = process.env.MANAGER_PORT || 3000;
const MANAGER_MODEL = process.env.MANAGER_MODEL || 'llama3:latest';
const EXPORTS_DIR = path.join(__dirname, '../exports');

// Ensure exports directory exists
if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

// Agent service endpoints - Updated to only 4 agents
const AGENT_ENDPOINTS = {
  'agent-1': `http://localhost:${process.env.AGENT_1_PORT || 3001}/message`,
  'agent-2': `http://localhost:${process.env.AGENT_2_PORT || 3002}/message`,
  'agent-3': `http://localhost:${process.env.AGENT_3_PORT || 3003}/message`,
  'agent-4': `http://localhost:${process.env.AGENT_4_PORT || 3004}/message`
};

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Store for active conversations
const conversations = new Map();

// Root route handler
app.get('/', (req, res) => {
  res.json({
    message: 'Multi-Agent Chatbot System API',
    version: '2.0.0',
    endpoints: {
      '/message': 'POST - Send message to single agent',
      '/team-conversation': 'POST - Start team conversation',
      '/conversation/:id': 'GET - Get conversation history',
      '/conversation/:id': 'DELETE - Clear conversation',
      '/export-chat/:id': 'GET - Export conversation as PDF',
      '/status': 'GET - System status'
    }
  });
});

// Add health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '2.0.0',
    message: 'Multi-Agent Chatbot System is running',
    agents: Object.keys(AGENT_ENDPOINTS)
  });
});

/**
 * Route message to an agent with conversation history
 * 
 * @param {Object} message - Message to route
 * @returns {Promise<Object>} - Agent's response
 */
async function routeMessageToAgent(message) {
  const targetAgent = message.to;
  
  if (!targetAgent || !targetAgent.startsWith('agent-')) {
    throw new Error(`Invalid agent destination: ${targetAgent}`);
  }
  
  const endpoint = AGENT_ENDPOINTS[targetAgent];
  if (!endpoint) {
    throw new Error(`Unknown agent: ${targetAgent}`);
  }

  try {
    logger.info(`Sending message to ${targetAgent}`);
    const response = await axios.post(endpoint, message, {
      timeout: 60000 // 60 second timeout for agent responses
    });
    return response.data;
  } catch (error) {
    logger.error(`Error routing message to ${targetAgent}:`, error.message);
    throw new Error(`Failed to communicate with ${targetAgent}: ${error.message}`);
  }
}

/**
 * Handle single agent conversation
 */
app.post('/message', async (req, res) => {
  try {
    const { content, agentId, agentName } = req.body;
    
    if (!content || !agentId) {
      return res.status(400).json({ error: 'Content and agentId are required' });
    }

    // Create message with agent name
    const message = createMessage(
      'user',
      agentId,
      content,
      PERFORMATIVES.REQUEST
    );
    
    // Add agent name if provided
    if (agentName) {
      message.agentName = agentName;
    }

    // Route to agent
    const response = await routeMessageToAgent(message);
    
    res.json({
      success: true,
      response: response
    });
  } catch (error) {
    logger.error('Error in single message route:', error.message);
    res.status(500).json({ 
      error: `Error processing message: ${error.message}` 
    });
  }
});

/**
 * Handle team conversation with multiple agents
 */
app.post('/team-conversation', async (req, res) => {
  try {
    const { 
      content, 
      participants, // Array of {agentId, agentName}
      conversationId 
    } = req.body;
    
    if (!content || !participants || !Array.isArray(participants)) {
      return res.status(400).json({ 
        error: 'Content and participants array are required' 
      });
    }

    const convId = conversationId || `conv-${Date.now()}`;
    
    // Get or create conversation
    if (!conversations.has(convId)) {
      conversations.set(convId, {
        id: convId,
        history: [],
        participants: participants,
        createdAt: new Date().toISOString()
      });
    }
    
    const conversation = conversations.get(convId);
    
    // Add user message to history
    const userMessage = {
      from: 'user',
      content: content,
      timestamp: Date.now()
    };
    conversation.history.push(userMessage);
    
    // Get responses from each participant in sequence
    const responses = [];
    
    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i];
      
      try {
        // Create message with conversation history
        const message = createMessage(
          'user',
          participant.agentId,
          content,
          PERFORMATIVES.REQUEST
        );
        
        // Add agent name and conversation history
        message.agentName = participant.agentName || `Agent ${participant.agentId.slice(-1)}`;
        message.conversationHistory = [...conversation.history];
        
        // Get response from agent
        const response = await routeMessageToAgent(message);
        
        // Add response to conversation history
        const responseMessage = {
          from: message.agentName,
          content: response.content,
          timestamp: Date.now()
        };
        conversation.history.push(responseMessage);
        responses.push(responseMessage);
        
      } catch (error) {
        logger.error(`Error getting response from ${participant.agentId}:`, error.message);
        const errorMessage = {
          from: participant.agentName || `Agent ${participant.agentId.slice(-1)}`,
          content: `Sorry, I'm having trouble responding right now: ${error.message}`,
          timestamp: Date.now(),
          error: true
        };
        conversation.history.push(errorMessage);
        responses.push(errorMessage);
      }
    }

    res.json({
      success: true,
      conversationId: convId,
      responses: responses,
      conversationHistory: conversation.history
    });

  } catch (error) {
    logger.error('Error in team conversation route:', error.message);
    res.status(500).json({ 
      error: `Error processing team conversation: ${error.message}` 
    });
  }
});

/**
 * Get conversation history
 */
app.get('/conversation/:conversationId', (req, res) => {
  const conversationId = req.params.conversationId;
  const conversation = conversations.get(conversationId);
  
  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  
  res.json({
    success: true,
    conversation: conversation
  });
});

/**
 * Clear conversation history
 */
app.delete('/conversation/:conversationId', (req, res) => {
  const conversationId = req.params.conversationId;
  
  if (conversations.has(conversationId)) {
    conversations.delete(conversationId);
    res.json({ success: true, message: 'Conversation cleared' });
  } else {
    res.status(404).json({ error: 'Conversation not found' });
  }
});

/**
 * Export conversation as PDF
 */
app.get('/export-chat/:conversationId', async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    const conversation = conversations.get(conversationId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Generate HTML content for PDF
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Chat Conversation - ${conversationId}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .message { margin: 15px 0; padding: 10px; border-radius: 5px; }
          .user-message { background-color: #e7f5fe; border-left: 4px solid #2196F3; }
          .agent-message { background-color: #f0f8ea; border-left: 4px solid #4CAF50; }
          .message-header { font-weight: bold; margin-bottom: 5px; }
          .timestamp { font-size: 0.8em; color: #666; margin-left: 10px; }
          .participants { margin: 20px 0; padding: 10px; background-color: #f5f5f5; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Multi-Agent Chat Conversation</h1>
          <p>Conversation ID: ${conversationId}</p>
          <p>Created: ${conversation.createdAt}</p>
          <p>Export Date: ${new Date().toISOString()}</p>
        </div>
        
        <div class="participants">
          <h3>Participants:</h3>
          <ul>
            <li>User</li>
    `;

    conversation.participants.forEach(participant => {
      htmlContent += `<li>${participant.agentName || participant.agentId}</li>`;
    });

    htmlContent += `
          </ul>
        </div>
        
        <div class="conversation">
          <h3>Conversation History:</h3>
    `;

    conversation.history.forEach(message => {
      const messageClass = message.from === 'user' ? 'user-message' : 'agent-message';
      const timestamp = new Date(message.timestamp).toLocaleString();
      
      htmlContent += `
        <div class="message ${messageClass}">
          <div class="message-header">
            ${message.from}
            <span class="timestamp">${timestamp}</span>
          </div>
          <div class="content">${message.content.replace(/\n/g, '<br>')}</div>
        </div>
      `;
    });

    htmlContent += `
        </div>
      </body>
      </html>
    `;

    // Generate PDF
    const pdfPath = path.join(EXPORTS_DIR, `chat-${conversationId}-${Date.now()}.pdf`);
    
    await new Promise((resolve, reject) => {
      pdf.create(htmlContent, { 
        format: 'A4',
        border: {
          top: '0.5in',
          right: '0.5in',
          bottom: '0.5in',
          left: '0.5in'
        }
      }).toFile(pdfPath, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    // Send the PDF file
    res.download(pdfPath, `chat-${conversationId}.pdf`, (err) => {
      if (err) {
        logger.error('Error sending PDF:', err);
      }
      // Optionally delete the file after sending
      // fs.unlinkSync(pdfPath);
    });

  } catch (error) {
    logger.error('Error exporting chat to PDF:', error.message);
    res.status(500).json({ 
      error: `Error exporting chat: ${error.message}` 
    });
  }
});

/**
 * Get system status
 */
app.get('/status', async (req, res) => {
  const agentStatuses = {};
  
  // Check each agent's status
  for (const [agentId, endpoint] of Object.entries(AGENT_ENDPOINTS)) {
    try {
      const statusUrl = endpoint.replace('/message', '/status');
      const response = await axios.get(statusUrl, { timeout: 5000 });
      agentStatuses[agentId] = {
        status: 'online',
        ...response.data
      };
    } catch (error) {
      agentStatuses[agentId] = {
        status: 'offline',
        error: error.message
      };
    }
  }
  
  res.json({
    manager: {
      status: 'online',
      model: MANAGER_MODEL,
      port: PORT
    },
    agents: agentStatuses,
    activeConversations: conversations.size,
    exportsDirectory: EXPORTS_DIR
  });
});

// Start the manager service
app.listen(PORT, () => {
  logger.info(`Manager agent running on port ${PORT}`);
});

// Handle shutdown gracefully
process.on('SIGINT', () => {
  logger.info('Shutting down manager agent...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down manager agent...');
  process.exit(0);
});

module.exports = app; 
module.exports = app; 