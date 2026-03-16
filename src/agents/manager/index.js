
const dotenv = require('dotenv');
dotenv.config();


const validateEnv = require('../../utils/validateEnv');
validateEnv();


require('../../shared/tracing').initTracing('manager');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');
const morgan = require('morgan');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { Server } = require('socket.io');
const http = require('http');
const cookieParser = require('cookie-parser');

// Import shared utilities
const { logger } = require('../../shared/logger');
const { generateResponse, generateResponseStream } = require('../../shared/ollama');
const { PERFORMATIVES, createMessage } = require('../../shared/messaging');
const { VotingSystem, VOTING_STRATEGY, formatVotingResults } = require('../../shared/voting');
const {
  getAgentConfig,
  updateAgentConfig,
  resetAgentConfig,
  getAllAgentConfigs,
  validateAgentConfig,
  buildSystemPrompt
} = require('../../shared/agent-config');
const { connectDB } = require('../../config/database');

// Import routes
const authRoutes = require('../../routes/auth');
const conversationRoutes = require('../../routes/conversations');
const promptRoutes = require('../../routes/prompts');
const { authenticate } = require('../../middleware/auth');
const { signAgentRequest } = require('../../shared/agentAuth');
const { auditLog } = require('../../middleware/auditLog');
const { CircuitBreaker, CircuitOpenError } = require('../../shared/circuitBreaker');
const { withRetry } = require('../../shared/retry');
const { register: metricsRegistry, httpMetricsMiddleware, agentMetrics, wsMetrics } = require('../../monitoring/metrics');

// Import rate limiters
const {
  generalLimiter,
  authLimiter,
  messageLimiter,
  exportLimiter,
  createConversationLimiter
} = require('../../middleware/rateLimiter');

// HTML escape function to prevent XSS
function escapeHtml(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Constants
const PORT = process.env.MANAGER_PORT || 3000;
const MANAGER_MODEL = process.env.MANAGER_MODEL || 'llama3:latest';
const EXPORTS_DIR = path.join(__dirname, '../exports');

// Ensure exports directory exists
if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

// Agent service endpoints.
// In Docker set AGENT_{N}_URL=http://<container-name>:<port> so the manager
// reaches agents by Docker network hostname instead of localhost.
const AGENT_ENDPOINTS = {
  'agent-1': `${process.env.AGENT_1_URL || `http://localhost:${process.env.AGENT_1_PORT || 3005}`}/message`,
  'agent-2': `${process.env.AGENT_2_URL || `http://localhost:${process.env.AGENT_2_PORT || 3006}`}/message`,
  'agent-3': `${process.env.AGENT_3_URL || `http://localhost:${process.env.AGENT_3_PORT || 3007}`}/message`,
  'agent-4': `${process.env.AGENT_4_URL || `http://localhost:${process.env.AGENT_4_PORT || 3008}`}/message`,
};

// One circuit breaker per agent — prevents thundering-herd when an agent is down
const circuitBreakers = {};
for (const agentId of Object.keys(AGENT_ENDPOINTS)) {
  const cb = new CircuitBreaker(agentId, { failureThreshold: 3, recoveryTimeoutMs: 30_000 });
  // Mirror every state change into Prometheus immediately
  cb.on('stateChange', ({ name, to }) => {
    agentMetrics.setCircuitState(name, to);
    logger.warn(`Circuit breaker [${name}]: → ${to}`);
  });
  // Initialise metric to CLOSED (0) so Grafana has a baseline from startup
  agentMetrics.setCircuitState(agentId, 'CLOSED');
  circuitBreakers[agentId] = cb;
}

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    // Locked to the configured frontend origin — never wildcard.
    origin: process.env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST"]
  },
  pingTimeout: parseInt(process.env.WEBSOCKET_PING_TIMEOUT) || 600000,  // 10 minutes
  pingInterval: parseInt(process.env.WEBSOCKET_PING_INTERVAL) || 30000,  // 30 seconds  
  transports: ['websocket', 'polling'],
  connectTimeout: 120000,
  allowEIO3: true,
  maxHttpBufferSize: 1e8,
  allowUpgrades: false,  // Prevent transport upgrades that cause disconnects
  upgradeTimeout: 60000,
  cookie: {
    name: 'multi-agent-session',
    httpOnly: false,
    sameSite: 'lax'
  },
  perMessageDeflate: false  // Disable compression to prevent issues
});

// ── Security middleware (must be first) ───────────────────────────────────────

// Helmet sets security-critical HTTP headers. Must come before any route.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Socket.IO polling transport uses XHR from the frontend origin
      connectSrc: ["'self'", process.env.FRONTEND_URL, 'ws://localhost:*', 'wss://localhost:*'],
      scriptSrc:  ["'self'"],
      // Tailwind/Radix inject inline styles at runtime
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:'],
      frameSrc:   ["'none'"],
      objectSrc:  ["'none'"],
    },
  },
  hsts:              { maxAge: 31536000, includeSubDomains: true },
  frameguard:        { action: 'deny' },
  referrerPolicy:    { policy: 'strict-origin-when-cross-origin' },
  // Must be false: Socket.IO polling uses cross-origin XHR which COEP breaks
  crossOriginEmbedderPolicy: false,
}));

// Redirect HTTP → HTTPS in production (handled by reverse proxy setting X-Forwarded-Proto)
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.hostname}${req.url}`);
    }
    next();
  });
}

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3002',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));
app.use(httpMetricsMiddleware);

// Connect to MongoDB
connectDB().catch(err => {
  logger.error('Failed to connect to MongoDB:', err);
});

// CSRF protection for /api routes.
// Requests carrying a Bearer token are already bound to sessionStorage (can't be
// stolen cross-origin), so they are exempt. Cookie-only requests must originate
// from the expected frontend URL.
function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  // All state-changing /api requests must originate from the expected frontend origin.
  // We do NOT exempt Bearer-token requests here: an attacker can set that header to
  // bypass this check while the browser still sends the httpOnly cookie for auth.
  // The upstream authenticate middleware handles token verification independently.
  const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3002';
  let source = req.headers.origin;
  if (!source && req.headers.referer) {
    try { source = new URL(req.headers.referer).origin; } catch (_) { /* ignore */ }
  }

  if (!source || source !== allowedOrigin) {
    logger.warn(`CSRF: blocked ${req.method} ${req.path} from origin="${source}"`);
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  next();
}

// ── Prometheus metrics endpoint ───────────────────────────────────────────────
// Not behind authenticate — Prometheus scraper uses network-level access control.
// In production, restrict this to your internal monitoring VLAN / scraper IP.
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', metricsRegistry.contentType);
    res.end(await metricsRegistry.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

// ── Health endpoint ───────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const cbStatuses = Object.values(circuitBreakers).map(cb => cb.status());
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    circuitBreakers: cbStatuses,
  });
});

// API Routes with rate limiting
// auditLog comes after authenticate so req.user is populated; auth routes
// call auditEvent() directly inside their handlers for login/signup events.
app.use('/api/auth', authLimiter, csrfProtection, auditLog, authRoutes);
app.use('/api/conversations', generalLimiter, csrfProtection, authenticate, auditLog, conversationRoutes);
app.use('/api/prompts', generalLimiter, csrfProtection, authenticate, auditLog, promptRoutes);

// Store for active conversations
const conversations = new Map();

// Conversation cleanup settings
const MAX_CONVERSATION_AGE = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MAX_CONVERSATIONS = 1000; // Maximum number of conversations to keep

// Cleanup old conversations periodically
setInterval(() => {
  const now = Date.now();
  const conversationsToDelete = [];
  
  for (const [id, conversation] of conversations) {
    if (now - conversation.lastActivity > MAX_CONVERSATION_AGE) {
      conversationsToDelete.push(id);
    }
  }
  
  // Remove old conversations
  conversationsToDelete.forEach(id => {
    conversations.delete(id);
    logger.info(`Cleaned up old conversation: ${id}`);
  });
  
  // If still too many conversations, remove oldest ones
  if (conversations.size > MAX_CONVERSATIONS) {
    const sortedConversations = Array.from(conversations.entries())
      .sort((a, b) => a[1].lastActivity - b[1].lastActivity);
    
    const toRemove = sortedConversations.slice(0, conversations.size - MAX_CONVERSATIONS);
    toRemove.forEach(([id]) => {
      conversations.delete(id);
      logger.info(`Cleaned up excess conversation: ${id}`);
    });
  }
}, 60 * 60 * 1000); // Run cleanup every hour

// ── Socket.IO authentication middleware ───────────────────────────────────────
// Clients must send { auth: { token } } in the io() call options.
// Unauthenticated sockets are disconnected immediately.
const { verifyToken } = require('../../utils/jwt');

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    logger.warn(`Socket ${socket.id} rejected — no token`);
    return next(new Error('Authentication required'));
  }
  try {
    socket.user = verifyToken(token); // { id, email, iat, exp }
    next();
  } catch {
    logger.warn(`Socket ${socket.id} rejected — invalid token`);
    next(new Error('Invalid or expired token'));
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  wsMetrics.increment();
  logger.info(`Client connected: ${socket.id} (user: ${socket.user?.id})`);

  // Send connection confirmation
  socket.emit('connection-confirmed', {
    id: socket.id,
    timestamp: Date.now()
  });
  
  socket.on('join-conversation', (conversationId) => {
    if (conversationId && typeof conversationId === 'string') {
      socket.join(conversationId);
      logger.info(`Client ${socket.id} joined conversation: ${conversationId}`);
      socket.emit('joined-conversation', { conversationId });
    } else {
      socket.emit('error', { message: 'Invalid conversation ID' });
    }
  });
  
  socket.on('leave-conversation', (conversationId) => {
    if (conversationId && typeof conversationId === 'string') {
      socket.leave(conversationId);
      logger.info(`Client ${socket.id} left conversation: ${conversationId}`);
      socket.emit('left-conversation', { conversationId });
    }
  });
  
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });
  
  socket.on('disconnect', (reason) => {
    wsMetrics.decrement();
    logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
  });
  
  socket.on('error', (error) => {
    logger.error(`Socket error for ${socket.id}:`, error);
  });
  
  socket.on('connect_error', (error) => {
    logger.error(`Connection error for ${socket.id}:`, error);
  });
});

// Helper function to broadcast conversation updates
function broadcastConversationUpdate(conversationId, message) {
  io.to(conversationId).emit('conversation-update', {
    conversationId,
    message,
    timestamp: Date.now()
  });
}

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
 * Response cache to reduce redundant LLM calls
 */
const responseCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100;

/**
 * Cache analytics tracking
 */
const cacheAnalytics = {
  hits: 0,
  misses: 0,
  evictions: 0,
  totalRequests: 0,
  startTime: Date.now()
};

/**
 * Generate cache key from message content
 */
function generateCacheKey(agentId, content) {
  // Simple hash function for cache key
  const str = `${agentId}:${content.trim().toLowerCase()}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
}

