'use strict';

// ── Mocks (hoisted before all requires) ─────────────────────────────────────
jest.mock('../../src/config/redis', () => null);
jest.mock('../../src/shared/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../src/models/Question', () => ({
  findOne: jest.fn(),
}));
jest.mock('../../src/models/GuestUsage', () => ({
  findOne:   jest.fn(),
  create:    jest.fn(),
  updateOne: jest.fn(),
}));
jest.mock('../../src/services/ai/provider-manager', () => ({
  generateJsonWithEscalation: jest.fn(),
  generateJson: jest.fn(),
}));
jest.mock('../../src/middleware/injection-guard', () => ({ assertSafe: jest.fn() }));

const request = require('supertest');
const Question    = require('../../src/models/Question');
const GuestUsage   = require('../../src/models/GuestUsage');
const ai           = require('../../src/services/ai/provider-manager');
const { createTestApp, ORIGIN } = require('./helpers/app');

describe('POST /api/practice/evaluate — guest gating', () => {
  let app;

  beforeAll(() => {
    app = createTestApp({ mount: [['/api/practice', '../../../src/routes/practice']] });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // source:'system' only — Question.findOne(), not findById(), per the
    // cross-user-leak fix in practice.js.
    Question.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: 'q1', text: 'Reverse a linked list', expectedKeywords: ['pointer'], constraints: 'O(n)', source: 'system',
      }),
    });
    ai.generateJsonWithEscalation.mockResolvedValue({
      data: { score: 80, verdict: 'correct', feedback: 'Good job', strengths: [], issues: [], approachUsed: 'iterative', confidence: 0.9 },
    });
  });

  test('sets a guestId cookie on the first anonymous request', async () => {
    GuestUsage.findOne.mockResolvedValue(null);
    GuestUsage.create.mockResolvedValue({ _id: 'g1', practiceQuestionCount: 0 });

    const res = await request(app)
      .post('/api/practice/evaluate')
      .set('Origin', ORIGIN)
      .send({ type: 'coding', questionId: '507f1f77bcf86cd799439099', code: 'function solve() { return 1 }', language: 'javascript' });

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'].some(c => c.startsWith('guestId='))).toBe(true);
  });

  test('allows up to 5 combined guest evaluations, then blocks the 6th with GUEST_LIMIT_REACHED', async () => {
    const agent = request.agent(app); // persists cookies across requests, like a browser

    for (let i = 0; i < 5; i++) {
      GuestUsage.findOne.mockResolvedValueOnce(i === 0 ? null : { _id: 'g1', practiceQuestionCount: i });
      if (i === 0) GuestUsage.create.mockResolvedValueOnce({ _id: 'g1', practiceQuestionCount: 0 });

      const res = await agent
        .post('/api/practice/evaluate')
        .set('Origin', ORIGIN)
        .send({ type: 'coding', questionId: '507f1f77bcf86cd799439099', code: 'function solve() { return 1 }', language: 'javascript' });

      expect(res.status).toBe(200);
    }

    GuestUsage.findOne.mockResolvedValueOnce({ _id: 'g1', practiceQuestionCount: 5 });
    const blocked = await agent
      .post('/api/practice/evaluate')
      .set('Origin', ORIGIN)
      .send({ type: 'coding', questionId: '507f1f77bcf86cd799439099', code: 'function solve() { return 1 }', language: 'javascript' });

    expect(blocked.status).toBe(403);
    expect(blocked.body).toMatchObject({ success: false, error: 'GUEST_LIMIT_REACHED' });
  });
});
