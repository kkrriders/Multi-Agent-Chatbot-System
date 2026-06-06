'use strict';

const ai = require('../ai/provider-manager');
const { logger } = require('../../shared/logger');

// Groq Whisper hard limit is 25 MB
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Transcribe an audio buffer via Groq whisper-large-v3-turbo.
 *
 * @param {Buffer} audioBuffer
 * @param {string} mimeType — e.g. 'audio/webm', 'audio/ogg', 'audio/mp4'
 * @returns {Promise<string>} plain-text transcript
 */
async function transcribe(audioBuffer, mimeType) {
  if (!Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
    throw new Error('audioBuffer must be a non-empty Buffer');
  }
  if (audioBuffer.length > MAX_BYTES) {
    throw new Error(`Audio exceeds ${MAX_BYTES / 1024 / 1024} MB limit`);
  }

  const { text } = await ai.transcribeAudio(audioBuffer, mimeType);
  logger.debug(`[whisper] transcribed ${audioBuffer.length} bytes → ${text.length} chars`);
  return text.trim();
}

module.exports = { transcribe };
