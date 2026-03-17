'use strict';

// helpers/app.js must be required before this file so env vars are set.
const jwt = require('jsonwebtoken');

// ── Stable test IDs (valid 24-hex MongoDB ObjectIds) ────────────────────────
const USER_ID     = '507f1f77bcf86cd799439011';
const CONV_ID     = '507f1f77bcf86cd799439012';
const VERSION_ID  = '507f1f77bcf86cd799439013';
const VERSION_ID2 = '507f1f77bcf86cd799439014';

// ── Token helper ─────────────────────────────────────────────────────────────
/** Generate a valid JWT signed with the test secret. */
function makeToken(overrides = {}) {
  return jwt.sign(
    { id: USER_ID, email: 'test@example.com', ...overrides },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// ── Mock object factories ─────────────────────────────────────────────────────

/** Plain user object (no DB). isActive:true by default. */
function makeMockUser(overrides = {}) {
  return {
    _id:        USER_ID,
    fullName:   'Test User',
    email:      'test@example.com',
    isActive:   true,
    createdAt:  new Date('2024-01-01'),
    lastLogin:  new Date('2024-06-01'),
    preferences: { theme: 'system', notifications: true },
    toJSON()   { return { ...this, toJSON: undefined }; },
    ...overrides,
  };
}

/** Mock conversation with jest-fn instance methods. */
function makeMockConversation(overrides = {}) {
  return {
    _id:         CONV_ID,
    userId:      USER_ID,
    title:       'Test Conversation',
    agentType:   'manager',
    status:      'active',
    messages:    [],
    tags:        [],
    summary:     null,
    pdfExports:  [],
    createdAt:   new Date(),
    updatedAt:   new Date(),
    addMessage:  jest.fn().mockResolvedValue(undefined),
    addTags:     jest.fn().mockResolvedValue(undefined),
    removeTags:  jest.fn().mockResolvedValue(undefined),
    save:        jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/** Mock PromptVersion document. */
function makeMockVersion(overrides = {}) {
  return {
    _id:          VERSION_ID,
    agentId:      'agent-1',
    version:      1,
    systemPrompt: 'You are a helpful assistant.',
    description:  'Initial version',
    active:       false,
    createdBy:    USER_ID,
    createdAt:    new Date(),
    updatedAt:    new Date(),
    deleteOne:    jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/**
 * Wrap a value in a thenable that ALSO exposes Mongoose-style chain methods.
 *
 *   await chainable(v)              → v
 *   await chainable(v).select(...)  → v
 *   await chainable(v).lean()       → v
 */
function chainable(value) {
  return Object.assign(Promise.resolve(value), {
    select: jest.fn().mockResolvedValue(value),
    lean:   jest.fn().mockResolvedValue(value),
  });
}

/**
 * Build a mock that supports .sort().select().lean() chaining.
 * Used to mock PromptVersion.find().sort().select().lean().
 */
function sortSelectLean(value) {
  const leanMock   = { lean:   jest.fn().mockResolvedValue(value) };
  const selectMock = { select: jest.fn().mockReturnValue(leanMock) };
  return { sort: jest.fn().mockReturnValue(selectMock) };
}

module.exports = {
  USER_ID, CONV_ID, VERSION_ID, VERSION_ID2,
  makeToken, makeMockUser, makeMockConversation, makeMockVersion,
  chainable, sortSelectLean,
};
