'use strict';

// ── Mocks (hoisted before all requires) ─────────────────────────────────────
jest.mock('../../src/shared/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../src/middleware/auditLog', () => ({
  auditEvent: jest.fn(),
  auditLog: (_req, _res, next) => next(),
}));
jest.mock('../../src/models/User', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  hashPassword: jest.fn().mockResolvedValue('hashed'),
  findByIdAndUpdate: jest.fn(),
}));
jest.mock('../../src/services/email/email-service', () => ({ sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined) }));

const mockRedisClient = { get: jest.fn(), set: jest.fn(), del: jest.fn(), getdel: jest.fn() };
jest.mock('../../src/config/redis', () => mockRedisClient);

const request = require('supertest');
const User = require('../../src/models/User');
const { createTestApp, ORIGIN } = require('./helpers/app');
const { chainable } = require('./helpers/fixtures');

describe('POST /api/auth/reset-password — atomic token consumption', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('200 — consumes the token atomically via GETDEL, not a separate GET+DEL', async () => {
    mockRedisClient.getdel.mockResolvedValue('user1');
    User.findById.mockReturnValue(chainable({ _id: 'user1', email: 'a@b.com' }));
    User.findByIdAndUpdate.mockResolvedValue({ _id: 'user1' });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .set('Origin', ORIGIN)
      .send({ token: 'raw-token', password: 'newpassword1', confirmPassword: 'newpassword1' });

    expect(res.status).toBe(200);
    expect(mockRedisClient.getdel).toHaveBeenCalledTimes(1);
    expect(mockRedisClient.get).not.toHaveBeenCalled();
    expect(mockRedisClient.del).not.toHaveBeenCalled();
  });

  test('400 — a second concurrent request with the same token sees it already consumed', async () => {
    // GETDEL is atomic — only the first caller gets the userId back; a second
    // concurrent request (e.g. an email security scanner prefetching the
    // link) gets null, exactly as if the token never existed.
    mockRedisClient.getdel.mockResolvedValueOnce('user1').mockResolvedValueOnce(null);
    User.findById.mockReturnValue(chainable({ _id: 'user1', email: 'a@b.com' }));
    User.findByIdAndUpdate.mockResolvedValue({ _id: 'user1' });

    const body = { token: 'raw-token', password: 'newpassword1', confirmPassword: 'newpassword1' };
    const [first, second] = await Promise.all([
      request(app).post('/api/auth/reset-password').set('Origin', ORIGIN).send(body),
      request(app).post('/api/auth/reset-password').set('Origin', ORIGIN).send(body),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 400]);
  });

  test('400 — invalid or already-used token', async () => {
    mockRedisClient.getdel.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .set('Origin', ORIGIN)
      .send({ token: 'stale-token', password: 'newpassword1', confirmPassword: 'newpassword1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid or has expired/i);
  });
});
