'use strict';

// ── Mocks (hoisted before all requires) ─────────────────────────────────────
jest.mock('../../src/models/User', () => ({ findById: jest.fn(), findOne: jest.fn(), create: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock('../../src/models/Conversation', () => ({ getUserConversations: jest.fn(), getConversationById: jest.fn(), getUserTags: jest.fn(), findByTags: jest.fn(), create: jest.fn(), findOne: jest.fn(), findOneAndUpdate: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock('../../src/models/PromptVersion', () => ({ find: jest.fn(), findById: jest.fn(), create: jest.fn(), nextVersionNumber: jest.fn(), activate: jest.fn() }));
jest.mock('../../src/config/redis', () => null);
jest.mock('../../src/shared/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() } }));
jest.mock('../../src/middleware/auditLog', () => ({ auditLog: (_req, _res, next) => next(), auditEvent: jest.fn() }));
jest.mock('../../src/shared/summarizer', () => ({ summarizeConversation: jest.fn(), SUMMARIZE_THRESHOLD: 20 }));
jest.mock('../../src/shared/agent-config', () => ({ invalidatePromptCache: jest.fn(), getActiveSystemPrompt: jest.fn().mockResolvedValue(null) }));

const request = require('supertest');
const { createTestApp } = require('./helpers/app');

describe('GET /api/health', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  test('200 — returns status ok with uptime and circuit breakers', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
    expect(Array.isArray(res.body.circuitBreakers)).toBe(true);
  });

  test('does not require authentication', async () => {
    // No Authorization header — should still respond 200
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });
});
