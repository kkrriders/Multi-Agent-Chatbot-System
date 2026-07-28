'use strict';

const mongoose = require('mongoose');

// No prompt/response text stored here — CV/JD content is PII and must never land in logs.
const aiUsageLogSchema = new mongoose.Schema({
  callSite:     { type: String, required: true, index: true }, // e.g. 'answer-scorer:score'
  tier:         { type: String, enum: ['fast', 'balanced', 'quality'], required: true },
  provider:     { type: String, required: true }, // 'groq' | 'openrouter'
  model:        { type: String, required: true },
  inputTokens:  { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
  latencyMs:    { type: Number, required: true },
  retries:      { type: Number, default: 0 },
  success:      { type: Boolean, required: true },
  errorType:    { type: String, default: null },
  estimatedCostUsd: { type: Number, default: 0 },
}, {
  timestamps: true,
});

aiUsageLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AiUsageLog', aiUsageLogSchema);
