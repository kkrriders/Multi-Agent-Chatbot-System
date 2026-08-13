'use strict';

// ── Mocks (hoisted before all requires) ─────────────────────────────────────
jest.mock('../../src/config/redis', () => null);
jest.mock('../../src/shared/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../src/models/Question', () => ({
  find: jest.fn(),
  countDocuments: jest.fn(),
}));

const request = require('supertest');
const Question = require('../../src/models/Question');
const { createTestApp, ORIGIN } = require('./helpers/app');

describe('GET /api/questions — cross-user question isolation', () => {
  let app;

  beforeAll(() => {
    app = createTestApp({ mount: [['/api/questions', '../../../src/routes/questions']] });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Question.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
        }),
      }),
    });
    Question.countDocuments.mockResolvedValue(0);
  });

  test('only browses source:system bank questions — never another user\'s cv/jd/company-tailored questions', async () => {
    const res = await request(app)
      .get('/api/questions')
      .set('Origin', ORIGIN);

    expect(res.status).toBe(200);
    expect(Question.find).toHaveBeenCalledWith(expect.objectContaining({ source: 'system' }));
  });

  test('category/role filters never let a caller opt out of the source:system restriction', async () => {
    await request(app)
      .get('/api/questions?category=technical&role=Backend%20Engineer')
      .set('Origin', ORIGIN);

    expect(Question.find).toHaveBeenCalledWith(expect.objectContaining({
      source: 'system', category: 'technical', role: 'Backend Engineer',
    }));
  });
});
