'use strict';

/**
 * CV upload and profile management routes.
 *
 * POST /api/cv/upload       — upload CV file, parse and save profile
 * GET  /api/cv/profile       — get current candidate profile
 * POST /api/cv/analyze-gap  — analyze skill gaps against a JD
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const os = require('os');

const { authenticate } = require('../middleware/auth');
const { guard } = require('../middleware/injection-guard');
const { extractText } = require('../services/cv/cv-parser');
const { extract: extractSkills } = require('../services/cv/skill-extractor');
const { analyze: analyzeGap } = require('../services/cv/gap-analyzer');
const CandidateProfile = require('../models/CandidateProfile');
const { logger } = require('../shared/logger');

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);
const MAX_FILE_MB = 5;

// Upload endpoint — uses multer
router.post('/upload', authenticate, (req, res, next) => {
  let multer;
  try {
    multer = require('multer');
  } catch {
    return res.status(500).json({ success: false, error: 'File upload not available — run: npm install multer' });
  }

  const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_MIMES.has(file.mimetype)) cb(null, true);
      else cb(new Error('Only PDF, DOCX, and TXT files are allowed'));
    },
  }).single('cv');

  upload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next();
  });
}, async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ success: false, error: 'No file uploaded' });

  try {
    // Extract text
    const cvText = await extractText(file.path, file.mimetype);
    if (!cvText || cvText.trim().length < 50) {
      return res.status(400).json({ success: false, error: 'Could not extract text from CV — ensure it is not a scanned image' });
    }

    // AI extraction
    const extracted = await extractSkills(cvText);

    // Upsert candidate profile
    const profile = await CandidateProfile.findOneAndUpdate(
      { userId: req.user._id },
      {
        userId:     req.user._id,
        name:       extracted.name,
        skills:     extracted.skills,
        experience: extracted.experience,
        education:  extracted.education,
        cvText:     cvText.slice(0, 100_000),
        cvFileName: path.basename(file.originalname || 'cv').slice(0, 255),
        parsedAt:   new Date(),
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({
      success: true,
      profile: {
        id:         profile._id,
        name:       profile.name,
        skills:     profile.skills,
        experience: profile.experience,
        education:  profile.education,
        parsedAt:   profile.parsedAt,
      },
    });
  } catch (err) {
    logger.error(`[cv/upload] ${err.message}`);
    res.status(500).json({ success: false, error: 'CV processing failed. Please try again.' });
  } finally {
    fs.unlink(file.path, () => {}); // clean up temp file
  }
});

// Get current profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const profile = await CandidateProfile.findOne({ userId: req.user._id })
      .select('-cvText -__v')
      .lean();
    if (!profile) return res.status(404).json({ success: false, error: 'No profile found — upload a CV first' });
    res.json({ success: true, profile });
  } catch (err) {
    logger.error(`[cv/profile] ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
});

// Analyze skill gaps
router.post('/analyze-gap',
  authenticate,
  guard(['jobDescription']),
  async (req, res) => {
    try {
      const { jobDescription } = req.body;
      if (!jobDescription || typeof jobDescription !== 'string' || jobDescription.trim().length < 20) {
        return res.status(400).json({ success: false, error: 'jobDescription is required (min 20 chars)' });
      }
      if (jobDescription.length > 10_000) {
        return res.status(400).json({ success: false, error: 'jobDescription too long (max 10,000 chars)' });
      }

      const profile = await CandidateProfile.findOne({ userId: req.user._id }).lean();
      if (!profile) return res.status(404).json({ success: false, error: 'No CV profile found' });

      const gaps = await analyzeGap(profile.skills, jobDescription);

      // Save gaps and JD to profile
      await CandidateProfile.findByIdAndUpdate(profile._id, {
        skillGaps: gaps.missingSkills,
        targetJobDescription: jobDescription.slice(0, 10_000),
      });

      res.json({ success: true, ...gaps });
    } catch (err) {
      logger.error(`[cv/analyze-gap] ${err.message}`);
      res.status(500).json({ success: false, error: 'Gap analysis failed' });
    }
  }
);

module.exports = router;
