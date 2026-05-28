'use strict';

const mongoose = require('mongoose');

const scoreBreakdownSchema = new mongoose.Schema({
  relevance: { type: Number, min: 0, max: 100, default: 0 },
  depth:     { type: Number, min: 0, max: 100, default: 0 },
  clarity:   { type: Number, min: 0, max: 100, default: 0 },
  overall:   { type: Number, min: 0, max: 100, default: 0 },
}, { _id: false });

const speechMetricsSchema = new mongoose.Schema({
  fillerWordCount:    { type: Number, default: 0 },
  fillerWords:        [{ type: String }],       // actual words found
  wordsPerMinute:     { type: Number },
  pronunciationScore: { type: Number, min: 0, max: 100 },
  totalWords:         { type: Number },
  durationSeconds:    { type: Number },
}, { _id: false });

const answerSchema = new mongoose.Schema({
  interviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', required: true, index: true },
  questionId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Question',  required: true },
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User',       required: true, index: true },

  // Answer content
  text:          { type: String, maxlength: 10_000 }, // typed or transcribed
  inputMethod:   { type: String, enum: ['text', 'voice'], default: 'text' },

  // Scores (populated after scoring pipeline completes)
  scores:        { type: scoreBreakdownSchema, default: () => ({}) },
  scored:        { type: Boolean, default: false },

  // Speech analysis (only for voice answers)
  speechMetrics: { type: speechMetricsSchema, default: null },

  // Feedback
  improvementSuggestions: [{ type: String, maxlength: 500 }],
  keywordsMissed:         [{ type: String }],
  keywordsHit:            [{ type: String }],

  // Timing
  timeSpentSeconds: { type: Number },
  submittedAt:      { type: Date, default: Date.now },

  // Ordering within the interview
  questionIndex: { type: Number, default: 0 },
}, {
  timestamps: true,
});

answerSchema.index({ interviewId: 1, questionIndex: 1 });

module.exports = mongoose.model('Answer', answerSchema);
