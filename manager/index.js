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
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { v4: uuidv4 } = require('uuid');
const pdf = require('html-pdf');

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
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
const PUBLIC_DIR = path.join(__dirname, '../public');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Ensure public directory exists
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Generate a unique UUID for the file without including the original filename
    const uniqueId = uuidv4();
    const fileExt = path.extname(file.originalname);
    cb(null, `${uniqueId}${fileExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Agent service endpoints
const AGENT_ENDPOINTS = {
  'agent-mistral': `http://localhost:${process.env.AGENT_MISTRAL_PORT || 3001}/message`,
  'agent-llama3': `http://localhost:${process.env.AGENT_LLAMA3_PORT || 3002}/message`,
  'agent-phi3': `http://localhost:${process.env.AGENT_PHI3_PORT || 3003}/message`,
  'agent-qwen': `http://localhost:${process.env.AGENT_QWEN_PORT || 3004}/message`,
  'agent-llama33': `http://localhost:${process.env.AGENT_LLAMA33_PORT || 3005}/message`
};

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Serve static files from the public directory
app.use(express.static(PUBLIC_DIR));

// Create a storage for tracking uploaded PDFs
const pdfStore = new Map();

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

  // Ensure performative is a valid value
  if (!message.performative || typeof message.performative !== 'string') {
    logger.warn(`Invalid performative in message to ${targetAgent}, setting default 'request'`);
    message.performative = 'request';
  }

  try {
    logger.info(`Sending message to ${targetAgent} with performative: ${message.performative}`);
    const response = await axios.post(endpoint, message);
    return response.data;
  } catch (error) {
    // Log detailed error information
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      logger.error(`Error routing message to ${targetAgent}:`, {
        status: error.response.status,
        data: error.response.data,
        message: error.message
      });
    } else if (error.request) {
      // The request was made but no response was received
      logger.error(`No response from ${targetAgent}:`, {
        request: error.request,
        message: error.message
      });
    } else {
      // Something happened in setting up the request that triggered an Error
      logger.error(`Error setting up request to ${targetAgent}:`, error.message);
    }
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
- Executive Overseer (Llama3.3): Senior Manager (you) who oversees the entire team

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

/**
 * Extract text content from a PDF file
 * 
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<string>} - Extracted text content
 */
async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    logger.error('Error extracting text from PDF:', error.message);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

/**
 * Generate a PDF summary
 * 
 * @param {string} pdfText - The text content of the PDF
 * @returns {Promise<string>} - Summary of the PDF
 */
async function summarizePDF(pdfText) {
  // Limit text length to avoid model context limits
  const truncatedText = pdfText.slice(0, 10000);
  
  const summaryPrompt = `You are an AI assistant. Please provide a concise summary of the following document text:

${truncatedText}

Focus on the main points, key information, and central ideas. Keep your summary clear and informative.`;

  try {
    const summary = await generateResponse(MANAGER_MODEL, summaryPrompt, {
      temperature: 0.3,
      num_predict: 500
    });
    
    return summary || 'Unable to generate PDF summary.';
  } catch (error) {
    logger.error('Error generating PDF summary:', error.message);
    return 'Unable to generate PDF summary due to an error.';
  }
}

/**
 * Generate brainstorming ideas based on PDF content
 * 
 * @param {string} pdfId - The ID of the PDF
 * @param {string} pdfText - The text content of the PDF
 * @param {string} pdfSummary - The summary of the PDF
 * @param {Object} roles - Optional custom roles for the agents
 * @returns {Promise<Object>} - Brainstorming discussion results
 */
