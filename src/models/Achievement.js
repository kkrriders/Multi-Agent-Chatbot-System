'use strict';

const mongoose = require('mongoose');

// All badge definitions (used for display + unlock logic)
const BADGE_TYPES = {
  first_interview:    { label: 'First Interview',     description: 'Completed your first mock interview' },
  score_80_plus:      { label: 'High Performer',      description: 'Scored 80+ in a session' },
  perfect_score:      { label: 'Perfect Score',       description: 'Scored 100 in any single answer' },
  streak_3:           { label: '3-Day Streak',        description: 'Practiced 3 days in a row' },
  streak_7:           { label: 'Week Warrior',        description: 'Practiced 7 days in a row' },
  streak_30:          { label: 'Monthly Champion',    description: 'Practiced 30 days in a row' },
  ten_sessions:       { label: 'Dedicated Learner',   description: 'Completed 10 interview sessions' },
  full_mock:          { label: 'Full Mock Complete',  description: 'Finished a full mock interview' },
  speech_master:      { label: 'Speech Master',       description: 'Zero filler words in an answer' },
  improvement_10:     { label: 'On The Rise',         description: 'Improved overall score by 10+ points' },
};

const achievementSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type:      { type: String, enum: Object.keys(BADGE_TYPES), required: true },
  awardedAt: { type: Date, default: Date.now },
  metadata:  { type: mongoose.Schema.Types.Mixed }, // e.g. { score: 95, interviewId: '...' }
}, {
  timestamps: false,
});

// Each badge type awarded only once per user
achievementSchema.index({ userId: 1, type: 1 }, { unique: true });

achievementSchema.virtual('badge').get(function () {
  return BADGE_TYPES[this.type] || { label: this.type, description: '' };
});

achievementSchema.set('toObject', { virtuals: true });
achievementSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Achievement', achievementSchema);
module.exports.BADGE_TYPES = BADGE_TYPES;