/**
 * Get cached response if available and not expired
 */
function getCachedResponse(agentId, content) {
  cacheAnalytics.totalRequests++;

  const key = generateCacheKey(agentId, content);
  const cached = responseCache.get(key);

  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    cacheAnalytics.hits++;
    logger.info(`Cache hit for ${agentId} (hit rate: ${getCacheHitRate().toFixed(1)}%)`);
    return cached.response;
  }

  cacheAnalytics.misses++;
  return null;
}

/**
 * Store response in cache
 */
function cacheResponse(agentId, content, response) {
  // Limit cache size
  if (responseCache.size >= MAX_CACHE_SIZE) {
    const firstKey = responseCache.keys().next().value;
    responseCache.delete(firstKey);
    cacheAnalytics.evictions++;
  }

  const key = generateCacheKey(agentId, content);
  responseCache.set(key, {
    response,
    timestamp: Date.now()
  });
}

/**
 * Get cache hit rate percentage
 */
function getCacheHitRate() {
  if (cacheAnalytics.totalRequests === 0) return 0;
  return (cacheAnalytics.hits / cacheAnalytics.totalRequests) * 100;
}

/**
 * Get detailed cache statistics
 */
function getCacheStats() {
  const uptime = Date.now() - cacheAnalytics.startTime;
  const hitRate = getCacheHitRate();

  // Calculate memory savings (estimated)
  const avgResponseTime = 2000; // 2 seconds average LLM response time
  const timeSaved = cacheAnalytics.hits * avgResponseTime;

  return {
    size: responseCache.size,
    maxSize: MAX_CACHE_SIZE,
    ttl: CACHE_TTL,
    hits: cacheAnalytics.hits,
    misses: cacheAnalytics.misses,
    evictions: cacheAnalytics.evictions,
    totalRequests: cacheAnalytics.totalRequests,
    hitRate: Math.round(hitRate * 10) / 10,
    uptime: Math.floor(uptime / 1000), // seconds
    estimatedTimeSaved: Math.floor(timeSaved / 1000), // seconds
    performance: {
      status: hitRate > 50 ? 'excellent' : hitRate > 30 ? 'good' : hitRate > 10 ? 'fair' : 'poor',
      recommendation: hitRate < 30 ? 'Consider increasing cache TTL or size' : 'Cache performing well'
    }
  };
}

/**
 * Reset cache analytics (for testing/monitoring)
 */
function resetCacheAnalytics() {
  cacheAnalytics.hits = 0;
  cacheAnalytics.misses = 0;
  cacheAnalytics.evictions = 0;
  cacheAnalytics.totalRequests = 0;
  cacheAnalytics.startTime = Date.now();
  logger.info('Cache analytics reset');
}

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

  const cb = circuitBreakers[targetAgent];
  const startMs = Date.now();

  try {
    logger.info(`Sending message to ${targetAgent}`);
    const response = await cb.execute(() =>
      withRetry(
        () => axios.post(endpoint, message, {
          timeout: 60_000,
          headers: signAgentRequest(message, process.env.AGENT_SHARED_SECRET),
        }),
        { maxAttempts: 3, baseDelayMs: 500, maxDelayMs: 10_000 }
      )
    );
    agentMetrics.recordRequest(targetAgent, 'success');
    agentMetrics.recordDuration(targetAgent, (Date.now() - startMs) / 1000);
    return response.data;
  } catch (error) {
    if (error.code === 'CIRCUIT_OPEN') {
      agentMetrics.recordRequest(targetAgent, 'circuit_open');
    } else {
      agentMetrics.recordRequest(targetAgent, 'error');
    }
    logger.error(`Error routing message to ${targetAgent}:`, error.message);
    throw new Error(`Failed to communicate with ${targetAgent}: ${error.message}`);
  }
}

/**
 * Send message to agent (simplified wrapper for voting sessions)
 * Uses caching to avoid redundant LLM calls
 *
 * @param {String} agentId - Target agent ID
 * @param {String} content - Message content
 * @param {String} userId - Optional user ID
 * @returns {Promise<Object>} - Agent's response
 */
async function sendToAgent(agentId, content, userId = null) {
  // Check cache first for simple queries
  const cached = getCachedResponse(agentId, content);
  if (cached) {
    return cached;
  }

  // Create message object
  const message = createMessage(
    'Manager',
    agentId,
    content,
    PERFORMATIVES.REQUEST
  );

  // Add user context if provided
  if (userId) {
    message.userId = userId;
  }

  // Route to agent
  const response = await routeMessageToAgent(message);

  // Cache the response
  cacheResponse(agentId, content, response);

  return response;
}

/**
 * Stream a message to an agent and forward each token as a Socket.IO event.
 *
 * Emits (to the conversationId room):
 *   agent-thinking  { agentId, conversationId, timestamp }              — by callers, before this fn
 *   stream-start    { messageId, agentId, conversationId, timestamp }
 *   stream-token    { messageId, token, conversationId }
 *   stream-end      { messageId, agentId, content, confidence, conversationId, timestamp, type? }
 *   stream-error    { agentId, conversationId }                         — by callers, on catch
 *
 * @param {Object}  message        - Message object (same shape as routeMessageToAgent)
 * @param {string}  conversationId - Socket.IO room to broadcast to
 * @param {string}  [type]         - Optional message type (e.g. 'manager-conclusion')
 * @returns {Promise<{content, agentId, messageId, confidence}>}
 */
