/**
 * Logging utility for the multi-agent system
 */
const winston = require('winston');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// Create logs directory if it doesn't exist
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'multi-agent-chat' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log') 
    })
  ]
});

// Create a special logger for flagged content
const flaggedContentPath = process.env.FLAGGED_LOG_PATH || 'logs/flagged.log';
const flaggedLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'content-moderation' },
  transports: [
    new winston.transports.File({ 
      filename: path.join(__dirname, '..', flaggedContentPath) 
    })
  ]
});

/**
 * Log a flagged message
 * 
 * @param {Object} message - The flagged message
 * @param {string} reason - Reason for flagging
 */
function logFlaggedContent(message, reason) {
  flaggedLogger.warn({
    flagged: true,
    message,
    reason,
    timestamp: new Date().toISOString()
  });

  // Also log to the main logger
  logger.warn(`FLAGGED CONTENT: ${reason}`, { message });
}

module.exports = {
  logger,
  logFlaggedContent
}; 