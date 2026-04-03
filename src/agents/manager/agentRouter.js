'use strict';

/**
 * Agent Router
 *
 * Encapsulates:
 *   - AGENT_ENDPOINTS  — map of agentId → HTTP URL
 *   - circuitBreakers  — one CircuitBreaker per agent
 *   - routeMessageToAgent()  — sends a message to a single agent with retry + circuit breaker
 *   - consultDualAgents()    — parallel dual-agent consult for low-confidence routing
 *
 * The Socket.IO `io` instance must be injected at startup via `setIo(ioInstance)`.
 * This avoids circular imports between manager/index.js and agentRouter.js.
 */

const axios = require('axios');
const { CircuitBreaker, CircuitOpenError } = require('../../shared/circuitBreaker');
const { withRetry } = require('../../shared/retry');
const { logger } = require('../../shared/logger');
const { signAgentRequest } = require('../../shared/agentAuth');
const { agentMetrics, wsMetrics } = require('../../monitoring/metrics');

// ── Agent endpoints ───────────────────────────────────────────────────────────

const AGENT_ENDPOINTS = {
  'agent-1': `${process.env.AGENT_1_URL || `http://localhost:${process.env.AGENT_1_PORT || 3005}`}/message`,
  'agent-2': `${process.env.AGENT_2_URL || `http://localhost:${process.env.AGENT_2_PORT || 3006}`}/message`,
  'agent-3': `${process.env.AGENT_3_URL || `http://localhost:${process.env.AGENT_3_PORT || 3007}`}/message`,
  'agent-4': `${process.env.AGENT_4_URL || `http://localhost:${process.env.AGENT_4_PORT || 3008}`}/message`,
};

// ── Circuit breakers ──────────────────────────────────────────────────────────

const circuitBreakers = {};
for (const agentId of Object.keys(AGENT_ENDPOINTS)) {
  const cb = new CircuitBreaker(agentId, { failureThreshold: 3, recoveryTimeoutMs: 30_000 });
  cb.on('stateChange', ({ name, to }) => {
    agentMetrics.setCircuitState(name, to);
    logger.warn(`Circuit breaker [${name}]: → ${to}`);
  });
  agentMetrics.setCircuitState(agentId, 'CLOSED');
  circuitBreakers[agentId] = cb;
}

// ── Socket.IO injection ───────────────────────────────────────────────────────

let _io = null;

/**
 * Provide the Socket.IO server instance.
 * Must be called from manager/index.js after `io` is created.
 */
function setIo(ioInstance) {
  _io = ioInstance;
}

// ── routeMessageToAgent ───────────────────────────────────────────────────────

/**
 * Route message to an agent with conversation history.
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
    // Pre-serialize so the bytes signed exactly match the bytes axios sends.
    // signAgentRequest handles string input without double-serializing.
    const serializedBody = JSON.stringify(message);
    const response = await cb.execute(() =>
      withRetry(
        () => axios.post(endpoint, serializedBody, {
          timeout: 60_000,
          headers: {
            'Content-Type': 'application/json',
            ...signAgentRequest(serializedBody, process.env.AGENT_SHARED_SECRET),
          },
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

// ── consultDualAgents ─────────────────────────────────────────────────────────

/**
 * Consult two agents in parallel and return the response with higher confidence.
 * Used when routing confidence is below the LOW_CONFIDENCE_THRESHOLD.
 *
 * For requests with a conversationId the winning response is emitted as
 * stream-start + stream-end Socket.IO events so the frontend renders it
 * identically to a normally-streamed response.
 *
 * @param {string}  primaryId       — first-choice agentId
 * @param {string}  secondaryId     — fallback agentId
 * @param {Object}  baseMessage     — message template (will be cloned per agent)
 * @param {string|null} conversationId
 * @returns {Promise<{ content: string, agentId: string, messageId: string, confidence: number }>}
 */
async function consultDualAgents(primaryId, secondaryId, baseMessage, conversationId) {
  const primaryMsg   = { ...baseMessage, to: primaryId };
  const secondaryMsg = { ...baseMessage, to: secondaryId };

  const [primarySettled, secondarySettled] = await Promise.allSettled([
    routeMessageToAgent(primaryMsg),
    routeMessageToAgent(secondaryMsg),
  ]);

  const primary   = primarySettled.status   === 'fulfilled' ? primarySettled.value   : null;
  const secondary = secondarySettled.status === 'fulfilled' ? secondarySettled.value : null;

  if (!primary && !secondary) {
    throw new Error('Both agents failed during low-confidence fallback');
  }

  const primaryConf   = primary   ? (primary.confidence   ?? 50) : -1;
  const secondaryConf = secondary ? (secondary.confidence ?? 50) : -1;

  const winner   = secondaryConf > primaryConf ? secondary   : (primary || secondary);
  const winnerId = secondaryConf > primaryConf ? secondaryId : primaryId;

  const content   = winner.content || '';
  const messageId = winner.id || `fallback-${Date.now()}`;

  if (conversationId && _io) {
    _io.to(conversationId).emit('stream-start', {
      messageId, agentId: winnerId, conversationId, timestamp: Date.now(),
    });
    _io.to(conversationId).emit('stream-end', {
      messageId,
      agentId:        winnerId,
      content,
      confidence:     winner.confidence,
      conversationId,
      timestamp:      Date.now(),
      type:           'fallback-response',
      fallbackUsed:   true,
      originalAgent:  primaryId,
    });
  }

  logger.info(
    `[consultDualAgents] winner=${winnerId} (conf=${winner.confidence ?? '?'}) ` +
    `over ${winnerId === primaryId ? secondaryId : primaryId} (conf=${Math.min(primaryConf, secondaryConf)})`
  );

  return { content, agentId: winnerId, messageId, confidence: winner.confidence ?? 50 };
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = { AGENT_ENDPOINTS, circuitBreakers, routeMessageToAgent, consultDualAgents, setIo };