async function streamMessageToAgent(message, conversationId, type) {
  const targetAgent = message.to;
  const endpoint = AGENT_ENDPOINTS[targetAgent];
  if (!endpoint) throw new Error(`Unknown agent: ${targetAgent}`);

  const streamEndpoint = endpoint.replace('/message', '/message/stream');
  const messageId = `${targetAgent}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

  io.to(conversationId).emit('stream-start', {
    messageId,
    agentId: targetAgent,
    conversationId,
    timestamp: Date.now()
  });

  const cb = circuitBreakers[targetAgent];
  // Streaming holds the connection open — wrap only the initial HTTP connect in
  // the circuit breaker, not the entire stream duration.
  const response = await cb.execute(() =>
    axios.post(streamEndpoint, message, {
      responseType: 'stream',
      timeout: 120_000,
      headers: signAgentRequest(message, process.env.AGENT_SHARED_SECRET),
    })
  );

  return new Promise((resolve, reject) => {
    let fullContent = '';
    let buffer = '';
    let confidence = null;
    // Guard: ensures the Promise settles exactly once regardless of how many
    // `done` frames or `end` events the readable stream fires. Without this,
    // the normal path emits stream-end twice (once from `data.done`, once from
    // the Node.js `end` event that always fires after all `data` events).
    let settled = false;

    const settle = (fn) => {
      if (settled) return;
      settled = true;
      fn();
    };

    response.data.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.token) {
            fullContent += data.token;
            io.to(conversationId).emit('stream-token', { messageId, token: data.token, conversationId });
          }
          if (data.done) {
            const finalContent = data.content || fullContent.trim();
            confidence = data.confidence;
            settle(() => {
              io.to(conversationId).emit('stream-end', {
                messageId,
                agentId: targetAgent,
                content: finalContent,
                confidence,
                conversationId,
                timestamp: Date.now(),
                ...(type ? { type } : {})
              });
              resolve({ content: finalContent, agentId: targetAgent, messageId, confidence });
            });
          }
          // Only reject on error if we have not already resolved. This prevents
          // a spurious reject when an error frame appears after a done frame in
          // the same SSE chunk.
          if (data.error) settle(() => reject(new Error(data.error)));
        } catch (e) { /* skip malformed JSON lines */ }
      }
    });

    response.data.on('end', () => {
      // Fallback: stream closed without a `done` frame (network drop, agent
      // crash, etc.). If we accumulated content, deliver it. If not, reject
      // so callers can emit an error message and clean up any "thinking"
      // placeholder — a hung Promise would leave the bubble on-screen forever.
      settle(() => {
        if (fullContent) {
          const finalContent = fullContent.trim();
          io.to(conversationId).emit('stream-end', {
            messageId,
            agentId: targetAgent,
            content: finalContent,
            conversationId,
            timestamp: Date.now(),
            ...(type ? { type } : {})
          });
          resolve({ content: finalContent, agentId: targetAgent, messageId, confidence });
        } else {
          reject(new Error(`Agent ${targetAgent} closed stream without producing content`));
        }
      });
    });

    response.data.on('error', (err) => settle(() => reject(err)));
  });
}

/**
 * Handle single agent conversation
 */
app.post('/message', messageLimiter, async (req, res) => {
  try {
    const { content, agentId, agentName, conversationId } = req.body;
    
    // Input validation
    if (!content || !agentId) {
      return res.status(400).json({ error: 'Content and agentId are required' });
    }
    
    if (typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content must be a non-empty string' });
    }
    
    if (typeof agentId !== 'string' || !/^agent-[1-4]$/.test(agentId)) {
      return res.status(400).json({ error: 'AgentId must be in format agent-1, agent-2, agent-3, or agent-4' });
    }
    
    if (agentName && (typeof agentName !== 'string' || agentName.trim().length === 0)) {
      return res.status(400).json({ error: 'AgentName must be a non-empty string if provided' });
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

    // Add conversation context if provided
    if (conversationId) {
      const conversation = conversations.get(conversationId);
      if (conversation) {
        message.conversationHistory = [...conversation.history];
        message.isFollowUp = true;
      }
    }

    let responseContent;
    let responseMessageId;

    if (conversationId) {
      // Streaming path: tokens flow to the frontend via Socket.IO in real-time
      const conversation = conversations.get(conversationId);

      // Broadcast user message immediately so the frontend sees it right away
      const userMessage = {
        from: 'user',
        content,
        timestamp: Date.now(),
        type: 'direct-message'
      };
      if (conversation) {
        conversation.history.push(userMessage);
        conversation.lastActivity = Date.now();
      }
      broadcastConversationUpdate(conversationId, userMessage);

      // Emit before opening the HTTP stream to the agent. There is a latency
      // gap of 200 ms – 2 s between this point and the first stream-start event
      // (TCP connect + Ollama context load). agent-thinking lets the frontend
      // show a "thinking" indicator immediately so the UI never looks frozen.
      io.to(conversationId).emit('agent-thinking', {
        agentId: message.to,
        conversationId,
        timestamp: Date.now(),
      });

      // Inner try-catch so we can emit stream-error before the outer catch
      // sends the HTTP 500 — this removes the "thinking" bubble from the UI.
      // conversationId is in this block's scope so we can reference it here
      // but not in the outer catch where it would be out of scope.
      try {
        const streamResult = await streamMessageToAgent(message, conversationId);
        responseContent = streamResult.content;
        responseMessageId = streamResult.messageId;

        // Persist agent response to conversation history
        if (conversation) {
          const agentMessage = {
            from: agentName || `Agent ${agentId.slice(-1)}`,
            content: responseContent,
            timestamp: Date.now(),
            agentId,
            type: 'direct-response',
            messageId: responseMessageId
          };
          conversation.history.push(agentMessage);
          conversation.lastActivity = Date.now();
        }
      } catch (streamError) {
        // Tell the frontend to remove the thinking placeholder — without this,
        // the bubble stays on screen with spinning dots indefinitely.
        io.to(conversationId).emit('stream-error', { agentId: message.to, conversationId });
        throw streamError; // propagate so the outer catch returns HTTP 500
      }
    } else {
      // Non-streaming fallback (no active Socket.IO room)
      const response = await routeMessageToAgent(message);
      responseContent = response.content;
    }

    res.json({
      success: true,
      response: { content: responseContent, agentId, messageId: responseMessageId }
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
app.post('/team-conversation', messageLimiter, async (req, res) => {
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

    if (participants.length === 0 || participants.length > 4) {
      return res.status(400).json({
        error: 'participants must contain between 1 and 4 agents',
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
    conversation.lastActivity = Date.now();
    
    // Broadcast user message to connected clients
    broadcastConversationUpdate(convId, userMessage);
    
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

        // Emit before opening the HTTP stream. Covers the latency gap between
        // agent selection and the first arriving token so the UI never looks
        // frozen while Ollama loads the model context.
        io.to(convId).emit('agent-thinking', {
          agentId: participant.agentId,
          conversationId: convId,
          timestamp: Date.now(),
        });
        // Stream response — tokens appear in the frontend in real-time
        const streamResult = await streamMessageToAgent(message, convId);

        const responseMessage = {
          from: message.agentName,
          content: streamResult.content,
          timestamp: Date.now(),
          messageId: streamResult.messageId
        };
        conversation.history.push(responseMessage);
        conversation.lastActivity = Date.now();
        responses.push(responseMessage);
        // No broadcastConversationUpdate — stream-end already delivered the message
        
      } catch (error) {
        logger.error(`Error getting response from ${participant.agentId}:`, error.message);
        // Remove the "thinking" bubble so the frontend does not show it
        // alongside the error message that broadcastConversationUpdate delivers.
        io.to(convId).emit('stream-error', { agentId: participant.agentId, conversationId: convId });
        const errorMessage = {
          from: participant.agentName || `Agent ${participant.agentId.slice(-1)}`,
          content: `Sorry, I'm having trouble responding right now: ${error.message}`,
          timestamp: Date.now(),
          error: true
        };
        conversation.history.push(errorMessage);
        conversation.lastActivity = Date.now();
        responses.push(errorMessage);
        
        // Broadcast error message to connected clients
        broadcastConversationUpdate(convId, errorMessage);
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
app.get('/export-chat/:conversationId', exportLimiter, authenticate, async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    
    // Validate conversation ID format to prevent path traversal
    if (typeof conversationId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation ID format' });
    }
    
    const conversation = conversations.get(conversationId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Generate PDF using pdfkit
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    const pdfBuffer = await new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(18).font('Helvetica-Bold')
        .text('Multi-Agent Chat Conversation', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica')
        .text(`Conversation ID: ${conversationId}`, { align: 'center' })
        .text(`Created: ${conversation.createdAt}`, { align: 'center' })
        .text(`Export Date: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown();

      // Participants
      doc.fontSize(12).font('Helvetica-Bold').text('Participants:');
      doc.fontSize(10).font('Helvetica').text('• User');
      conversation.participants.forEach(p => {
        doc.text(`• ${p.agentName || p.agentId}`);
      });
      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown();

      // Messages
      doc.fontSize(12).font('Helvetica-Bold').text('Conversation History:');
      doc.moveDown(0.5);

      conversation.history.forEach((message, idx) => {
        if (idx > 0 && doc.y > 680) doc.addPage();

        const from = String(message.from || 'unknown');
        const content = String(message.content || '');
        const timestamp = message.timestamp
          ? new Date(message.timestamp).toLocaleString()
          : '';

        doc.fontSize(10).font('Helvetica-Bold')
          .text(from, { continued: true })
          .font('Helvetica').fillColor('#666666')
          .text(`  ${timestamp}`)
          .fillColor('#000000');

        doc.fontSize(10).font('Helvetica').text(content, { width: 495 });
        doc.moveDown(0.5);

        if (idx < conversation.history.length - 1) {
          doc.moveTo(50, doc.y).lineTo(545, doc.y).dash(3, { space: 3 }).stroke().undash();
          doc.moveDown(0.5);
        }
      });

      // Footer
      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.fontSize(9).fillColor('#666666')
        .text('Generated by Multi-Agent Chatbot System', { align: 'center' });

      doc.end();
    });

    const fileName = `chat-${conversationId}-${Date.now()}.pdf`;

    // Only attempt the MongoDB write when conversationId is a valid ObjectId.
    // In-memory conversations (e.g. "conv-1234567890") are not stored in MongoDB
    // and passing them to findByIdAndUpdate throws a CastError.
    const mongoose = require('mongoose');
    if (/^[0-9a-fA-F]{24}$/.test(conversationId) && mongoose.Types.ObjectId.isValid(conversationId)) {
      try {
        const Conversation = require('../../models/Conversation');
        await Conversation.findByIdAndUpdate(conversationId, {
          $push: {
            pdfExports: {
              fileName,
              fileSize: pdfBuffer.length,
              data: pdfBuffer,
              mimeType: 'application/pdf',
              createdAt: new Date(),
            },
          },
        });
        logger.info(`PDF saved to MongoDB for conversation ${conversationId}`);
      } catch (dbErr) {
        logger.error(`PDF MongoDB save failed (non-fatal): ${dbErr.message}`);
      }
    }

    // Send the PDF file to user
    const encodedName = encodeURIComponent(fileName);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

  } catch (error) {
    logger.error('Error exporting chat to PDF:', error.message);
    res.status(500).json({ 
      error: `Error exporting chat: ${error.message}` 
    });
  }
});

/**
 * Get all PDF exports for a conversation
 */
app.get('/export/:conversationId/pdfs', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const Conversation = require('../../models/Conversation');

    const conversation = await Conversation.findById(conversationId)
      .select('pdfExports.createdAt pdfExports.fileName pdfExports.fileSize pdfExports._id')
      .lean();

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({
      conversationId,
      pdfs: conversation.pdfExports || []
    });
  } catch (error) {
    logger.error('Error fetching PDF list:', error.message);
    res.status(500).json({ error: 'Error fetching PDF list' });
  }
});

/**
 * Download a specific PDF export from MongoDB
 */
app.get('/export/:conversationId/pdf/:pdfId', async (req, res) => {
  try {
    const { conversationId, pdfId } = req.params;
    const Conversation = require('../../models/Conversation');

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const pdfExport = conversation.pdfExports.id(pdfId);

    if (!pdfExport) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    // Send the PDF
    res.setHeader('Content-Type', pdfExport.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${pdfExport.fileName}"`);
    res.setHeader('Content-Length', pdfExport.fileSize);
    res.send(pdfExport.data);

    logger.info(`PDF downloaded: ${pdfExport.fileName}`);
  } catch (error) {
    logger.error('Error downloading PDF:', error.message);
    res.status(500).json({ error: 'Error downloading PDF' });
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
    exportsDirectory: EXPORTS_DIR,
    cache: getCacheStats()
  });
});

