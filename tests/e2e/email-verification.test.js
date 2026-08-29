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
  findOne:           jest.fn(),
  findById:          jest.fn(),
  create:            jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));
jest.mock('../../src/services/email/email-service', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendVerificationEmail:  jest.fn().mockResolvedValue(undefined),
}));

const mockRedisClient = { get: jest.fn(), set: jest.fn(), del: jest.fn(), getdel: jest.fn() };
jest.mock('../../src/config/redis', () => mockRedisClient);

const request = require('supertest');
const User = require('../../src/models/User');
const { sendVerificationEmail } = require('../../src/services/email/email-service');
const { createTestApp, ORIGIN } = require('./helpers/app');
const { chainable, makeToken, makeMockUser } = require('./helpers/fixtures');

describe('Email verification', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── POST /api/auth/signup — issues a verification token ───────────────────

  describe('POST /api/auth/signup', () => {
    const validBody = {
      fullName:        'Alice Smith',
      email:           'alice@example.com',
      password:        'password123',
      confirmPassword: 'password123',
    };

    test('201 — stores a hashed verification token in Redis and emails the raw one', async () => {
      User.findOne.mockReturnValue(chainable(null));
      User.create.mockResolvedValue(makeMockUser({ email: 'alice@example.com', emailVerified: false }));

      const res = await request(app)
        .post('/api/auth/signup')
        .set('Origin', ORIGIN)
        .send(validBody);

      expect(res.status).toBe(201);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expect.stringMatching(/^email:verify:[0-9a-f]{64}$/),
        expect.any(String),
        'EX',
        24 * 3600
      );
      expect(sendVerificationEmail).toHaveBeenCalledWith(
        'alice@example.com',
        expect.stringContaining('/verify-email?token=')
      );
    });

    test('201 — signup still succeeds if the email provider fails', async () => {
      User.findOne.mockReturnValue(chainable(null));
      User.create.mockResolvedValue(makeMockUser({ email: 'alice@example.com', emailVerified: false }));
      sendVerificationEmail.mockRejectedValueOnce(new Error('Resend down'));

      const res = await request(app)
        .post('/api/auth/signup')
        .set('Origin', ORIGIN)
        .send(validBody);

      expect(res.status).toBe(201);
    });
  });

  // ── POST /api/auth/verify-email ────────────────────────────────────────────

  describe('POST /api/auth/verify-email', () => {
    test('200 — consumes the token atomically via GETDEL and marks the user verified', async () => {
      mockRedisClient.getdel.mockResolvedValue('user1');
      User.findByIdAndUpdate.mockResolvedValue({ _id: 'user1', email: 'a@b.com', emailVerified: true });

      const res = await request(app)
        .post('/api/auth/verify-email')
        .set('Origin', ORIGIN)
        .send({ token: 'raw-token' });

      expect(res.status).toBe(200);
      expect(mockRedisClient.getdel).toHaveBeenCalledWith(expect.stringMatching(/^email:verify:[0-9a-f]{64}$/));
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user1', { emailVerified: true }, { new: true });
    });

    test('400 — missing token', async () => {
      const res = await request(app)
        .post('/api/auth/verify-email')
        .set('Origin', ORIGIN)
        .send({});

      expect(res.status).toBe(400);
    });

    test('400 — invalid or already-used token', async () => {
      mockRedisClient.getdel.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/verify-email')
        .set('Origin', ORIGIN)
        .send({ token: 'stale-token' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid or has expired/i);
    });
  });

  // ── POST /api/auth/resend-verification ─────────────────────────────────────

  describe('POST /api/auth/resend-verification', () => {
    test('200 — sends a new link for an unverified account', async () => {
      User.findById.mockReturnValue(chainable(makeMockUser({ emailVerified: false })));

      const res = await request(app)
        .post('/api/auth/resend-verification')
        .set('Authorization', `Bearer ${makeToken()}`)
        .set('Origin', ORIGIN)
        .send();

      expect(res.status).toBe(200);
      expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
    });

    test('400 — already verified', async () => {
      User.findById.mockReturnValue(chainable(makeMockUser({ emailVerified: true })));

      const res = await request(app)
        .post('/api/auth/resend-verification')
        .set('Authorization', `Bearer ${makeToken()}`)
        .set('Origin', ORIGIN)
        .send();

      expect(res.status).toBe(400);
      expect(sendVerificationEmail).not.toHaveBeenCalled();
    });

    test('401 — no token provided', async () => {
      const res = await request(app)
        .post('/api/auth/resend-verification')
        .set('Origin', ORIGIN)
        .send();

      expect(res.status).toBe(401);
    });
  });
});
