'use strict';

const mongoose = require('mongoose');

const observationSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User',      required: true, index: true },
  interviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', index: true },

  type: {
    type: String,
    enum: ['speech_quality', 'technical_accuracy', 'cv_gap', 'weak_area', 'strong_area'],
    required: true,
    index: true,
  },

  concept:   { type: String, required: true, maxlength: 200, index: true },
  score:     { type: Number, min: 0, max: 100 },

  // Layer 1 compact text (~50 tokens) — pre-built by observation-compiler
  summary:   { type: String, maxlength: 300 },

  // Full payload — only loaded in Layer 3
  data:      { type: mongoose.Schema.Types.Mixed },
}, {
  timestamps: true,
});

// Compound indexes for the 3-layer retrieval queries
observationSchema.index({ userId: 1, type: 1, createdAt: -1 });
observationSchema.index({ userId: 1, concept: 1, createdAt: 1 });
observationSchema.index({ userId: 1, interviewId: 1 });

// Virtual alias for consistent naming
observationSchema.virtual('timestamp').get(function () {
  return this.createdAt;
});

observationSchema.set('toObject', { virtuals: true });
observationSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Observation', observationSchema);