/**
 * Get detailed cache analytics
 */
app.get('/api/cache/stats', (req, res) => {
  res.json({
    success: true,
    cache: getCacheStats()
  });
});

/**
 * Clear cache
 */
app.post('/api/cache/clear', (req, res) => {
  const previousSize = responseCache.size;
  responseCache.clear();
  resetCacheAnalytics();

  logger.info(`Cache cleared: ${previousSize} entries removed`);

  res.json({
    success: true,
    message: 'Cache cleared successfully',
    entriesRemoved: previousSize
  });
});

/**
 * Research Mode - Extended Multi-Round Agent Collaboration
 */
app.post('/research-session', messageLimiter, async (req, res) => {
  try {
    const { 
      topic, 
      rounds = 3, 
      participants, 
      conversationId,
      managerInstructions = "Facilitate a collaborative research discussion"
    } = req.body;
    
    if (!topic || !participants || !Array.isArray(participants)) {
      return res.status(400).json({
        error: 'Topic and participants array are required'
      });
    }

    if (participants.length === 0 || participants.length > 4) {
      return res.status(400).json({
        error: 'participants must contain between 1 and 4 agents',
      });
    }

    const convId = conversationId || `research-${Date.now()}`;
    
    // Initialize research session
    if (!conversations.has(convId)) {
      conversations.set(convId, {
        id: convId,
        type: 'research',
        topic: topic,
        rounds: rounds,
        currentRound: 0,
        history: [],
        participants: participants,
        createdAt: new Date().toISOString(),
        lastActivity: Date.now()
      });
    }
    
    const conversation = conversations.get(convId);
    
    // Manager's opening message
    const managerOpeningMessage = {
      from: 'Manager',
      content: `🔬 **Research Session Started**\n\n**Topic**: ${topic}\n\n**Participants**: ${participants.map(p => p.agentName).join(', ')}\n\n**Instructions**: ${managerInstructions}\n\nLet's begin our collaborative research. Each agent will contribute their expertise across ${rounds} rounds of discussion.`,
      timestamp: Date.now(),
      type: 'manager-instruction'
    };
    
    conversation.history.push(managerOpeningMessage);
    conversation.lastActivity = Date.now();
    broadcastConversationUpdate(convId, managerOpeningMessage);
    
    // Start the research rounds
    await conductResearchRounds(convId, topic, participants, rounds);
    
    res.json({
      success: true,
      conversationId: convId,
      message: 'Research session started',
      participants: participants,
      rounds: rounds
    });
    
  } catch (error) {
    logger.error('Error starting research session:', error.message);
    res.status(500).json({ error: 'Failed to start research session' });
  }
});

/**
 * Detect if agents have reached convergence (agreement) on the topic
 * Uses semantic similarity and agreement markers in responses
 */
function detectConvergence(roundResponses, threshold = 0.75) {
  if (roundResponses.length < 2) return { converged: false, confidence: 0 };

  // Extract key phrases and agreement markers
  const agreementMarkers = [
    'i agree', 'agreed', 'consensus', 'aligned', 'same conclusion',
    'similarly', 'likewise', 'as mentioned', 'building on that',
    'exactly', 'precisely', 'correct', 'absolutely'
  ];

  const disagreementMarkers = [
    'however', 'but', 'disagree', 'alternatively', 'on the other hand',
    'different', 'contrary', 'oppose', 'challenge'
  ];

  let agreementScore = 0;
  let disagreementScore = 0;
  let totalComparisons = 0;

  // Compare each pair of responses
  for (let i = 0; i < roundResponses.length; i++) {
    for (let j = i + 1; j < roundResponses.length; j++) {
      const response1 = roundResponses[i].content.toLowerCase();
      const response2 = roundResponses[j].content.toLowerCase();

      totalComparisons++;

      // Check for agreement markers
      agreementMarkers.forEach(marker => {
        if (response1.includes(marker) || response2.includes(marker)) {
          agreementScore += 0.5;
        }
      });

      // Check for disagreement markers
      disagreementMarkers.forEach(marker => {
        if (response1.includes(marker) || response2.includes(marker)) {
          disagreementScore += 0.5;
        }
      });

      // Check for similar key concepts (simple word overlap)
      const words1 = response1.split(/\s+/).filter(w => w.length > 5);
      const words2 = response2.split(/\s+/).filter(w => w.length > 5);
      const commonWords = words1.filter(w => words2.includes(w));

      if (commonWords.length > 5) {
        agreementScore += 0.3;
      }
    }
  }

  // Calculate convergence confidence
  const netAgreement = agreementScore - disagreementScore;
  const confidence = Math.max(0, Math.min(1, netAgreement / (totalComparisons * 2)));

  const converged = confidence >= threshold;

  return {
    converged,
    confidence: Math.round(confidence * 100) / 100,
    agreementScore,
    disagreementScore,
    totalComparisons
  };
}

