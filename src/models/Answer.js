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
  fillerWords:        [{ type: String }],
  wordsPerMinute:     { type: Number },
  pronunciationScore: { type: Number, min: 0, max: 100 },
  totalWords:         { type: Number },
  durationSeconds:    { type: Number },
}, { _id: false });

const integritySignalsSchema = new mongoose.Schema({
  pasteCount:           { type: Number, default: 0 },
  pastedChars:          { type: Number, default: 0 },
  typedChars:           { type: Number, default: 0 },
  tabSwitchCount:       { type: Number, default: 0 },
  tabSwitchSeconds:     { type: Number, default: 0 },
  timeToFirstKeystroke: { type: Number, default: null }, // seconds from question display
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

  // Decision agent result — what the interviewer decided after reading this answer
  followUpAction: {
    action:   { type: String, enum: ['follow_up', 'probe_deeper', 'next_question', 'challenge'] },
    reason:   { type: String, maxlength: 300 },
    response: { type: String, maxlength: 500 },
  },

  // Anti-cheat: behavioral signals captured client-side
  integritySignals: { type: integritySignalsSchema, default: null },
  integrityScore:   { type: Number, min: 0, max: 100, default: null },
  integrityFlag:    { type: String, enum: ['CLEAN', 'SUSPICIOUS', 'LIKELY_AI'], default: null },

  // Ordering within the interview
  questionIndex: { type: Number, default: 0 },
}, {
  timestamps: true,
});

answerSchema.index({ interviewId: 1, questionIndex: 1 });

module.exports = mongoose.model('Answer', answerSchema);
