'use strict';

const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  category: {
    type: String,
    enum: ['technical', 'behavioral', 'situational', 'closing', 'intro'],
    required: true,
    index: true,
  },
  role: {
    type: String,
    trim: true,
    maxlength: 100,
    index: true,
    // e.g. 'Frontend Dev', 'Data Scientist', 'Backend Dev', 'Product Manager', 'General'
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
  },
  // Keywords that a strong answer should contain (used by scorer)
  expectedKeywords: [{ type: String, maxlength: 50 }],
  // Follow-up questions triggered by specific answer patterns
  followUpQuestions: [{ type: String, maxlength: 500 }],
  // Time limit override for timed mode (null = use interview default)
  timeLimitSeconds: { type: Number, default: null },
  source: {
    type: String,
    enum: ['system', 'jd-generated', 'cv-generated', 'company-tailored'],
    default: 'system',
  },
  // If generated, which interview session created it
  interviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', default: null },
  // Panel mode: which interviewer persona asks this question
  interviewerName: { type: String, enum: ['Alex', 'Priya', 'James'], default: null },

  active: { type: Boolean, default: true, index: true },
}, {
  timestamps: true,
});

questionSchema.index({ category: 1, role: 1, difficulty: 1, active: 1 });

module.exports = mongoose.model('Question', questionSchema);