/**
 * Conduct multi-round research discussion with convergence detection
 */
async function conductResearchRounds(conversationId, topic, participants, totalRounds) {
  const conversation = conversations.get(conversationId);
  let converged = false;

  for (let round = 1; round <= totalRounds; round++) {
    conversation.currentRound = round;
    
    // Manager announces the round
    const roundAnnouncement = {
      from: 'Manager',
      content: `📋 **Round ${round} of ${totalRounds}**\n\n${getRoundInstructions(round, totalRounds, topic)}`,
      timestamp: Date.now(),
      type: 'round-announcement'
    };
    
    conversation.history.push(roundAnnouncement);
    conversation.lastActivity = Date.now();
    broadcastConversationUpdate(conversationId, roundAnnouncement);
    
    // Each agent contributes to this round
    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i];
      
      try {
        // Create contextual prompt for this round
        const roundPrompt = createRoundPrompt(topic, round, totalRounds, conversation.history);
        
        const message = createMessage(
          'Manager',
          participant.agentId,
          roundPrompt,
          PERFORMATIVES.REQUEST
        );
        
        message.agentName = participant.agentName;
        message.conversationHistory = [...conversation.history];
        message.researchContext = {
          topic,
          round,
          totalRounds,
          role: participant.role || 'researcher'
        };

        // Emit before opening the HTTP stream. Covers the latency gap between
        // agent selection and the first arriving token so the UI never looks
        // frozen while Ollama loads the model context.
        io.to(conversationId).emit('agent-thinking', {
          agentId: participant.agentId,
          conversationId,
          timestamp: Date.now(),
        });
        // Stream response — tokens appear in the frontend in real-time
        const streamResult = await streamMessageToAgent(message, conversationId);

        // Add finalised response to conversation history
        const responseMessage = {
          from: participant.agentName,
          content: streamResult.content,
          timestamp: Date.now(),
          round,
          agentId: participant.agentId,
          messageId: streamResult.messageId
        };

        conversation.history.push(responseMessage);
        conversation.lastActivity = Date.now();
        // No broadcastConversationUpdate — stream-end already delivered the message
        
      } catch (error) {
        logger.error(`Error in research round ${round} for ${participant.agentId}:`, error.message);
        // Remove the "thinking" bubble so the frontend does not show it
        // alongside the error message that broadcastConversationUpdate delivers.
        io.to(conversationId).emit('stream-error', { agentId: participant.agentId, conversationId });
        const errorMessage = {
          from: participant.agentName,
          content: `I'm having trouble contributing to this round: ${error.message}`,
          timestamp: Date.now(),
          round: round,
          error: true
        };
        
        conversation.history.push(errorMessage);
        conversation.lastActivity = Date.now();
        broadcastConversationUpdate(conversationId, errorMessage);
      }
    }

    // Check for convergence after round 2 or later
    if (round >= 2 && round < totalRounds) {
      // Get responses from this round only
      const roundResponses = conversation.history.filter(
        msg => msg.round === round && msg.agentId && !msg.error
      );

      if (roundResponses.length >= 2) {
        const convergenceResult = detectConvergence(roundResponses, 0.70); // 70% threshold

        logger.info(`Round ${round} convergence: ${convergenceResult.converged}, confidence: ${convergenceResult.confidence}`);

        if (convergenceResult.converged) {
          converged = true;

          const convergenceMessage = {
            from: 'Manager',
            content: `🎯 **Convergence Detected** (Round ${round})\n\nThe team has reached strong agreement on this topic with ${(convergenceResult.confidence * 100).toFixed(0)}% confidence.\n\nKey indicators:\n- Agreement markers: ${convergenceResult.agreementScore.toFixed(1)}\n- Disagreement markers: ${convergenceResult.disagreementScore.toFixed(1)}\n- Comparisons analyzed: ${convergenceResult.totalComparisons}\n\nSkipping remaining rounds as consensus has been achieved.`,
            timestamp: Date.now(),
            type: 'convergence-detected'
          };

          conversation.history.push(convergenceMessage);
          conversation.lastActivity = Date.now();
          broadcastConversationUpdate(conversationId, convergenceMessage);

          logger.info(`Research converged at round ${round}, skipping remaining rounds`);
          break; // Exit the loop early
        }
      }
    }

    // Manager provides round summary
    if (round < totalRounds && !converged) {
      const roundSummary = {
        from: 'Manager',
        content: `✅ **Round ${round} Complete**\n\nGreat contributions from all agents! Moving to the next round where we'll build on these insights.`,
        timestamp: Date.now(),
        type: 'round-summary'
      };

      conversation.history.push(roundSummary);
      conversation.lastActivity = Date.now();
      broadcastConversationUpdate(conversationId, roundSummary);
    }
  }
  
  // Final research summary
  const finalSummary = {
    from: 'Manager',
    content: `🎯 **Research Session Complete**\n\n**Topic**: ${topic}\n**Rounds Completed**: ${totalRounds}\n**Participants**: ${participants.map(p => p.agentName).join(', ')}\n\nThank you all for your valuable contributions to this research session!`,
    timestamp: Date.now(),
    type: 'session-complete'
  };
  
  conversation.history.push(finalSummary);
  conversation.lastActivity = Date.now();
  broadcastConversationUpdate(conversationId, finalSummary);
}

/**
 * Get instructions for each research round
 */
function getRoundInstructions(round, totalRounds, topic) {
  switch (round) {
    case 1:
      return `**Initial Research & Ideas**\nEach agent should share their initial thoughts, findings, and approach to researching "${topic}". Focus on your unique perspective and expertise.`;
    case 2:
      return `**Deep Analysis & Building on Ideas**\nBuild on the ideas from Round 1. Provide deeper analysis, critique or expand on previous contributions, and share additional insights.`;
    case 3:
      return `**Synthesis & Conclusions**\nSynthesize the discussion so far. What are the key findings? What conclusions can we draw? How do all the pieces fit together?`;
    default:
      if (round === totalRounds) {
        return `**Final Round - Conclusions & Next Steps**\nProvide your final insights and suggest next steps or areas for further research.`;
      }
      return `**Round ${round} - Continued Analysis**\nContinue building on previous rounds with new insights and analysis.`;
  }
}

/**
 * Create contextual prompt for research rounds
 */
function createRoundPrompt(topic, round, totalRounds, conversationHistory) {
  let prompt = `We are conducting collaborative research on: "${topic}"\n\n`;
  
  if (round === 1) {
    prompt += `This is Round 1 of ${totalRounds}. Please share your initial research findings, thoughts, and approach to this topic. Focus on your unique expertise and perspective.`;
  } else {
    prompt += `This is Round ${round} of ${totalRounds}. Please review what other agents have contributed and build upon their ideas. `;
    
    if (round === totalRounds) {
      prompt += `Since this is the final round, please provide conclusions and synthesis of all the research discussed.`;
    } else {
      prompt += `Provide deeper analysis, expand on previous ideas, or offer new insights that complement the existing research.`;
    }
  }
  
  prompt += `\n\nPlease provide substantial, well-researched content that contributes meaningfully to our collaborative research effort.`;
  
  return prompt;
}

/**
 * Flexible Work Session - User-Defined Agent Prompts
 */
