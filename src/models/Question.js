'use strict';

const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  category: {
    type: String,
    enum: [
      'technical', 'behavioral', 'situational', 'closing', 'intro',
      'system_design', 'coding', 'cs_fundamentals',
    ],
    required: true,
    index: true,
  },
  role: {
    type: String,
    trim: true,
    maxlength: 100,
    index: true,
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
  },
  // Determines the UI renderer and scoring pipeline
  questionFormat: {
    type: String,
    enum: ['text', 'coding', 'system_design'],
    default: 'text',
  },

  // ── Text / interview questions ────────────────────────────────────────────
  expectedKeywords:  [{ type: String, maxlength: 50 }],
  followUpQuestions: [{ type: String, maxlength: 500 }],
  timeLimitSeconds:  { type: Number, default: null },

  // ── CS Fundamentals ───────────────────────────────────────────────────────
  // Subtopic: 'os' | 'networking' | 'databases' | 'algorithms' | 'computer_architecture'
  topic: { type: String, maxlength: 50, default: null },

  // ── System Design ─────────────────────────────────────────────────────────
  // 'blank' = design from scratch, 'fix' = fix broken design, 'improve' = improve existing
  subtype: { type: String, enum: ['blank', 'fix', 'improve', null], default: null },
  // Pre-loaded React Flow diagram JSON (for 'fix' and 'improve' subtypes)
  templateDiagram: { type: String, default: null },
  // What components / patterns a complete answer must demonstrate
  evaluationRubric: [{ type: String, maxlength: 200 }],

  // ── Coding / DSA ──────────────────────────────────────────────────────────
  starterCode:  { type: String, maxlength: 5_000, default: null },
  constraints:  { type: String, maxlength: 500,   default: null },
  testCases: [{
    input:          { type: String, maxlength: 1_000 },
    expectedOutput: { type: String, maxlength: 1_000 },
    hidden:         { type: Boolean, default: false },
  }],

  // ── Metadata ──────────────────────────────────────────────────────────────
  source: {
    type: String,
    enum: ['system', 'jd-generated', 'cv-generated', 'company-tailored'],
    default: 'system',
  },
  interviewId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', default: null },
  interviewerName: { type: String, enum: ['Alex', 'Priya', 'James'], default: null },
  active:          { type: Boolean, default: true, index: true },
}, {
  timestamps: true,
});

questionSchema.index({ category: 1, role: 1, difficulty: 1, active: 1 });
questionSchema.index({ questionFormat: 1, active: 1 });
questionSchema.index({ topic: 1, category: 1, active: 1 });

module.exports = mongoose.model('Question', questionSchema);
