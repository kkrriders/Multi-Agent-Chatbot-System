/**
 * Messaging utilities for agent-to-agent communication
 */

// Valid performatives (speech acts) for agent communication
const PERFORMATIVES = {
  INFORM: 'inform',
  REQUEST: 'request',
  QUERY: 'query',
  RESPOND: 'respond',
  PROPOSE: 'propose',
  ACCEPT: 'accept',
  REJECT: 'reject',
  APOLOGIZE: 'apologize'
};

// Message structure validation
function validateMessage(message) {
  // Basic structure checks
  if (!message.from || !message.to || !message.performative || !message.content) {
    return { 
      isValid: false, 
      error: 'Message must contain from, to, performative, and content fields'
    };
  }

  // Performative validation
  if (!Object.values(PERFORMATIVES).includes(message.performative)) {
    return {
      isValid: false,
      error: `Invalid performative. Must be one of: ${Object.values(PERFORMATIVES).join(', ')}`
    };
  }

  return { isValid: true };
}

// Create a structured A2A message
function createMessage(from, to, performative, content, metadata = {}) {
  const message = {
    from,
    to,
    performative,
    content,
    timestamp: new Date().toISOString(),
    metadata
  };

  const validation = validateMessage(message);
  if (!validation.isValid) {
    throw new Error(`Invalid message: ${validation.error}`);
  }

  return message;
}

// Create an apology message when content is flagged
function createApologyMessage(from, to, originalContent) {
  return createMessage(
    from,
    to,
    PERFORMATIVES.APOLOGIZE,
    "I apologize, but my previous message contained content that was flagged as potentially inappropriate.",
    { originalRequest: originalContent }
  );
}

module.exports = {
  PERFORMATIVES,
  validateMessage,
  createMessage,
  createApologyMessage
}; 