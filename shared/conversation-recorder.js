/**
 * Conversation Recorder
 * 
 * Records all agent conversations to a text file
 */
const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');

// Define the recording file path
const recordingsDir = path.join(__dirname, '../recordings');
const getRecordingFilePath = () => {
  // Create a new recording file for each day
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(recordingsDir, `conversation-${date}.txt`);
};

/**
 * Initialize the recorder
 */
function initializeRecorder() {
  // Create recordings directory if it doesn't exist
  if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
    logger.info('Created recordings directory');
  }
}

/**
 * Record a message to the conversation file
 * 
 * @param {Object} message - The message to record
 * @param {Object} moderationResult - Optional moderation result
 */
function recordMessage(message, moderationResult = null) {
  try {
    // Initialize if needed
    initializeRecorder();
    
    const filePath = getRecordingFilePath();
    const time = new Date().toLocaleTimeString();
    
    // Format the message
    let entry = `[${time}] ${message.from} → ${message.to} (${message.performative}):\n`;
    entry += `"${message.content}"\n`;
    
    // Add moderation info if available
    if (moderationResult && moderationResult.flagged) {
      entry += `WARNING: Message flagged. Reason: ${moderationResult.reason}\n`;
      
      if (moderationResult.warningCount) {
        entry += `Agent warning count: ${moderationResult.warningCount}\n`;
        
        if (moderationResult.agentShutDown) {
          entry += `AGENT SHUTDOWN: ${message.from} has exceeded maximum warnings and has been shut down.\n`;
        }
      }
    }
    
    entry += '\n'; // Add blank line between entries
    
    // Append to file
    fs.appendFileSync(filePath, entry);
  } catch (error) {
    logger.error('Error recording message:', error.message);
  }
}

module.exports = {
  recordMessage
}; 