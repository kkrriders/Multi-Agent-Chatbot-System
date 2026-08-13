'use strict';

// ── Mocks (hoisted before all requires) ─────────────────────────────────────
jest.mock('../../src/config/redis', () => null);
jest.mock('../../src/shared/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../../src/models/Interview', () => ({ exists: jest.fn() }));
jest.mock('../../src/services/sse/broadcaster', () => ({ connect: jest.fn((_req, res) => res.end()) }));

const request = require('supertest');
const User = require('../../src/models/User');
const Interview = require('../../src/models/Interview');
const broadcaster = require('../../src/services/sse/broadcaster');
const { createTestApp } = require('./helpers/app');
const { makeToken, makeMockUser, chainable, USER_ID } = require('./helpers/fixtures');

describe('GET /api/interview/stream/:sessionId — session ownership', () => {
  let app;
  const OTHER_USERS_SESSION_ID = '507f1f77bcf86cd799439099';

  beforeAll(() => {
    app = createTestApp({ mount: [['/api/interview', '../../../src/routes/interview']] });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    User.findById.mockReturnValue(chainable(makeMockUser()));
  });

  test('404s and never connects the SSE stream for a session the requester does not own', async () => {
    Interview.exists.mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/interview/stream/${OTHER_USERS_SESSION_ID}`)
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(404);
    expect(Interview.exists).toHaveBeenCalledWith({ _id: OTHER_USERS_SESSION_ID, userId: USER_ID });
    expect(broadcaster.connect).not.toHaveBeenCalled();
  });

  test('connects the stream once ownership is confirmed', async () => {
    Interview.exists.mockResolvedValue(true);

    await request(app)
      .get(`/api/interview/stream/${OTHER_USERS_SESSION_ID}`)
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(broadcaster.connect).toHaveBeenCalled();
  });
});
