'use strict';

/**
 * Progress tracking routes (Feature #12 + gamification).
 *
 * GET /api/progress/summary           — overall progress summary
 * GET /api/progress/timeline          — session timeline (Layer 2)
 * GET /api/progress/trend/:concept    — score trend for a concept
 * GET /api/progress/streak            — current streak
 * GET /api/progress/achievements      — all earned badges
 * GET /api/progress/leaderboard       — personal session ranking
 */

const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimiter');
const retrieval = require('../services/history/retrieval-service');
const achievements = require('../services/gamification/achievement-service');
const { logger } = require('../shared/logger');

router.use(authenticate, generalLimiter);

router.get('/summary', async (req, res) => {
  try {
    const summary = await retrieval.progressSummary(req.user._id.toString());
    res.json({ success: true, summary });
  } catch (err) {
    logger.error(`[progress/summary] ${err.message}`);
    res.status(500).json({ success: false, error: 'Failed to fetch summary' });
  }
});

router.get('/timeline', async (req, res) => {
  try {
    const timeline = await retrieval.timeline(req.user._id.toString(), { limit: 100 });
    res.json({ success: true, timeline });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch timeline' });
  }
});

router.get('/trend/:concept', async (req, res) => {
  try {
    const concept = req.params.concept.slice(0, 100);
    const trend = await retrieval.conceptTrend(req.user._id.toString(), concept);
    res.json({ success: true, concept, trend });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch trend' });
  }
});

router.get('/streak', async (req, res) => {
  try {
    const streak = await achievements.getCurrentStreak(req.user._id.toString());
    res.json({ success: true, streak });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch streak' });
  }
});

router.get('/achievements', async (req, res) => {
  try {
    const earned = await achievements.getAchievements(req.user._id.toString());
    res.json({ success: true, achievements: earned });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch achievements' });
  }
});

router.get('/leaderboard', async (req, res) => {
  try {
    const board = await achievements.getPersonalLeaderboard(req.user._id.toString());
    res.json({ success: true, leaderboard: board });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
  }
});

module.exports = router;
