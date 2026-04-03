/**
 * Agent-to-Agent Request Authentication (HMAC-SHA256)
 *
 * Problem: agent ports (3005-3008) are open on localhost with no authentication.
 * Any local process — including a compromised npm dependency — can POST arbitrary
 * content directly to an agent, bypassing user auth and content moderation.
 *
 * Solution: the manager signs every outgoing agent request body with a shared
 * secret. Each agent verifies the signature before processing the message.
 *
 * Security properties:
 *  - Signing uses HMAC-SHA256 (keyed hash — cannot forge without the secret)
 *  - Verification uses crypto.timingSafeEqual (prevents timing-based secret recovery)
 *  - rawBody capture is required in agent-base.js for accurate verification
 */

'use strict';

const crypto = require('crypto');
const { logger } = require('./logger');

const HEADER = 'x-agent-signature';

/**
 * Sign a request body and return the header object to merge into axios headers.
 *
 * @param {object} body   - The request body object (will be JSON-serialised)
 * @param {string} secret - AGENT_SHARED_SECRET from environment
 * @returns {{ 'x-agent-signature': string }}
 */
function signAgentRequest(body, secret) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  const sig = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return { [HEADER]: sig };
}

/**
 * Express middleware — verifies the HMAC signature on incoming agent requests.
 * Attach as middleware on /message and /message/stream routes in agent-base.js.
 *
 * Requires express.json({ verify }) to populate req.rawBody (see agent-base.js).
 *
 * @param {string} secret - AGENT_SHARED_SECRET from environment
 * @returns {import('express').RequestHandler}
 */
function verifyAgentRequest(secret) {
  if (!secret) {
    throw new Error('verifyAgentRequest: secret must not be empty');
  }
  return (req, res, next) => {
    const receivedSig = req.headers[HEADER];
    if (!receivedSig) {
      return res.status(403).json({ error: 'Missing agent signature' });
    }

    const rawBody = req.rawBody;
    if (!rawBody || rawBody.length === 0) {
      return res.status(400).json({ error: 'Empty request body' });
    }

    // Reject non-hex or wrong-length signatures before Buffer.from silently drops invalid chars
    if (!/^[0-9a-f]{64}$/i.test(receivedSig)) {
      logger.warn(`[agentAuth] Malformed signature from ${req.ip}: "${receivedSig.slice(0, 16)}..."`);
      return res.status(403).json({ error: 'Invalid agent signature' });
    }

    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    // Timing-safe comparison prevents secret recovery via response-time analysis
    const received = Buffer.from(receivedSig, 'hex');
    const expected = Buffer.from(expectedSig, 'hex');

    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
      return res.status(403).json({ error: 'Invalid agent signature' });
    }

    next();
  };
}

module.exports = { signAgentRequest, verifyAgentRequest, AGENT_SIG_HEADER: HEADER };
