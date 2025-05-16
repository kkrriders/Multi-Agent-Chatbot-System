/**
 * Conversation Viewer for Multi-Agent Chatbot System
 * 
 * This script reads the logs and displays all conversations in a readable format
 */
const fs = require('fs');
const path = require('path');

// Check if logs directory exists
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  console.error('Logs directory not found. No conversations to display.');
  process.exit(1);
}

// Read combined log
const combinedLogPath = path.join(logDir, 'combined.log');
if (!fs.existsSync(combinedLogPath)) {
  console.error('Combined log file not found. No conversations to display.');
  process.exit(1);
}

// Parse logs to extract messages
function parseMessages() {
  try {
    const logContent = fs.readFileSync(combinedLogPath, 'utf8');
    const logLines = logContent.split('\n').filter(line => line.trim());
    
    const messages = [];
    const messagePattern = /"content":"([^"]*)","from":"([^"]*)","metadata":\{[^}]*\},"performative":"([^"]*)","timestamp":"([^"]*)","to":"([^"]*)"/;
    const receivedPattern = /"Received message".*"from":"([^"]*)".*"to":"([^"]*)"/;
    
    // Extract message info from logs
    logLines.forEach(line => {
      const messageMatch = line.match(messagePattern);
      if (messageMatch) {
        messages.push({
          content: messageMatch[1],
          from: messageMatch[2],
          performative: messageMatch[3],
          timestamp: new Date(messageMatch[4]),
          to: messageMatch[5],
          isResponse: line.includes('agentResponse')
        });
      }
      
      // Also check for received message logs
      const receivedMatch = line.match(receivedPattern);
      if (receivedMatch && !messageMatch) {
        const timestamp = line.match(/"timestamp":"([^"]*)"/);
        if (timestamp) {
          messages.push({
            from: receivedMatch[1],
            to: receivedMatch[2],
            timestamp: new Date(timestamp[1]),
            isReceived: true
          });
        }
      }
    });
    
    // Sort by timestamp
    return messages.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error('Error parsing logs:', error.message);
    return [];
  }
}

// Check if a message was flagged
function wasFlagged(message, messages) {
  // Find flagged messages by looking for similar timestamp and content
  return messages.some(m => 
    m.from === message.from && 
    m.to === message.to && 
    Math.abs(m.timestamp - message.timestamp) < 1000 &&
    m.flagged
  );
}

// Group messages into conversations
function groupConversations(messages) {
  const conversations = [];
  let currentConvo = null;
  
  messages.forEach(message => {
    // Start a new conversation if:
    // 1. This is the first message
    // 2. This is a user message and not a continuation
    if (!currentConvo || (message.from === 'user' && !message.isResponse)) {
      if (currentConvo) {
        conversations.push(currentConvo);
      }
      currentConvo = {
        id: conversations.length + 1,
        messages: []
      };
    }
    
    currentConvo.messages.push(message);
  });
  
  if (currentConvo && currentConvo.messages.length > 0) {
    conversations.push(currentConvo);
  }
  
  return conversations;
}

// Display conversations in a readable format
function displayConversations(conversations) {
  if (conversations.length === 0) {
    console.log('No conversations found in logs.');
    return;
  }
  
  console.log(`\n=== Found ${conversations.length} Conversations ===\n`);
  
  conversations.forEach(convo => {
    console.log(`\n----- Conversation #${convo.id} -----\n`);
    
    convo.messages.forEach(msg => {
      if (msg.isReceived && !msg.content) {
        // This is just a received log entry, not a full message
        console.log(`[${msg.timestamp.toLocaleTimeString()}] ${msg.from} → ${msg.to}: Message sent`);
        return;
      }
      
      if (!msg.content) return; // Skip entries without content
      
      const prefix = msg.isResponse ? '↩️' : '';
      const flagged = msg.flagged ? ' ⚠️ FLAGGED' : '';
      
      console.log(`[${msg.timestamp.toLocaleTimeString()}] ${prefix} ${msg.from} → ${msg.to}${flagged}:`);
      console.log(`    "${msg.content}"`);
      console.log();
    });
  });
}

// Main execution
const messages = parseMessages();
const conversations = groupConversations(messages);
displayConversations(conversations);

// Also check the flagged log
const flaggedLogPath = path.join(logDir, 'flagged.log');
if (fs.existsSync(flaggedLogPath)) {
  console.log('\n\n=== Flagged Messages ===\n');
  try {
    const flaggedContent = fs.readFileSync(flaggedLogPath, 'utf8');
    const flaggedMessages = flaggedContent.split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          // Try to extract key information
          const match = line.match(/"content":"([^"]*)","from":"([^"]*).*"to":"([^"]*).*"reason":"([^"]*)"/);
          if (match) {
            return `- ${match[2]} → ${match[3]}: "${match[1]}"\n  Reason: ${match[4]}`;
          }
          return line;
        } catch (e) {
          return line;
        }
      });
    
    if (flaggedMessages.length > 0) {
      console.log(flaggedMessages.join('\n\n'));
    } else {
      console.log('No flagged messages found.');
    }
  } catch (error) {
    console.error('Error reading flagged log:', error.message);
  }
} 