app.post('/flexible-work-session', messageLimiter, async (req, res) => {
  try {
    const { 
      task, 
      agents, // Array of {agentId, agentName, customPrompt}
      conversationId,
      managerRole = "Project manager supervising the work and providing final enhancement"
    } = req.body;
    
    // Validate input
    if (!task || !agents || !Array.isArray(agents) || agents.length === 0) {
      return res.status(400).json({ 
        error: 'Task and agents array with custom prompts are required' 
      });
    }
    
    // Validate each agent has required fields
    for (const agent of agents) {
      if (!agent.agentId || !agent.agentName || !agent.customPrompt) {
        return res.status(400).json({ 
          error: 'Each agent must have agentId, agentName, and customPrompt' 
        });
      }
      if (!/^agent-[1-4]$/.test(agent.agentId)) {
        return res.status(400).json({ 
          error: 'AgentId must be in format agent-1, agent-2, agent-3, or agent-4' 
        });
      }
    }

    const convId = conversationId || `work-${Date.now()}`;
    
    // Initialize work session
    if (!conversations.has(convId)) {
      conversations.set(convId, {
        id: convId,
        type: 'flexible-work',
        task: task,
        agents: agents,
        managerRole: managerRole,
        history: [],
        createdAt: new Date().toISOString(),
        lastActivity: Date.now()
      });
    }
    
    const conversation = conversations.get(convId);
    
    // Manager's opening message
    const managerOpeningMessage = {
      from: 'Manager',
      content: `🎯 **Work Session Started**\n\n**Task**: ${task}\n\n**Team Members**:\n${agents.map(a => `• **${a.agentName}** (${a.agentId}) - ${a.customPrompt.substring(0, 100)}...`).join('\n')}\n\n**Manager Role**: ${managerRole}\n\nLet's begin! Each agent will contribute according to their assigned role.`,
      timestamp: Date.now(),
      type: 'manager-start'
    };
    
    conversation.history.push(managerOpeningMessage);
    conversation.lastActivity = Date.now();
    broadcastConversationUpdate(convId, managerOpeningMessage);
    
    // Start the flexible work session
    await conductFlexibleWorkSession(convId, task, agents, managerRole);
    
    res.json({
      success: true,
      conversationId: convId,
      message: 'Flexible work session started',
      agents: agents,
      managerRole: managerRole
    });
    
  } catch (error) {
    logger.error('Error starting flexible work session:', error.message);
    res.status(500).json({ error: 'Failed to start flexible work session' });
  }
});

/**
 * Conduct flexible work session with user-defined agent prompts
 */
async function conductFlexibleWorkSession(conversationId, task, agents, managerRole) {
  const conversation = conversations.get(conversationId);
  
  // Each agent contributes according to their custom prompt
  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    
    try {
      // Create message with custom prompt
      const message = createMessage(
        'Manager',
        agent.agentId,
        `${agent.customPrompt}\n\nTask: ${task}\n\nPlease contribute your expertise to this task. You can see the work done by previous team members in the conversation history.`,
        PERFORMATIVES.REQUEST
      );
      
      message.agentName = agent.agentName;
      message.conversationHistory = [...conversation.history];
      message.customPrompt = agent.customPrompt;
      message.workContext = {
        task,
        userDefinedRole: agent.customPrompt,
        teamPosition: i + 1,
        totalTeamMembers: agents.length
      };

      // Emit before opening the HTTP stream. Covers the latency gap between
      // agent selection and the first arriving token so the UI never looks
      // frozen while Ollama loads the model context.
      io.to(conversationId).emit('agent-thinking', {
        agentId: agent.agentId,
        conversationId,
        timestamp: Date.now(),
      });
      // Stream response — tokens appear in the frontend in real-time
      const streamResult = await streamMessageToAgent(message, conversationId);

      // Add finalised response to conversation history
      const responseMessage = {
        from: agent.agentName,
        content: streamResult.content,
        timestamp: Date.now(),
        agentId: agent.agentId,
        customRole: agent.customPrompt.substring(0, 100) + '...',
        messageId: streamResult.messageId
      };

      conversation.history.push(responseMessage);
      conversation.lastActivity = Date.now();
      // No broadcastConversationUpdate here — stream-end already delivered the message
      
    } catch (error) {
      logger.error(`Error in flexible work session for ${agent.agentId}:`, error.message);
      // Remove the "thinking" bubble so the frontend does not show it
      // alongside the error message that broadcastConversationUpdate delivers.
      io.to(conversationId).emit('stream-error', { agentId: agent.agentId, conversationId });
      const errorMessage = {
        from: agent.agentName,
        content: `I'm having trouble contributing to this task: ${error.message}`,
        timestamp: Date.now(),
        agentId: agent.agentId,
        error: true
      };
      
      conversation.history.push(errorMessage);
      conversation.lastActivity = Date.now();
      broadcastConversationUpdate(conversationId, errorMessage);
    }
  }
  
  // Manager provides final enhancement/conclusion
  try {
    const managerMessage = createMessage(
      'System',
      'manager',
      `${managerRole}\n\nTask: ${task}\n\nReview all the work contributed by the team members above. Provide a final enhancement, synthesis, or conclusion to complete this work session. Highlight key insights and next steps if applicable.`,
      PERFORMATIVES.REQUEST
    );
    
    managerMessage.conversationHistory = [...conversation.history];
    managerMessage.isManagerResponse = true;
    
    // Stream manager conclusion — tokens delivered in real-time via Socket.IO
    const managerMessageId = `manager-${Date.now()}`;
    io.to(conversationId).emit('stream-start', {
      messageId: managerMessageId,
      agentId: 'manager',
      conversationId,
      timestamp: Date.now()
    });

    let managerContent = '';
    const prefix = '🎯 **Final Enhancement & Conclusion**\n\n';
    const suffix = '\n\n---\n✅ **Work Session Complete**';

    // Emit prefix tokens so the header appears immediately
    io.to(conversationId).emit('stream-token', { messageId: managerMessageId, token: prefix, conversationId });

    managerContent = await generateResponseStream(
      process.env.MANAGER_MODEL || 'llama3:latest',
      managerMessage.content,
      {},
      (token) => {
        io.to(conversationId).emit('stream-token', { messageId: managerMessageId, token, conversationId });
      }
    );

    const managerFinalContent = prefix + managerContent + suffix;

    io.to(conversationId).emit('stream-end', {
      messageId: managerMessageId,
      agentId: 'manager',
      content: managerFinalContent,
      conversationId,
      timestamp: Date.now(),
      type: 'manager-conclusion'
    });

    const finalMessage = {
      from: 'Manager',
      content: managerFinalContent,
      timestamp: Date.now(),
      type: 'manager-conclusion'
    };
    
    conversation.history.push(finalMessage);
    conversation.lastActivity = Date.now();
    broadcastConversationUpdate(conversationId, finalMessage);
    
  } catch (error) {
    logger.error('Error in manager final response:', error.message);
    
    const managerErrorMessage = {
      from: 'Manager',
      content: `🎯 **Work Session Complete**\n\nThe team has successfully completed their contributions to the task. Thank you all for your valuable input!`,
      timestamp: Date.now(),
      type: 'manager-conclusion'
    };
    
    conversation.history.push(managerErrorMessage);
    conversation.lastActivity = Date.now();
    broadcastConversationUpdate(conversationId, managerErrorMessage);
  }
}

/**
 * Continue an existing conversation with follow-up messages
 */
app.post('/continue-conversation', messageLimiter, async (req, res) => {
  try {
    const { 
      conversationId, 
      message, 
      participants 
    } = req.body;
    
    if (!conversationId || !message || !participants || !Array.isArray(participants)) {
      return res.status(400).json({ 
        error: 'ConversationId, message, and participants array are required' 
      });
    }

    // Get existing conversation
    const conversation = conversations.get(conversationId);
    if (!conversation) {
      return res.status(404).json({ 
        error: 'Conversation not found' 
      });
    }
    
    // Add user follow-up message to history
    const userFollowUpMessage = {
      from: 'user',
      content: message,
      timestamp: Date.now(),
      type: 'follow-up'
    };
    conversation.history.push(userFollowUpMessage);
    conversation.lastActivity = Date.now();
    
    // Broadcast user message to connected clients
    broadcastConversationUpdate(conversationId, userFollowUpMessage);
    
    // Get responses from each participant in sequence
    const responses = [];
    
    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i];
      
      try {
        // Create message with conversation history and follow-up context
        const agentMessage = createMessage(
          'user',
          participant.agentId,
          message,
          PERFORMATIVES.REQUEST
        );
        
        // Add context about this being a follow-up
        agentMessage.agentName = participant.agentName || `Agent ${participant.agentId.slice(-1)}`;
        agentMessage.conversationHistory = [...conversation.history];
        agentMessage.isFollowUp = true;
        agentMessage.followUpContext = `This is a follow-up message in an ongoing conversation. Please respond appropriately based on the conversation history and this new input: "${message}"`;

        // Emit before opening the HTTP stream. Covers the latency gap between
        // agent selection and the first arriving token so the UI never looks
        // frozen while Ollama loads the model context.
        io.to(conversationId).emit('agent-thinking', {
          agentId: participant.agentId,
          conversationId,
          timestamp: Date.now(),
        });
        // Stream response — tokens appear in the frontend in real-time
        const streamResult = await streamMessageToAgent(agentMessage, conversationId);

        const responseMessage = {
          from: agentMessage.agentName,
          content: streamResult.content,
          timestamp: Date.now(),
          agentId: participant.agentId,
          type: 'follow-up-response',
          messageId: streamResult.messageId
        };
        conversation.history.push(responseMessage);
        conversation.lastActivity = Date.now();
        responses.push(responseMessage);
        // No broadcastConversationUpdate — stream-end already delivered the message
        
      } catch (error) {
        logger.error(`Error getting follow-up response from ${participant.agentId}:`, error.message);
        // Remove the "thinking" bubble so the frontend does not show it
        // alongside the error message that broadcastConversationUpdate delivers.
        io.to(conversationId).emit('stream-error', { agentId: participant.agentId, conversationId });
        const errorMessage = {
          from: participant.agentName || `Agent ${participant.agentId.slice(-1)}`,
          content: `I'm having trouble responding to your follow-up: ${error.message}`,
          timestamp: Date.now(),
          agentId: participant.agentId,
          error: true,
          type: 'follow-up-error'
        };
        conversation.history.push(errorMessage);
        conversation.lastActivity = Date.now();
        responses.push(errorMessage);
        
        // Broadcast error message to connected clients
        broadcastConversationUpdate(conversationId, errorMessage);
      }
    }

    res.json({
      success: true,
      conversationId: conversationId,
      responses: responses,
      message: 'Follow-up message processed'
    });

  } catch (error) {
    logger.error('Error in continue conversation route:', error.message);
    res.status(500).json({ 
      error: `Error processing follow-up message: ${error.message}` 
    });
  }
});

