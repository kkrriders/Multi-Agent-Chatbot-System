'use strict';

// ── Mocks (hoisted before all requires) ─────────────────────────────────────
// Redis is a working mock for blacklist + password-reset tests
const mockRedis = {
  set:    jest.fn().mockResolvedValue('OK'),
  exists: jest.fn().mockResolvedValue(0),
  get:    jest.fn().mockResolvedValue(null),
  del:    jest.fn().mockResolvedValue(1),
};

jest.mock('../../src/config/redis', () => mockRedis);
jest.mock('../../src/models/User', () => ({
  findOne:           jest.fn(),
  findById:          jest.fn(),
  create:            jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));
jest.mock('../../src/models/Conversation', () => ({}));
jest.mock('../../src/models/PromptVersion', () => ({}));
jest.mock('../../src/shared/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../src/middleware/auditLog', () => ({
  auditLog:   (_req, _res, next) => next(),
  auditEvent: jest.fn(),
}));
jest.mock('../../src/shared/summarizer', () => ({
  summarizeConversation: jest.fn(),
  SUMMARIZE_THRESHOLD:   20,
}));
jest.mock('../../src/shared/agent-config', () => ({
  invalidatePromptCache: jest.fn(),
  getActiveSystemPrompt: jest.fn().mockResolvedValue(null),
}));

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const User    = require('../../src/models/User');
const { createTestApp, ORIGIN } = require('./helpers/app');
const { makeMockUser, chainable } = require('./helpers/fixtures');

// ── Token helpers ─────────────────────────────────────────────────────────────

const USER_ID = '507f1f77bcf86cd799439011';

/** Make a token that includes a jti claim (required for blacklist path). */
function makeTokenWithJti(jtiValue = 'test-jti-fixed', overrides = {}) {
  return jwt.sign(
    { id: USER_ID, email: 'test@example.com', jti: jtiValue, ...overrides },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('Auth Routes — blacklist + password reset', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: active user returned for authenticate middleware
    User.findById.mockReturnValue(chainable(makeMockUser()));
    // Default: no existing user
    User.findOne.mockReturnValue(chainable(null));
    // Redis: token not blacklisted by default
    mockRedis.exists.mockResolvedValue(0);
    mockRedis.get.mockResolvedValue(null);
  });

  // ── Token blacklist ─────────────────────────────────────────────────────────

  describe('POST /api/auth/logout — token blacklist', () => {
    test('logout returns 200 and redis.set is called to blacklist the jti', async () => {
      const token = makeTokenWithJti('jti-to-blacklist');

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .set('Origin', ORIGIN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // The blacklistToken helper should have stored the jti in Redis
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('jti-to-blacklist'),
        '1',
        'EX',
        expect.any(Number)
      );
    });

    test('401 — blacklisted token is rejected on subsequent authenticated request', async () => {
      const jti = 'revoked-jti-001';
      const token = makeTokenWithJti(jti);

      // Simulate redis returning 1 (token is blacklisted)
      mockRedis.exists.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/revoked/i);
    });

    test('200 — non-blacklisted token with jti is accepted', async () => {
      const token = makeTokenWithJti('valid-jti');
      // exists returns 0 → not blacklisted
      mockRedis.exists.mockResolvedValue(0);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ── POST /api/auth/forgot-password ─────────────────────────────────────────

  describe('POST /api/auth/forgot-password', () => {
    test('200 — no enumeration for non-existent email', async () => {
      User.findOne.mockReturnValue(chainable(null));

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .set('Origin', ORIGIN)
        .send({ email: 'nobody@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/if that email is registered/i);
    });

    test('200 — no enumeration when email exists (same response body)', async () => {
      const mockUser = { ...makeMockUser(), _id: USER_ID };
      User.findOne.mockReturnValue(chainable(mockUser));

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .set('Origin', ORIGIN)
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/if that email is registered/i);
      // Redis set should have been called to store the reset token
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^pwd:reset:/),
        expect.any(String),
        'EX',
        3600
      );
    });

    test('400 — invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .set('Origin', ORIGIN)
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
    });

    test('400 — missing email field', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .set('Origin', ORIGIN)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ── POST /api/auth/reset-password ──────────────────────────────────────────

  describe('POST /api/auth/reset-password', () => {
    test('400 — missing token', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('Origin', ORIGIN)
        .send({ password: 'newpassword123', confirmPassword: 'newpassword123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/token is required/i);
    });

    test('400 — mismatched passwords', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('Origin', ORIGIN)
        .send({ token: 'sometoken', password: 'newpassword123', confirmPassword: 'differentpassword' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/passwords do not match/i);
    });

    test('400 — expired or invalid token (redis.get returns null)', async () => {
      mockRedis.get.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('Origin', ORIGIN)
        .send({ token: 'invalidtoken', password: 'newpassword123', confirmPassword: 'newpassword123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid or has expired/i);
    });

    test('200 — valid token resets password', async () => {
      const mockUser = {
        ...makeMockUser(),
        _id: USER_ID,
        password: 'old_hashed',
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockRedis.get.mockResolvedValue(USER_ID);
      User.findById.mockReturnValue(chainable(mockUser));

      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('Origin', ORIGIN)
        .send({ token: 'validtoken', password: 'newpassword123', confirmPassword: 'newpassword123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/reset successfully/i);
    });

    test('400 — password shorter than 8 characters', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('Origin', ORIGIN)
        .send({ token: 'sometoken', password: 'short', confirmPassword: 'short' });

      expect(res.status).toBe(400);
    });
  });
});