async function brainstormIdeas(pdfId, pdfText, pdfSummary, roles = {}) {
  // Setup discussion participants - use default agent IDs
  const discussionAgentIds = ['agent-mistral', 'agent-llama3', 'agent-phi3', 'agent-qwen'];
  const managerAgentId = 'agent-llama33';
  
  // Track the conversation thread
  const discussion = {
    rounds: [],
    summary: '',
    finalConclusions: '',
    roles: {}
  };
  
  // Default roles if not provided
  const defaultRoles = {
    'agent-mistral': {
      name: 'Quality Expert',
      specialty: 'focus on ideas that could improve quality, testing, or validation aspects'
    },
    'agent-llama3': {
      name: 'Software Developer',
      specialty: 'focus on implementation ideas, coding solutions, or technical approaches'
    },
    'agent-phi3': {
      name: 'Deployment Manager',
      specialty: 'focus on infrastructure, deployment, or operational improvement ideas'
    },
    'agent-qwen': {
      name: 'Task Manager',
      specialty: 'focus on project management, workflow, or organizational improvement ideas'
    },
    'agent-llama33': {
      name: 'Executive Overseer',
      specialty: 'provide high-level strategic guidance and synthesis'
    }
  };
  
  // Merge provided roles with defaults
  const agentRoles = {};
  discussionAgentIds.forEach(agentId => {
    agentRoles[agentId] = {
      ...defaultRoles[agentId],
      ...(roles[agentId] || {})
    };
    
    // Store the roles in the discussion object for reference
    discussion.roles[agentId] = agentRoles[agentId];
  });
  
  // Also set the manager role
  agentRoles[managerAgentId] = {
    ...defaultRoles[managerAgentId],
    ...(roles[managerAgentId] || {})
  };
  discussion.roles[managerAgentId] = agentRoles[managerAgentId];
  
  // Prepare initial context from PDF - Reduce text length to avoid timeouts
  const truncatedText = pdfText.slice(0, 3000); // Reduced from 5000 to 3000 chars
  
  // Phase 1: Initial Ideas
  logger.info('Starting brainstorming discussion - Phase 1: Initial Ideas');
  
  // Simplified initial prompt with more focused guidance
  const initialPrompt = `Based on the following PDF summary, please generate 2 innovative ideas:

PDF SUMMARY:
${pdfSummary}

IMPORTANT CONSIDERATIONS:
- Focus on identifying market gaps and underserved niches, particularly in the Canadian market
- Consider existing competition and market saturation before proposing ideas
- Avoid suggesting ideas for oversaturated markets with high competition
- Identify clear competitive advantages for each idea

Present your ideas in a clear, concise format with:
1. Idea name/title
2. Brief description (2-3 sentences)
3. Key advantage/unique selling point`;

  // Get initial ideas from each agent
  const initialIdeas = {};
  
  for (const agentId of discussionAgentIds) {
    try {
      const role = agentRoles[agentId];
      // Simplified prompt to reduce complexity
      const agentPrompt = `${initialPrompt}\n\nAs a ${role.name}, ${role.specialty}.`;
      
      // Create and send message with the correct parameter order
      const message = createMessage(
        'manager',        // from
        agentId,          // to
        agentPrompt,      // content
        'request'         // performative
      );
      
      const response = await routeMessageToAgent(message);
      
      // Record the interaction
      recordMessage(message);
      recordMessage(response);
      
      initialIdeas[agentId] = response.content;
    } catch (error) {
      logger.error(`Error getting initial ideas from ${agentId}:`, error.message);
      initialIdeas[agentId] = `Failed to generate ideas: ${error.message}`;
    }
  }
  
  // Add first round to discussion
  discussion.rounds.push({
    phase: 'Initial Ideas',
    ideas: initialIdeas
  });
  
  // Phase 2: Manager Review of Initial Ideas
  logger.info('Brainstorming discussion - Phase 2: Manager Review');
  
  // Format ideas with role names rather than agent IDs
  const initialIdeasSummary = Object.entries(initialIdeas)
    .map(([agentId, ideas]) => {
      const role = agentRoles[agentId];
      return `${role.name.toUpperCase()}'s IDEAS:\n${ideas}\n`;
    })
    .join('\n');
  
  const managerRole = agentRoles[managerAgentId];
  // Simplified manager review prompt
  const managerReviewPrompt = `As the ${managerRole.name}, review these brainstorming ideas:

${initialIdeasSummary}

PDF SUMMARY:
${pdfSummary}

CRITICAL ANALYSIS INSTRUCTIONS:
- Evaluate each idea for its viability in the Canadian market
- Consider market saturation and competition for each idea
- Prioritize ideas with genuine competitive advantages

Please provide:
1. Brief evaluation of the strongest ideas
2. Suggestion for the team's next discussion focus`;

  let managerReview;
  try {
    // Create message with the correct parameter order
    const message = createMessage(
      'manager',         // from
      managerAgentId,    // to
      managerReviewPrompt, // content
      'request'          // performative
    );
    
    const response = await routeMessageToAgent(message);
    
    // Record the interaction
    recordMessage(message);
    recordMessage(response);
    
    managerReview = response.content;
  } catch (error) {
    logger.error(`Error getting manager review:`, error.message);
    managerReview = `Failed to generate manager review: ${error.message}`;
  }
  
  // Add manager review to discussion
  discussion.rounds.push({
    phase: 'Manager Review',
    review: managerReview
  });
  
  // Phase 3: Discussion Round - Agents evaluate each other's ideas
  logger.info('Brainstorming discussion - Phase 3: Cross-evaluation');
  
  const crossEvaluation = {};
  
  for (const agentId of discussionAgentIds) {
    const currentRole = agentRoles[agentId];
    
    // Prepare a prompt showing other agents' ideas with their role names
    // Get only 2 other agents' ideas to reduce complexity
    const otherAgentIds = discussionAgentIds.filter(id => id !== agentId);
    const selectedAgentIds = otherAgentIds.slice(0, 2); // Only use 2 other agents
    
    const otherAgentsIdeas = selectedAgentIds
      .map(otherAgentId => {
        const otherRole = agentRoles[otherAgentId];
        return `${otherRole.name.toUpperCase()}'s IDEAS:\n${initialIdeas[otherAgentId]}`;
      })
      .join('\n\n');
    
    // Simplified cross-evaluation prompt
    const discussionPrompt = `As the ${currentRole.name}, evaluate these ideas:

${otherAgentsIdeas}

MANAGER FEEDBACK:
${managerReview.slice(0, 500)}... (summary)

Please:
1. Identify the strongest idea and why you like it
2. Suggest one improvement to this idea`;

    try {
      // Create message with the correct parameter order
      const message = createMessage(
        'manager',       // from
        agentId,         // to
        discussionPrompt, // content
        'request'        // performative
      );
      
      const response = await routeMessageToAgent(message);
      
      // Record the interaction
      recordMessage(message);
      recordMessage(response);
      
      crossEvaluation[agentId] = response.content;
    } catch (error) {
      logger.error(`Error getting cross-evaluation from ${agentId}:`, error.message);
      crossEvaluation[agentId] = `Failed to generate evaluation: ${error.message}`;
    }
  }
  
  // Add cross-evaluation to discussion
  discussion.rounds.push({
    phase: 'Cross Evaluation',
    evaluations: crossEvaluation
  });
  
  // Phase 4: Final Manager Synthesis
  logger.info('Brainstorming discussion - Phase 4: Manager Synthesis');
  
  // Format evaluations with role names - but limit to critical parts
  const crossEvaluationSummary = Object.entries(crossEvaluation)
    .map(([agentId, evaluation]) => {
      const role = agentRoles[agentId];
      // Limit each evaluation to 300 chars to reduce prompt size
      const truncatedEvaluation = evaluation.length > 300 ? 
        evaluation.slice(0, 300) + '... (continued)' : evaluation;
      return `${role.name.toUpperCase()}'s EVALUATION:\n${truncatedEvaluation}\n`;
    })
    .join('\n');
  
  // Simplified synthesis prompt
  const synthesisPrompt = `As the ${managerRole.name}, synthesize this brainstorming session:

PDF SUMMARY:
${pdfSummary}

TEAM EVALUATION SUMMARY:
${crossEvaluationSummary}

FINAL RECOMMENDATION REQUIREMENTS:
- Focus on ideas that can succeed despite competition
- Prioritize ideas with clear competitive advantages
- Be honest about market challenges in Canada

Please provide:
1. Final recommendation for the best idea to pursue and why
2. Next steps for implementation`;

  let managerSynthesis;
  try {
    // Create message with the correct parameter order
    const message = createMessage(
      'manager',       // from
      managerAgentId,  // to
      synthesisPrompt, // content
      'request'        // performative
    );
    
    const response = await routeMessageToAgent(message);
    
    // Record the interaction
    recordMessage(message);
    recordMessage(response);
    
    managerSynthesis = response.content;
  } catch (error) {
    logger.error(`Error getting manager synthesis:`, error.message);
    managerSynthesis = `Failed to generate manager synthesis: ${error.message}`;
  }
  
  // Add manager synthesis to discussion
  discussion.rounds.push({
    phase: 'Manager Synthesis',
    synthesis: managerSynthesis
  });
  
  // Phase 5: Implementation Planning - Each agent contributes specific steps for success
  logger.info('Brainstorming discussion - Phase 5: Implementation Planning');
  
  const implementationPlans = {};
  
  // Extract the recommended ideas from the manager's synthesis
  // Create a simpler implementation prompt with focused questions
  const baseImplementationPrompt = `Based on our brainstorming, please provide implementation guidance:

SELECTED IDEA:
${managerSynthesis.slice(0, 300)}... (summary of recommendation)

As the [ROLE_NAME], please outline:

1. Three key resources needed
2. Two major challenges to anticipate
3. One competitive advantage to develop

Keep your response concise and actionable.`;

  for (const agentId of discussionAgentIds) {
    const currentRole = agentRoles[agentId];
    
    // Replace the placeholder with the specific role name
    const agentImplementationPrompt = baseImplementationPrompt.replace('[ROLE_NAME]', currentRole.name);
    
    try {
      // Create message with the correct parameter order
      const message = createMessage(
        'manager',       // from
        agentId,         // to
        agentImplementationPrompt, // content
        'request'        // performative
      );
      
      const response = await routeMessageToAgent(message);
      
      // Record the interaction
      recordMessage(message);
      recordMessage(response);
      
      implementationPlans[agentId] = response.content;
    } catch (error) {
      logger.error(`Error getting implementation plan from ${agentId}:`, error.message);
      implementationPlans[agentId] = `Failed to generate implementation plan: ${error.message}`;
    }
  }
  
  // Add implementation plans to discussion
  discussion.rounds.push({
    phase: 'Implementation Planning',
    plans: implementationPlans
  });
  
  // Phase 6: Final Implementation Roadmap by Manager
  logger.info('Brainstorming discussion - Phase 6: Final Implementation Roadmap');
  
  // Format implementation plans with role names - but limit to critical parts
  const implementationPlansSummary = Object.entries(implementationPlans)
    .map(([agentId, plan]) => {
      const role = agentRoles[agentId];
      // Limit each plan to 200 chars to reduce prompt size
      const truncatedPlan = plan.length > 200 ? 
        plan.slice(0, 200) + '... (continued)' : plan;
      return `${role.name.toUpperCase()}'s INPUT:\n${truncatedPlan}\n`;
    })
    .join('\n');
  
  // Simplified roadmap prompt
  const roadmapPrompt = `As the ${managerRole.name}, create an implementation roadmap:

RECOMMENDED IDEA:
${managerSynthesis.slice(0, 300)}... (summary)

TEAM INPUT:
${implementationPlansSummary}

Create a 3-phase roadmap with:
1. PHASE 1 (First month): Key activities and goals
2. PHASE 2 (Months 2-3): Next steps and milestones
3. PHASE 3 (Months 4-6): Long-term actions

Focus on practical steps that address competitive challenges.`;

  let implementationRoadmap;
  try {
    // Create message with the correct parameter order
    const message = createMessage(
      'manager',       // from
      managerAgentId,  // to
      roadmapPrompt,   // content
      'request'        // performative
    );
    
    const response = await routeMessageToAgent(message);
    
    // Record the interaction
    recordMessage(message);
    recordMessage(response);
    
    implementationRoadmap = response.content;
  } catch (error) {
    logger.error(`Error getting implementation roadmap:`, error.message);
    implementationRoadmap = `Failed to generate implementation roadmap: ${error.message}`;
  }
  
  // Add implementation roadmap to discussion
  discussion.rounds.push({
    phase: 'Implementation Roadmap',
    roadmap: implementationRoadmap
  });
  
  // Update final conclusions to include implementation roadmap
  discussion.finalConclusions = `${managerSynthesis}\n\n---\n\nIMPLEMENTATION ROADMAP:\n\n${implementationRoadmap}`;
  
  // Create a brief summary of the entire discussion
  const summaryPrompt = `Summarize this brainstorming session in 2-3 sentences, including both the ideas selected and implementation approach:

${managerSynthesis.slice(0, 200)}... (recommendation summary)
${implementationRoadmap.slice(0, 200)}... (roadmap summary)`;

  try {
    const summary = await generateResponse(MANAGER_MODEL, summaryPrompt, {
      temperature: 0.3,
      num_predict: 100
    });
    
    discussion.summary = summary || 'Discussion complete. Manager provided final synthesis of ideas and implementation roadmap.';
  } catch (error) {
    logger.error('Error generating discussion summary:', error.message);
    discussion.summary = 'Discussion complete. Manager provided final synthesis of ideas and implementation roadmap.';
  }
  
  return discussion;
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
 * Upload a PDF file and extract its content
 */
app.post('/upload/pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }
    
    // Extract just the UUID part from the filename (removing file extension)
    const fileId = path.basename(req.file.filename, path.extname(req.file.filename));
    const filePath = req.file.path;
    
    logger.info(`PDF uploaded: ${req.file.originalname}, ID: ${fileId}`);
    
    // Extract text from PDF
    const pdfText = await extractTextFromPDF(filePath);
    
    // Generate a summary of the PDF
    const pdfSummary = await summarizePDF(pdfText);
    
    // Store PDF information
    pdfStore.set(fileId, {
      id: fileId,
      originalName: req.file.originalname,
      path: filePath,
      timestamp: new Date(),
      textLength: pdfText.length,
      summary: pdfSummary
    });
    
    res.json({
      id: fileId,
      originalName: req.file.originalname,
      summary: pdfSummary,
      message: 'PDF uploaded and processed successfully'
    });
    
  } catch (error) {
    logger.error('Error processing PDF upload:', error.message);
    res.status(500).json({
      error: 'Error processing PDF upload',
      message: error.message
    });
  }
});