/**
 * Get suggested agent templates for different task types
 */
app.get('/api/agent-templates', (req, res) => {
  const templates = {
    coding: {
      name: "Software Development Team",
      description: "Perfect for coding projects, web apps, and software development tasks",
      agents: [
        {
          name: "Frontend Developer",
          prompt: "You are a senior frontend developer specializing in React, JavaScript, and modern web technologies. Focus on creating user-friendly interfaces, responsive designs, and efficient frontend code. Provide detailed code examples and explain your architectural decisions."
        },
        {
          name: "Backend Developer", 
          prompt: "You are a senior backend developer specializing in API design, database architecture, and server-side logic. Focus on creating scalable, secure backend systems with proper authentication and data handling. Provide API specifications and database schema suggestions."
        },
        {
          name: "DevOps Engineer",
          prompt: "You are a DevOps engineer focused on deployment, CI/CD, and infrastructure. Provide recommendations for hosting, containerization, automated testing, and deployment strategies. Focus on scalability and reliability."
        },
        {
          name: "QA Engineer",
          prompt: "You are a quality assurance engineer focused on testing strategies, identifying potential bugs, and ensuring code quality. Suggest testing approaches, identify edge cases, and recommend validation methods."
        }
      ]
    },
    research: {
      name: "Research Team",
      description: "Ideal for research projects, data analysis, and academic investigations",
      agents: [
        {
          name: "Primary Researcher",
          prompt: "You are a primary researcher with expertise in academic methodology and data collection. Focus on research design, methodology, and comprehensive analysis. Provide structured findings with proper citations and evidence-based conclusions."
        },
        {
          name: "Data Analyst",
          prompt: "You are a data analyst specializing in statistical analysis and data interpretation. Focus on quantitative analysis, trend identification, and data visualization recommendations. Provide insights based on data patterns and statistical significance."
        },
        {
          name: "Subject Matter Expert",
          prompt: "You are a subject matter expert with deep domain knowledge. Provide specialized insights, industry context, and expert opinions. Focus on practical applications and real-world implications of research findings."
        },
        {
          name: "Research Coordinator",
          prompt: "You are a research coordinator focused on methodology validation and research integrity. Ensure research quality, identify potential biases, and suggest improvements to research approaches."
        }
      ]
    },
    business: {
      name: "Business Strategy Team",
      description: "Great for business planning, market analysis, and strategic decisions",
      agents: [
        {
          name: "Market Analyst",
          prompt: "You are a market research analyst specializing in consumer behavior and market trends. Analyze target demographics, market size, competition, and provide data-driven insights and market positioning recommendations."
        },
        {
          name: "Financial Analyst",
          prompt: "You are a financial analyst focused on business economics and profitability. Analyze pricing strategies, cost structures, profit margins, and financial projections. Provide recommendations on financial viability and ROI."
        },
        {
          name: "Marketing Strategist",
          prompt: "You are a marketing strategist with expertise in brand positioning and campaign development. Create comprehensive marketing strategies, identify key messaging, and suggest promotional channels."
        },
        {
          name: "Operations Manager",
          prompt: "You are an operations manager specializing in business processes and efficiency. Focus on operational scalability, process optimization, and resource management. Provide recommendations for operational excellence."
        }
      ]
    },
    creative: {
      name: "Creative Team",
      description: "Perfect for creative projects, content creation, and design work",
      agents: [
        {
          name: "Creative Director",
          prompt: "You are a creative director with expertise in brand storytelling and creative strategy. Develop compelling narratives, brand concepts, and creative direction. Focus on innovative and engaging creative solutions."
        },
        {
          name: "Visual Designer",
          prompt: "You are a visual designer with expertise in graphic design and visual identity. Create visual concepts, design recommendations, and aesthetic direction. Focus on modern, appealing design principles."
        },
        {
          name: "Content Creator",
          prompt: "You are a content creator specializing in engaging copy and content strategy. Develop compelling content, messaging, and communication strategies. Focus on audience engagement and brand voice."
        },
        {
          name: "UX Designer",
          prompt: "You are a UX designer focused on user experience and customer journey. Design user-centered experiences, identify pain points, and recommend improvements. Focus on usability and accessibility."
        }
      ]
    },
    technical: {
      name: "Technical Analysis Team",
      description: "Ideal for technical problem-solving, system design, and engineering tasks",
      agents: [
        {
          name: "System Architect",
          prompt: "You are a system architect with expertise in large-scale system design. Focus on scalability, reliability, and performance. Provide architectural recommendations and design patterns."
        },
        {
          name: "Security Engineer",
          prompt: "You are a security engineer focused on cybersecurity and system protection. Identify security vulnerabilities, recommend security measures, and ensure compliance with security standards."
        },
        {
          name: "Performance Engineer",
          prompt: "You are a performance engineer specializing in optimization and efficiency. Analyze performance bottlenecks, recommend optimizations, and ensure system scalability."
        },
        {
          name: "Technical Writer",
          prompt: "You are a technical writer focused on documentation and knowledge transfer. Create clear technical documentation, user guides, and ensure technical concepts are well-explained."
        }
      ]
    }
  };
  
  res.json({
    success: true,
    templates: templates
  });
});

/**
 * Agent Configuration Management Endpoints
 */

// Get all agent configurations
app.get('/api/agent-configs', (req, res) => {
  try {
    const configs = getAllAgentConfigs();
    res.json({
      success: true,
      configs: configs
    });
  } catch (error) {
    logger.error('Error getting agent configurations:', error.message);
    res.status(500).json({ error: 'Failed to get agent configurations' });
  }
});

// Get specific agent configuration
app.get('/api/agent-configs/:agentId', (req, res) => {
  try {
    const { agentId } = req.params;
    
    // Validate agent ID
    if (!/^agent-[1-4]$/.test(agentId)) {
      return res.status(400).json({ error: 'Invalid agent ID format' });
    }
    
    const config = getAgentConfig(agentId);
    res.json({
      success: true,
      config: config
    });
  } catch (error) {
    logger.error('Error getting agent configuration:', error.message);
    res.status(500).json({ error: 'Failed to get agent configuration' });
  }
});

// Update agent configuration
app.put('/api/agent-configs/:agentId', (req, res) => {
  try {
    const { agentId } = req.params;
    const newConfig = req.body;
    
    // Validate agent ID
    if (!/^agent-[1-4]$/.test(agentId)) {
      return res.status(400).json({ error: 'Invalid agent ID format' });
    }
    
    // Validate configuration
    const validationErrors = validateAgentConfig(newConfig);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid configuration',
        details: validationErrors 
      });
    }
    
    const success = updateAgentConfig(agentId, newConfig);
    if (success) {
      res.json({
        success: true,
        message: 'Agent configuration updated successfully',
        config: getAgentConfig(agentId)
      });
    } else {
      res.status(500).json({ error: 'Failed to update agent configuration' });
    }
  } catch (error) {
    logger.error('Error updating agent configuration:', error.message);
    res.status(500).json({ error: 'Failed to update agent configuration' });
  }
});

