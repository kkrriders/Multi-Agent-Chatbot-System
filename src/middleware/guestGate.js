'use strict';

const crypto = require('crypto');
const GuestUsage = require('../models/GuestUsage');
const { logger } = require('../shared/logger');

const GUEST_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, matches GuestUsage TTL

const LIMITS = {
  interview: 2,
  practiceQuestion: 5,
};

/**
 * Assigns an anonymous device id (cookie) to unauthenticated requests.
 * Reuses the same httpOnly/secure/sameSite convention as the JWT `token` cookie.
 */
function attachGuestId(req, res, next) {
  const existing = req.cookies && req.cookies.guestId;
  if (existing) {
    req.guestId = existing;
    return next();
  }

  const guestId = crypto.randomUUID();
  res.cookie('guestId', guestId, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: GUEST_COOKIE_MAX_AGE_MS,
  });
  req.guestId = guestId;
  next();
}

/**
 * Caps unauthenticated usage of a feature per guest device.
 * `kindOrFn` is either 'practiceQuestion' or 'interview:<mode>' — or a function
 * `req => kind` when the kind depends on the request body (e.g. interview mode).
 * Authenticated users (req.user set) always pass through unlimited.
 */
function gateGuestUsage(kindOrFn) {
  return async function (req, res, next) {
    if (req.user) return next();

    try {
      const kind = typeof kindOrFn === 'function' ? kindOrFn(req) : kindOrFn;
      const isInterview = kind.startsWith('interview:');
      const path = isInterview
        ? `interviewPreviewCounts.${kind.slice('interview:'.length)}`
        : 'practiceQuestionCount';
      const limit = isInterview ? LIMITS.interview : LIMITS.practiceQuestion;

      let doc = await GuestUsage.findOne({ guestId: req.guestId });
      if (!doc) {
        doc = await GuestUsage.create({ guestId: req.guestId, ip: req.ip });
      }

      const current = isInterview
        ? (doc.interviewPreviewCounts && doc.interviewPreviewCounts[kind.slice('interview:'.length)]) || 0
        : doc.practiceQuestionCount || 0;

      if (current >= limit) {
        return res.status(403).json({
          success: false,
          error: 'GUEST_LIMIT_REACHED',
          message: 'Create a free account to keep practicing.',
        });
      }

      await GuestUsage.updateOne({ _id: doc._id }, { $inc: { [path]: 1 }, $set: { ip: req.ip } });
      next();
    } catch (err) {
      logger.error('[guestGate] error:', err.message);
      next(err);
    }
  };
}

module.exports = { attachGuestId, gateGuestUsage };