/**
 * Brainstorm ideas based on PDF content
 */
app.post('/brainstorm/:pdfId', async (req, res) => {
  try {
    const { pdfId } = req.params;
    const { roles = {} } = req.body; // Get custom roles from request body
    
    logger.info(`Brainstorming request for PDF ID: ${pdfId}`);
    
    // Check if PDF exists
    if (!pdfStore.has(pdfId)) {
      logger.warn(`PDF not found: ${pdfId}`);
      return res.status(404).json({ 
        error: 'PDF not found',
        message: `No PDF found with ID: ${pdfId}. Available IDs: ${Array.from(pdfStore.keys()).join(', ')}`
      });
    }
    
    const pdfInfo = pdfStore.get(pdfId);
    
    // Extract text again (or we could store it in memory, but this avoids memory issues with large PDFs)
    logger.info(`Extracting text from PDF: ${pdfInfo.originalName}`);
    const pdfText = await extractTextFromPDF(pdfInfo.path);
    
    // Generate brainstorming discussion from all agents with custom roles
    logger.info(`Starting brainstorming with ${Object.keys(roles).length} custom roles`);
    const discussion = await brainstormIdeas(pdfId, pdfText, pdfInfo.summary, roles);
    
    res.json({
      pdfId,
      pdfName: pdfInfo.originalName,
      summary: pdfInfo.summary,
      discussion
    });
    
  } catch (error) {
    logger.error('Error brainstorming ideas:', error.message);
    res.status(500).json({
      error: 'Error brainstorming ideas',
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
    });
  }
});