// Reset agent configuration to default
app.post('/api/agent-configs/:agentId/reset', (req, res) => {
  try {
    const { agentId } = req.params;

    // Validate agent ID
    if (!/^agent-[1-4]$/.test(agentId)) {
      return res.status(400).json({ error: 'Invalid agent ID format' });
    }

    const success = resetAgentConfig(agentId);
    if (success) {
      res.json({
        success: true,
        message: 'Agent configuration reset to default',
        config: getAgentConfig(agentId)
      });
    } else {
      res.status(500).json({ error: 'Failed to reset agent configuration' });
    }
  } catch (error) {
    logger.error('Error resetting agent configuration:', error.message);
    res.status(500).json({ error: 'Failed to reset agent configuration' });
  }
});

/**
 * Agent Voting Session
 * Agents propose solutions and vote on the best one
 */
app.post('/voting-session', messageLimiter, async (req, res) => {
  try {
    const {
      problem,
      participants = [], // Array of {agentId, agentName}
      votingStrategy = VOTING_STRATEGY.WEIGHTED,
      conversationId,
      userId
    } = req.body;

    // Validation
    if (!problem) {
      return res.status(400).json({ error: 'Problem statement is required' });
    }

    if (!participants || participants.length < 2) {
      return res.status(400).json({
        error: 'At least 2 agents required for voting'
      });
    }

    logger.info(`Starting voting session with ${participants.length} agents`);
    logger.info(`Strategy: ${votingStrategy}`);

    const finalConversationId = conversationId || `voting-${Date.now()}`;

    // Initialize conversation
    if (!conversations.has(finalConversationId)) {
      conversations.set(finalConversationId, {
        messages: [],
        participants: participants.map(p => p.agentId),
        createdAt: Date.now(),
        lastActivity: Date.now()
      });
    }

    const conversation = conversations.get(finalConversationId);

    // Add user message
    const userMessage = {
      role: 'user',
      content: problem,
      timestamp: new Date().toISOString()
    };
    conversation.messages.push(userMessage);
    conversation.lastActivity = Date.now();

    // Broadcast to WebSocket clients
    broadcastConversationUpdate(finalConversationId, userMessage);

    // PHASE 1: Collect proposals from each agent
    logger.info('Phase 1: Collecting proposals from agents...');

    const proposals = [];

    for (const participant of participants) {
      const { agentId, agentName } = participant;

      logger.info(`Requesting proposal from ${agentName}...`);

      try {
        const agentResponse = await sendToAgent(agentId, problem, userId);

        const proposal = {
          id: `${agentId}-${Date.now()}`,
          agentId,
          agentName,
          content: agentResponse.content,
          timestamp: new Date().toISOString()
        };

        proposals.push(proposal);

        // Add to conversation
        const proposalMessage = {
          role: 'assistant',
          content: `**${agentName} Proposal:**\n\n${agentResponse.content}`,
          agentId,
          timestamp: new Date().toISOString()
        };
        conversation.messages.push(proposalMessage);
        broadcastConversationUpdate(finalConversationId, proposalMessage);

        logger.info(`Received proposal from ${agentName}`);
      } catch (error) {
        logger.error(`Error getting proposal from ${agentName}:`, error);
      }
    }

    if (proposals.length === 0) {
      return res.status(500).json({
        error: 'No proposals received from agents'
      });
    }

    // PHASE 2: Agents vote on proposals
    logger.info('Phase 2: Collecting votes from agents...');

    const votes = [];

    for (const participant of participants) {
      const { agentId, agentName } = participant;

      // Prepare voting prompt
      let votingPrompt = `You are ${agentName}. Review these proposals for the problem:\n\n"${problem}"\n\n`;

      proposals.forEach((proposal, index) => {
        votingPrompt += `\n**Proposal ${index + 1}** (by ${proposal.agentName}):\n${proposal.content}\n`;
      });

      if (votingStrategy === VOTING_STRATEGY.RANKED_CHOICE) {
        votingPrompt += `\nRank ALL proposals from best to worst. Reply with ONLY the proposal numbers separated by commas (e.g., "2,1,3,4").`;
      } else {
        votingPrompt += `\nVote for the BEST proposal. Reply with ONLY the proposal number (1-${proposals.length}).`;
      }

      try {
        const voteResponse = await sendToAgent(agentId, votingPrompt, userId);

        if (votingStrategy === VOTING_STRATEGY.RANKED_CHOICE) {
          // Parse ranked choices
          const rankings = voteResponse.content
            .trim()
            .split(',')
            .map(n => parseInt(n.trim()) - 1)
            .filter(i => i >= 0 && i < proposals.length)
            .map(i => proposals[i].id);

          votes.push({
            agentId,
            agentName,
            rankings
          });

          logger.info(`${agentName} ranked: ${rankings.join(', ')}`);
        } else {
          // Parse single vote
          const voteMatch = voteResponse.content.match(/(\d+)/);
          if (voteMatch) {
            const proposalIndex = parseInt(voteMatch[1]) - 1;

            if (proposalIndex >= 0 && proposalIndex < proposals.length) {
              const selectedProposal = proposals[proposalIndex];

              votes.push({
                proposalId: selectedProposal.id,
                agentId,
                agentName,
                type: 'upvote',
                weight: participant.weight || 1.0
              });

              logger.info(`${agentName} voted for Proposal ${proposalIndex + 1}`);
            }
          }
        }
      } catch (error) {
        logger.error(`Error getting vote from ${agentName}:`, error);
      }
    }

    if (votes.length === 0) {
      return res.status(500).json({
        error: 'No votes received from agents'
      });
    }

    // PHASE 3: Calculate results
    logger.info('Phase 3: Calculating voting results...');

    const results = VotingSystem.execute(votingStrategy, proposals, votes);

    logger.info(`Winner: ${results.winnerProposal ? results.winnerProposal.agentName : 'None'}`);
    logger.info(`Confidence: ${(results.confidence * 100).toFixed(1)}%`);

    // Format results message
    const resultsText = formatVotingResults(results);

    const resultsMessage = {
      role: 'system',
      content: resultsText,
      timestamp: new Date().toISOString()
    };
    conversation.messages.push(resultsMessage);
    broadcastConversationUpdate(finalConversationId, resultsMessage);

    // Send response
    res.json({
      success: true,
      conversationId: finalConversationId,
      proposals,
      votes,
      results,
      winner: results.winnerProposal,
      summary: resultsText
    });
  } catch (error) {
    logger.error('Voting session error:', error);
    res.status(500).json({
      error: 'Voting session failed',
      details: error.message
    });
  }
});

// Start the manager service with Socket.IO support (only if not being imported)
if (require.main === module) {
  server.listen(PORT, () => {
    logger.info(`Manager agent running on port ${PORT} with WebSocket support`);
  });
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// OS/container sends SIGTERM before killing the process.
// We drain in-flight connections before exiting to avoid:
//   - Dropped HTTP responses mid-request
//   - Socket.IO streams cut mid-token
//   - MongoDB writes abandoned mid-operation
const redisClient = require('../../config/redis');
const { disconnectDB } = require('../../config/database');

async function gracefulShutdown(signal) {
  logger.info(`Received ${signal} — starting graceful shutdown`);

  // 1. Stop accepting new HTTP requests
  server.close(() => logger.info('HTTP server closed'));

  // 2. Close Socket.IO (waits for open connections to finish naturally)
  io.close(() => logger.info('Socket.IO closed'));

  try {
    // 3. Disconnect MongoDB
    await disconnectDB();
    logger.info('MongoDB disconnected');

    // 4. Quit Redis if it was initialised
    if (redisClient) {
      await redisClient.quit();
      logger.info('Redis disconnected');
    }
  } catch (err) {
    logger.error('Error during shutdown cleanup:', err.message);
  }

  logger.info('Graceful shutdown complete');
  process.exit(0);
}

// Safety net: force exit after 15 s if draining stalls (e.g. a hung socket)
const forceExitTimer = setTimeout(() => {
  logger.error('Forced shutdown after 15 s timeout — some connections may have been dropped');
  process.exit(1);
}, 15_000);
// Don't let this timer prevent the process from exiting earlier if everything drains cleanly
forceExitTimer.unref();

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

module.exports = { app, server }; 