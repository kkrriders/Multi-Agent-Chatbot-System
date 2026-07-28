'use strict';

/**
 * Admin routes.
 *
 * GET /api/admin/ai-usage — AI call cost/latency/failure summary (admin only)
 */

const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimiter');
const AiUsageLog = require('../models/AiUsageLog');

function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
}

// GET /api/admin/ai-usage?hours=24
router.get('/ai-usage', authenticate, requireAdmin, generalLimiter, async (req, res) => {
  try {
    const hours = Math.min(Number(req.query.hours) || 24, 24 * 30);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [overall, byCallSite] = await Promise.all([
      AiUsageLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          successCalls: { $sum: { $cond: ['$success', 1, 0] } },
          totalRetries: { $sum: '$retries' },
          totalInputTokens: { $sum: '$inputTokens' },
          totalOutputTokens: { $sum: '$outputTokens' },
          totalCostUsd: { $sum: '$estimatedCostUsd' },
          avgLatencyMs: { $avg: '$latencyMs' },
        } },
      ]),
      AiUsageLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: {
          _id: '$callSite',
          calls: { $sum: 1 },
          failures: { $sum: { $cond: ['$success', 0, 1] } },
          avgLatencyMs: { $avg: '$latencyMs' },
          totalTokens: { $sum: { $add: ['$inputTokens', '$outputTokens'] } },
        } },
        { $sort: { calls: -1 } },
      ]),
    ]);

    const summary = overall[0] || {
      totalCalls: 0, successCalls: 0, totalRetries: 0,
      totalInputTokens: 0, totalOutputTokens: 0, totalCostUsd: 0, avgLatencyMs: 0,
    };

    res.json({
      success: true,
      windowHours: hours,
      totalCalls: summary.totalCalls,
      successRate: summary.totalCalls > 0 ? Math.round((summary.successCalls / summary.totalCalls) * 1000) / 10 : null,
      totalRetries: summary.totalRetries,
      totalInputTokens: summary.totalInputTokens,
      totalOutputTokens: summary.totalOutputTokens,
      estimatedCostUsd: Math.round(summary.totalCostUsd * 10000) / 10000,
      avgLatencyMs: Math.round(summary.avgLatencyMs || 0),
      byCallSite: byCallSite.map(c => ({
        callSite: c._id,
        calls: c.calls,
        failures: c.failures,
        avgLatencyMs: Math.round(c.avgLatencyMs || 0),
        totalTokens: c.totalTokens,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load AI usage summary' });
  }
});

module.exports = router;
