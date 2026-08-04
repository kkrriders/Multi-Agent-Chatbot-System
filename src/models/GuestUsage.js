'use strict';

const mongoose = require('mongoose');

const INTERVIEW_MODES = ['practice', 'timed', 'full', 'panel'];

const guestUsageSchema = new mongoose.Schema({
  guestId: { type: String, required: true, unique: true },
  ip:      { type: String },
  interviewPreviewCounts: {
    type: Object.fromEntries(INTERVIEW_MODES.map(m => [m, { type: Number, default: 0 }])),
    default: () => ({}),
  },
  practiceQuestionCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 }, // 30-day TTL
}, {
  timestamps: false,
});

module.exports = mongoose.model('GuestUsage', guestUsageSchema);
