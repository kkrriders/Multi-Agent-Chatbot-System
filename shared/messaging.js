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

  // Performative validation - make case insensitive
  const validPerformatives = Object.values(PERFORMATIVES).map(p => p.toLowerCase());
  if (!validPerformatives.includes(message.performative.toLowerCase())) {
    return {
      isValid: false,
      error: `Invalid performative. Must be one of: ${validPerformatives.join(', ')}`
    };
  }

  return { isValid: true };
}

// Create a structured A2A message
function createMessage(from, to, content, performative, metadata = {}) {
  // Normalize the performative - handle both strings and constants
  let normalizedPerformative;
  
  if (typeof performative === 'string') {
    // Direct string value - ensure it's lowercase for consistency
    normalizedPerformative = performative.toLowerCase();
  } else if (performative && Object.values(PERFORMATIVES).includes(performative)) {
    // It's already a valid performative value
    normalizedPerformative = performative;
  } else {
    // Default to inform if invalid
    console.warn(`Invalid performative '${performative}', defaulting to 'inform'`);
    normalizedPerformative = PERFORMATIVES.INFORM;
  }
  
  // Double-check the performative is valid
  const validPerformatives = Object.values(PERFORMATIVES).map(p => p.toLowerCase());
  if (!validPerformatives.includes(normalizedPerformative.toLowerCase())) {
    console.warn(`Performative '${normalizedPerformative}' not in valid list, using 'inform'`);
    normalizedPerformative = PERFORMATIVES.INFORM;
  }
  
  const message = {
    from,
    to,
    performative: normalizedPerformative,
    content,
    timestamp: new Date().toISOString(),
    metadata
  };

  const validation = validateMessage(message);
  if (!validation.isValid) {
    console.error(`Message validation failed:`, validation.error);
    console.error(`Message:`, message);
    throw new Error(`Invalid message: ${validation.error}`);
  }

  return message;
}

// Create an apology message when content is flagged
function createApologyMessage(from, to, originalContent) {
  return createMessage(
    from,
    to,
    "I apologize, but my previous message contained content that was flagged as potentially inappropriate.",
    PERFORMATIVES.APOLOGIZE,
    { originalRequest: originalContent }
  );
}

module.exports = {
  PERFORMATIVES,
  validateMessage,
  createMessage,
  createApologyMessage
}; 