'use strict';

/**
 * Question bank management routes (Feature #19-20).
 *
 * GET    /api/questions             — list questions (filter by role/category)
 * POST   /api/questions             — create question (admin only)
 * PUT    /api/questions/:id         — update question (admin only)
 * DELETE /api/questions/:id         — deactivate question (admin only)
 * POST   /api/questions/from-jd     — generate questions from a job description
 */

const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const { generalLimiter, messageLimiter } = require('../middleware/rateLimiter');
const { guard } = require('../middleware/injection-guard');
const Question = require('../models/Question');
const questionGenerator = require('../services/interview/question-generator');
const CandidateProfile = require('../models/CandidateProfile');
const { logger } = require('../shared/logger');

const VALID_CATEGORIES = ['technical', 'behavioral', 'situational', 'closing', 'intro', 'coding', 'system_design', 'cs_fundamentals'];
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'];

function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
}

// List/filter questions
router.get('/', authenticate, generalLimiter, async (req, res) => {
  try {
    const { role, category, difficulty, limit = '20', offset = '0' } = req.query;
    const filter = { active: true };
    if (role)       filter.role = role.slice(0, 100);
    if (category && VALID_CATEGORIES.includes(category)) filter.category = category;
    if (difficulty && VALID_DIFFICULTIES.includes(difficulty)) filter.difficulty = difficulty;

    const [questions, total] = await Promise.all([
      Question.find(filter)
        .sort({ createdAt: -1 })
        .skip(Number(offset) || 0)
        .limit(Math.min(Number(limit) || 20, 100))
        .lean(),
      Question.countDocuments(filter),
    ]);

    res.json({
      success: true,
      questions: questions.map(q => ({ ...q, id: q._id })),
      total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (err) {
    logger.error(`[questions/list] ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to fetch questions' });
  }
});

// Create question (admin)
router.post('/', authenticate, requireAdmin, messageLimiter, async (req, res) => {
  try {
    const { text, category, role, difficulty, expectedKeywords, followUpQuestions, timeLimitSeconds } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length < 10) {
      return res.status(400).json({ success: false, error: 'text is required (min 10 chars)' });
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }

    const question = await Question.create({
      text:              text.trim().slice(0, 2000),
      category,
      role:              role ? String(role).slice(0, 100) : 'General',
      difficulty:        VALID_DIFFICULTIES.includes(difficulty) ? difficulty : 'medium',
      expectedKeywords:  Array.isArray(expectedKeywords) ? expectedKeywords.slice(0, 20) : [],
      followUpQuestions: Array.isArray(followUpQuestions) ? followUpQuestions.slice(0, 3) : [],
      timeLimitSeconds:  timeLimitSeconds ? Number(timeLimitSeconds) : null,
      source:            'system',
    });

    res.status(201).json({ success: true, question });
  } catch (err) {
    logger.error(`[questions/create] ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to create question' });
  }
});

// Update question (admin)
router.put('/:id', authenticate, requireAdmin, messageLimiter, async (req, res) => {
  try {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid question id' });
    }
    const { text, category, role, difficulty, expectedKeywords, followUpQuestions, timeLimitSeconds, active } = req.body;
    const updates = {};
    if (text)              updates.text = String(text).slice(0, 2000);
    if (category && VALID_CATEGORIES.includes(category)) updates.category = category;
    if (role)              updates.role = String(role).slice(0, 100);
    if (difficulty && VALID_DIFFICULTIES.includes(difficulty)) updates.difficulty = difficulty;
    if (Array.isArray(expectedKeywords)) updates.expectedKeywords = expectedKeywords.slice(0, 20);
    if (Array.isArray(followUpQuestions)) updates.followUpQuestions = followUpQuestions.slice(0, 3);
    if (timeLimitSeconds !== undefined) updates.timeLimitSeconds = timeLimitSeconds ? Number(timeLimitSeconds) : null;
    if (typeof active === 'boolean') updates.active = active;

    const question = await Question.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!question) return res.status(404).json({ success: false, error: 'Question not found' });
    res.json({ success: true, question });
  } catch (err) {
    logger.error(`[questions/update] ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to update question' });
  }
});

// Deactivate question (admin)
router.delete('/:id', authenticate, requireAdmin, messageLimiter, async (req, res) => {
  try {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid question id' });
    }
    await Question.findByIdAndUpdate(req.params.id, { active: false });
    res.json({ success: true, message: 'Question deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to deactivate question' });
  }
});

// Generate questions from JD
router.post('/from-jd',
  authenticate,
  messageLimiter,
  guard(['jobDescription']),
  async (req, res) => {
    try {
      const { jobDescription, targetRole, mode = 'practice' } = req.body;

      if (!jobDescription || typeof jobDescription !== 'string' || jobDescription.trim().length < 50) {
        return res.status(400).json({ success: false, error: 'jobDescription is required (min 50 chars)' });
      }
      if (jobDescription.length > 10_000) {
        return res.status(400).json({ success: false, error: 'jobDescription too long' });
      }

      const profile = await CandidateProfile.findOne({ userId: req.user._id }).lean();
      const questions = await questionGenerator.generate({
        targetRole: targetRole || profile?.targetRole || 'Software Engineer',
        mode,
        skills:     profile?.skills || [],
        jobDescription,
      });

      res.json({
        success: true,
        questions: questions.map(q => ({
          id:         q._id,
          text:       q.text,
          category:   q.category,
          difficulty: q.difficulty,
        })),
      });
    } catch (err) {
      logger.error(`[questions/from-jd] ${err.message}`);
      res.status(500).json({ success: false, error: 'Question generation failed' });
    }
  }
);

module.exports = router;
