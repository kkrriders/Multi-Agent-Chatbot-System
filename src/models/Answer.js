'use strict';

const mongoose = require('mongoose');

const scoreBreakdownSchema = new mongoose.Schema({
  relevance:  { type: Number, min: 0, max: 100, default: 0 },
  depth:      { type: Number, min: 0, max: 100, default: 0 },
  clarity:    { type: Number, min: 0, max: 100, default: 0 },
  overall:    { type: Number, min: 0, max: 100, default: 0 },
  // How sure the AI grader was in this score (0-1), not a measure of answer quality.
  confidence: { type: Number, min: 0, max: 1, default: null },
  // Content-quality overall before the integrity-score discount was applied.
  // Equal to `overall` when integrityScore is 100 (clean). Kept so the UI can
  // show "content quality was X, discounted to Y" instead of a silent drop.
  rawOverall: { type: Number, min: 0, max: 100, default: null },
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
  tabSwitchCount:       { type: Number, default: 0 }, // tab hidden — switched away or minimized
  tabSwitchSeconds:     { type: Number, default: 0 },
  // Window lost OS focus while the tab stayed visible — the multi-monitor case
  // (another window on a second screen). Tracked separately from tabSwitch*
  // because it's a noisier signal (also fires for URL-bar clicks, OS
  // notifications) and is weighted lower in computeIntegrity() accordingly.
  focusLossCount:       { type: Number, default: 0 },
  focusLossSeconds:     { type: Number, default: 0 },
  timeToFirstKeystroke: { type: Number, default: null }, // seconds from question display
}, { _id: false });

const answerSchema = new mongoose.Schema({
  interviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', required: true, index: true },
  questionId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Question',  required: true },
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User',       required: true, index: true },

  // Idempotency key — client-generated UUID to deduplicate network retries.
  // No default: the sparse unique index below only skips documents where this
  // field is truly absent, not documents where it's explicitly null. A default
  // of null would make every keyless submission collide on the same index entry.
  idempotencyKey: { type: String },

  // Answer content — format depends on question type
  // Schema allows 10k chars; interview.js route enforces a stricter 5k ceiling on inbound requests.
  text:          { type: String, maxlength: 10_000 }, // text / voice / system design explanation
  inputMethod:   { type: String, enum: ['text', 'voice', 'diagram', 'code'], default: 'text' },

  // System design: React Flow canvas state at submission (JSON string)
  diagramSnapshot: { type: String, default: null },

  // Coding: submitted code + execution results
  code:     { type: String, maxlength: 10_000, default: null },
  language: { type: String, maxlength: 30,     default: null },
  testResults: [{
    input:          String,
    expectedOutput: String,
    actualOutput:   String,
    passed:         Boolean,
    hidden:         Boolean,
    executionTimeMs: Number,
    _id: false,
  }],
  codeScore: {
    passed:   { type: Number, default: 0 },
    total:    { type: Number, default: 0 },
    timeMs:   { type: Number, default: null },
    memoryKb: { type: Number, default: null },
    _id: false,
  },

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
    // The candidate's reply to the follow-up/probe/challenge — a sub-answer
    // nested under this Q&A pair. Not a new top-level interview question:
    // doesn't touch Interview.questionIds or the session's question count.
    candidateReply: { type: String, maxlength: 2_000, default: null },
    repliedAt:      { type: Date, default: null },
    // Best-effort — null if scoring failed (AI outage doesn't block saving the reply).
    replyScore:     { type: scoreBreakdownSchema, default: null },
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
// One answer per question per interview — prevents duplicate submissions and race conditions
answerSchema.index({ interviewId: 1, questionId: 1 }, { unique: true });
// Sparse unique index — deduplicates network retries without forcing clients to send a key
answerSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Answer', answerSchema);
