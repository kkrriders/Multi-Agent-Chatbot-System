/**
 * Logging utility for the multi-agent system
 */
const winston = require('winston');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// Resolve to /app/logs — matches the directory pre-created in the Dockerfile
const logDir = process.env.LOG_DIR || path.join(__dirname, '../../logs');
try {
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
} catch {
  // No write access (e.g. read-only FS). File transports are skipped below.
}

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'mockprep' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    ...(fs.existsSync(logDir) ? [
      new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
      new winston.transports.File({ filename: path.join(logDir, 'combined.log') }),
    ] : []),
  ]
});

// Create a special logger for flagged content
const flaggedLogFile = process.env.FLAGGED_LOG_PATH || path.join(logDir, 'flagged.log');
const flaggedLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'content-moderation' },
  transports: [
    ...(fs.existsSync(logDir) ? [new winston.transports.File({ filename: flaggedLogFile })] : []),
    new winston.transports.Console({ silent: true }),
  ],
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