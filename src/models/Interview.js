'use strict';

const mongoose = require('mongoose');

const scoreSchema = new mongoose.Schema({
  relevance: { type: Number, min: 0, max: 100 },
  depth: { type: Number, min: 0, max: 100 },
  clarity: { type: Number, min: 0, max: 100 },
  overall: { type: Number, min: 0, max: 100 },
}, { _id: false });

const interviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  candidateProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CandidateProfile' },
  mode: {
    type: String,
    enum: ['practice', 'timed', 'full'],
    required: true,
    default: 'practice',
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'completed', 'abandoned'],
    default: 'pending',
    index: true,
  },
  targetRole: { type: String, trim: true, maxlength: 200 },
  jobDescription: { type: String, maxlength: 10_000 },

  // Question IDs used in this session (ordered)
  questionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],

  // Score aggregates (populated on completion)
  overallScore: { type: Number, min: 0, max: 100 },
  categoryScores: {
    technical: scoreSchema,
    behavioral: scoreSchema,
    situational: scoreSchema,
    communication: scoreSchema,
  },

  // Timing
  timeLimitPerQuestion: { type: Number, default: 120 }, // seconds (for timed mode)
  startedAt: { type: Date },
  completedAt: { type: Date },
  durationSeconds: { type: Number },

  // Streak/gamification flag
  countedForStreak: { type: Boolean, default: false },
}, {
  timestamps: true,
});

// Indexes for progress queries
interviewSchema.index({ userId: 1, status: 1, createdAt: -1 });
interviewSchema.index({ userId: 1, completedAt: -1 });

module.exports = mongoose.model('Interview', interviewSchema);