/**
 * Get a list of uploaded PDFs
 */
app.get('/pdfs', (req, res) => {
  const pdfs = Array.from(pdfStore.values()).map(pdf => ({
    id: pdf.id,
    originalName: pdf.originalName,
    timestamp: pdf.timestamp,
    summary: pdf.summary
  }));
  
  res.json({ pdfs });
});

/**
 * Get PDF information by ID
 */
app.get('/pdfs/:pdfId', (req, res) => {
  const { pdfId } = req.params;
  
  if (!pdfStore.has(pdfId)) {
    return res.status(404).json({ error: 'PDF not found' });
  }
  
  const pdfInfo = pdfStore.get(pdfId);
  
  res.json({
    id: pdfInfo.id,
    originalName: pdfInfo.originalName,
    timestamp: pdfInfo.timestamp,
    summary: pdfInfo.summary
  });
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

/**
 * Generate a PDF from brainstorming results
 */
app.get('/export-pdf/:pdfId', async (req, res) => {
  try {
    const { pdfId } = req.params;
    
    logger.info(`PDF export request for brainstorming results of PDF ID: ${pdfId}`);
    
    // Check if PDF exists
    if (!pdfStore.has(pdfId)) {
      logger.warn(`PDF not found: ${pdfId}`);
      return res.status(404).json({ 
        error: 'PDF not found',
        message: `No PDF found with ID: ${pdfId}`
      });
    }
    
    const pdfInfo = pdfStore.get(pdfId);
    
    // Check if brainstorming results exist for this PDF
    // For simplicity, we'll regenerate the content each time
    // In a production app, you might want to store and retrieve previous results
    
    // Generate HTML content for the PDF
    let htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #2c3e50; }
            h2 { color: #3498db; margin-top: 20px; }
            h3 { color: #2980b9; }
            .section { margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
            .round { margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
            .agent { margin-bottom: 10px; }
            .agent-name { font-weight: bold; }
            .content { margin-left: 20px; }
            .implementation { background-color: #f9f9f9; padding: 15px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h1>Brainstorming Results</h1>
          <div class="section">
            <h2>PDF Information</h2>
            <p><strong>Name:</strong> ${pdfInfo.originalName}</p>
            <p><strong>Summary:</strong> ${pdfInfo.summary}</p>
          </div>
    `;
    
    // Check if we have brainstorming results for this PDF
    // This is a simplification - in a real app, you would store these results
    // For now, we'll tell the user to download right after brainstorming
    htmlContent += `
      <div class="section">
        <h2>Please Note</h2>
        <p>For the best experience, please download the PDF immediately after completing a brainstorming session.</p>
        <p>The PDF will contain the complete discussion, final conclusions, and implementation roadmap.</p>
      </div>
      <div class="section">
        <h2>Final Conclusions</h2>
        <p>The brainstorming session generated several ideas related to the content of "${pdfInfo.originalName}".</p>
        <p>The team evaluated each idea for market fit, competitive advantage, and implementation feasibility.</p>
        <p>To see the full conclusions and implementation roadmap, please run a brainstorming session and download the results immediately after completion.</p>
      </div>
    `;
    
    htmlContent += `
        </body>
      </html>
    `;
    
    // Create PDF from HTML
    const pdfOptions = { 
      format: 'Letter',
      border: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    };
    
    // Generate the PDF
    pdf.create(htmlContent, pdfOptions).toBuffer((err, buffer) => {
      if (err) {
        logger.error('Error generating PDF:', err);
        return res.status(500).json({ error: 'Error generating PDF', message: err.message });
      }
      
      // Send the PDF as a download
      const filename = `brainstorming-results-${pdfId}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    });
    
  } catch (error) {
    logger.error('Error exporting PDF:', error.message);
    res.status(500).json({
      error: 'Error exporting PDF',
      message: error.message
    });
  }
});

/**
 * Generate a PDF from active brainstorming discussion
 */
app.post('/export-discussion-pdf', async (req, res) => {
  try {
    const { discussion, pdfId } = req.body;
    
    if (!discussion || !pdfId) {
      return res.status(400).json({ error: 'Missing discussion data or PDF ID' });
    }
    
    logger.info(`PDF export request for active discussion of PDF ID: ${pdfId}`);
    
    // Check if PDF exists
    if (!pdfStore.has(pdfId)) {
      logger.warn(`PDF not found: ${pdfId}`);
      return res.status(404).json({ 
        error: 'PDF not found',
        message: `No PDF found with ID: ${pdfId}`
      });
    }
    
    const pdfInfo = pdfStore.get(pdfId);
    
    // Generate HTML content for the PDF
    let htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #2c3e50; }
            h2 { color: #3498db; margin-top: 20px; }
            h3 { color: #2980b9; }
            h4 { color: #2c3e50; }
            .section { margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
            .round { margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
            .agent { margin-bottom: 15px; background-color: #f9f9f9; padding: 10px; border-radius: 5px; }
            .agent-name { font-weight: bold; color: #2c3e50; }
            .content { margin-top: 5px; }
            .implementation { background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin-top: 20px; }
            .roadmap { background-color: #eaf7ff; padding: 15px; border-radius: 5px; margin-top: 20px; }
            .summary { font-style: italic; color: #666; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1>Brainstorming Results</h1>
          <div class="section">
            <h2>PDF Information</h2>
            <p><strong>Name:</strong> ${pdfInfo.originalName}</p>
            <p><strong>Summary:</strong> ${pdfInfo.summary}</p>
          </div>
    `;
    
    // Add discussion rounds to HTML
    if (discussion.rounds && discussion.rounds.length > 0) {
      htmlContent += '<div class="section"><h2>Discussion Rounds</h2>';
      
      discussion.rounds.forEach((round, index) => {
        htmlContent += `<div class="round"><h3>Round ${index + 1}: ${round.phase}</h3>`;
        
        if (round.ideas) {
          // Initial ideas round
          Object.entries(round.ideas).forEach(([agentId, content]) => {
            const roleName = discussion.roles[agentId]?.name || agentId;
            htmlContent += `
              <div class="agent">
                <div class="agent-name">${roleName}:</div>
                <div class="content">${content}</div>
              </div>
            `;
          });
        } else if (round.review) {
          // Manager review round
          htmlContent += `
            <div class="agent">
              <div class="agent-name">${discussion.roles['agent-llama33']?.name || 'Strategy Guide'}:</div>
              <div class="content">${round.review}</div>
            </div>
          `;
        } else if (round.evaluations) {
          // Cross evaluation round
          Object.entries(round.evaluations).forEach(([agentId, content]) => {
            const roleName = discussion.roles[agentId]?.name || agentId;
            htmlContent += `
              <div class="agent">
                <div class="agent-name">${roleName}:</div>
                <div class="content">${content}</div>
              </div>
            `;
          });
        } else if (round.synthesis) {
          // Manager synthesis round
          htmlContent += `
            <div class="agent">
              <div class="agent-name">${discussion.roles['agent-llama33']?.name || 'Strategy Guide'}:</div>
              <div class="content">${round.synthesis}</div>
            </div>
          `;
        } else if (round.plans) {
          // Implementation planning round
          Object.entries(round.plans).forEach(([agentId, content]) => {
            const roleName = discussion.roles[agentId]?.name || agentId;
            htmlContent += `
              <div class="agent">
                <div class="agent-name">${roleName}'s Implementation Plan:</div>
                <div class="content">${content}</div>
              </div>
            `;
          });
        } else if (round.roadmap) {
          // Implementation roadmap round
          htmlContent += `
            <div class="agent">
              <div class="agent-name">${discussion.roles['agent-llama33']?.name || 'Strategy Guide'}'s Implementation Roadmap:</div>
              <div class="content">${round.roadmap}</div>
            </div>
          `;
        }
        
        htmlContent += '</div>'; // Close round div
      });
      
      htmlContent += '</div>'; // Close section div
    }
    
    // Add final conclusions
    if (discussion.finalConclusions) {
      htmlContent += `
        <div class="section">
          <h2>Final Conclusions and Implementation Roadmap</h2>
          <div class="content">${discussion.finalConclusions.replace(/\n/g, '<br>')}</div>
        </div>
      `;
    }
    
    // Add summary
    if (discussion.summary) {
      htmlContent += `
        <div class="summary">
          <p><strong>Executive Summary:</strong> ${discussion.summary}</p>
        </div>
      `;
    }
    
    htmlContent += `
        </body>
      </html>
    `;
    
    // Create PDF from HTML
    const pdfOptions = { 
      format: 'Letter',
      border: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    };
    
    // Generate the PDF
    pdf.create(htmlContent, pdfOptions).toBuffer((err, buffer) => {
      if (err) {
        logger.error('Error generating PDF:', err);
        return res.status(500).json({ error: 'Error generating PDF', message: err.message });
      }
      
      // Send the PDF as a download
      const filename = `brainstorming-results-${pdfId}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    });
    
  } catch (error) {
    logger.error('Error exporting PDF:', error.message);
    res.status(500).json({
      error: 'Error exporting PDF',
      message: error.message
    });
  }
});

// Default route to serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  logger.info(`Manager Agent running on port ${PORT}`);
}); 