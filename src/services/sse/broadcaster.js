'use strict';

/**
 * SSE Broadcaster for real-time interview events.
 *
 * Complements Socket.IO (used for chat). SSE is used for uni-directional
 * server-push events during an interview session — scores, speech analysis,
 * timer ticks, and feedback chunks.
 *
 * Usage:
 *   // In Express setup:
 *   app.get('/api/interview/stream/:sessionId', authenticate, broadcaster.connect);
 *
 *   // In any service:
 *   broadcaster.emit(sessionId, 'score-update', { questionId, scores });
 *   broadcaster.emit(sessionId, 'speech-event', { fillerWords, pace });
 *   broadcaster.emit(sessionId, 'timer-tick', { remaining });
 */

const { logger } = require('../../shared/logger');

// Map<sessionId, Set<Response>>
const clients = new Map();

const HEARTBEAT_MS = 25_000;

/**
 * Express route handler — registers a client for SSE.
 * The connection stays open until the client disconnects or the session ends.
 */
function connect(req, res) {
  const { sessionId } = req.params;
  if (!sessionId || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    return res.status(400).json({ error: 'Invalid sessionId' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Register client
  if (!clients.has(sessionId)) clients.set(sessionId, new Set());
  clients.get(sessionId).add(res);

  // Heartbeat to keep the connection alive through proxies
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, HEARTBEAT_MS);

  // Send initial connected event
  _send(res, 'connected', { sessionId, timestamp: Date.now() });

  req.on('close', () => {
    clearInterval(heartbeat);
    const set = clients.get(sessionId);
    if (set) {
      set.delete(res);
      if (set.size === 0) clients.delete(sessionId);
    }
    logger.debug(`[sse] client disconnected from session ${sessionId}`);
  });
}

/**
 * Emit an event to all clients subscribed to a session.
 * @param {string} sessionId
 * @param {string} event  - event name (e.g. 'score-update', 'speech-event')
 * @param {object} data
 */
function emit(sessionId, event, data) {
  const set = clients.get(sessionId);
  if (!set || set.size === 0) return;

  const dead = [];
  for (const res of set) {
    try {
      _send(res, event, data);
    } catch {
      dead.push(res);
    }
  }
  dead.forEach(r => set.delete(r));
}

/**
 * Close all connections for a session (call when interview ends).
 * @param {string} sessionId
 */
function close(sessionId) {
  const set = clients.get(sessionId);
  if (!set) return;
  for (const res of set) {
    try {
      _send(res, 'session-ended', { sessionId });
      res.end();
    } catch { /* already closed */ }
  }
  clients.delete(sessionId);
  logger.debug(`[sse] closed all connections for session ${sessionId}`);
}

function _send(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/** How many clients are connected to a session */
function clientCount(sessionId) {
  return clients.get(sessionId)?.size ?? 0;
}

module.exports = { connect, emit, close, clientCount };
