'use strict';

const mongoose = require('mongoose');

const experienceSchema = new mongoose.Schema({
  company:     { type: String, maxlength: 200 },
  role:        { type: String, maxlength: 200 },
  duration:    { type: String, maxlength: 100 }, // e.g. "2 years"
  description: { type: String, maxlength: 1000 },
}, { _id: false });

const educationSchema = new mongoose.Schema({
  institution: { type: String, maxlength: 200 },
  degree:      { type: String, maxlength: 200 },
  field:       { type: String, maxlength: 200 },
  year:        { type: String, maxlength: 10 },
}, { _id: false });

const candidateProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // one profile per user
    index: true,
  },

  // Parsed from CV
  name:       { type: String, trim: true, maxlength: 200 },
  skills:     [{ type: String, maxlength: 100 }],
  experience: [experienceSchema],
  education:  [educationSchema],

  // Raw CV content (never logged, tagged private)
  cvText:    { type: String, maxlength: 100_000 },
  cvFileName:{ type: String, maxlength: 255 },

  // Target context
  targetRole:        { type: String, trim: true, maxlength: 200 },
  targetJobDescription: { type: String, maxlength: 10_000 },

  // Computed by gap analyzer
  skillGaps: [{ type: String, maxlength: 100 }],

  // Parse metadata
  parsedAt:  { type: Date },
  parseVersion: { type: Number, default: 1 },
}, {
  timestamps: true,
});

module.exports = mongoose.model('CandidateProfile', candidateProfileSchema);
