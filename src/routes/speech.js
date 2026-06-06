'use strict';

const express  = require('express');
const multer   = require('multer');
const { authenticate }   = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimiter');
const { transcribe }     = require('../services/speech/whisper-transcriber');
const { logger }         = require('../shared/logger');

const router = express.Router();

const ALLOWED_MIME = new Set([
  'audio/webm', 'audio/ogg', 'audio/mp4',
  'audio/mpeg', 'audio/wav', 'audio/x-wav',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // Strip codec suffix (e.g. 'audio/webm;codecs=opus' → 'audio/webm')
    const base = file.mimetype.split(';')[0].trim();
    cb(null, ALLOWED_MIME.has(base));
  },
});

/**
 * POST /api/speech/transcribe
 * Body: multipart/form-data — field "audio" containing the recorded blob.
 * Returns: { success: true, text: string }
 */
router.post(
  '/transcribe',
  authenticate,
  generalLimiter,
  upload.single('audio'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No audio file provided or unsupported format' });
    }
    try {
      const mimeType = req.file.mimetype.split(';')[0].trim();
      const text = await transcribe(req.file.buffer, mimeType);
      res.json({ success: true, text });
    } catch (err) {
      logger.error(`[speech/transcribe] userId=${req.user?.id}: ${err.message}`);
      res.status(500).json({ success: false, error: 'Transcription failed' });
    }
  }
);

module.exports = router;
