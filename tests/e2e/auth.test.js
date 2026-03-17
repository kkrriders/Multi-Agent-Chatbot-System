'use strict';

// ── Mocks (hoisted before all requires) ─────────────────────────────────────
jest.mock('../../src/models/User', () => ({
  findOne:         jest.fn(),
  findById:        jest.fn(),
  create:          jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));
jest.mock('../../src/models/Conversation', () => ({}));
jest.mock('../../src/models/PromptVersion', () => ({}));
jest.mock('../../src/config/redis', () => null);
jest.mock('../../src/shared/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../src/middleware/auditLog', () => ({
  auditLog: (_req, _res, next) => next(),
  auditEvent: jest.fn(),
}));
jest.mock('../../src/shared/summarizer', () => ({
  summarizeConversation: jest.fn(),
  SUMMARIZE_THRESHOLD: 20,
}));
jest.mock('../../src/shared/agent-config', () => ({
  invalidatePromptCache: jest.fn(),
  getActiveSystemPrompt: jest.fn().mockResolvedValue(null),
}));

const request = require('supertest');
const User    = require('../../src/models/User');
const { createTestApp, ORIGIN } = require('./helpers/app');
const { makeToken, makeMockUser, chainable } = require('./helpers/fixtures');

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Signed-in user with comparePassword + save methods */
function makeMockUserWithPassword(overrides = {}) {
  return {
    ...makeMockUser(),
    password:        'hashed_password',
    comparePassword: jest.fn().mockResolvedValue(true),
    save:            jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Auth Routes', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    // auth middleware: findById().select() returns active user by default
    User.findById.mockReturnValue(chainable(makeMockUser()));
    // signup: no pre-existing user
    User.findOne.mockReturnValue(chainable(null));
    // signup/login: create returns mock user
    User.create.mockResolvedValue(makeMockUser());
    // update-profile
    User.findByIdAndUpdate.mockResolvedValue(makeMockUser({ fullName: 'Updated Name' }));
  });

  // ── POST /api/auth/signup ─────────────────────────────────────────────────

  describe('POST /api/auth/signup', () => {
    const validBody = {
      fullName:        'Alice Smith',
      email:           'alice@example.com',
      password:        'password123',
      confirmPassword: 'password123',
    };

    test('201 — creates user and returns token with valid data', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .set('Origin', ORIGIN)
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('test@example.com');
      expect(res.body.data.token).toBeDefined();
    });

    test('400 — missing fullName', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .set('Origin', ORIGIN)
        .send({ email: 'alice@example.com', password: 'password123', confirmPassword: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('400 — missing password', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .set('Origin', ORIGIN)
        .send({ fullName: 'Alice', email: 'alice@example.com' });

      expect(res.status).toBe(400);
    });

    test('400 — invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .set('Origin', ORIGIN)
        .send({ ...validBody, email: 'not-an-email' });

      expect(res.status).toBe(400);
    });

    test('400 — password shorter than 8 characters', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .set('Origin', ORIGIN)
        .send({ ...validBody, password: 'short', confirmPassword: 'short' });

      expect(res.status).toBe(400);
    });

    test('400 — passwords do not match', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .set('Origin', ORIGIN)
        .send({ ...validBody, confirmPassword: 'differentpassword' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/passwords do not match/i);
    });

    test('400 — fullName shorter than 2 characters', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .set('Origin', ORIGIN)
        .send({ ...validBody, fullName: 'A' });

      expect(res.status).toBe(400);
    });

    test('400 — email already registered', async () => {
      User.findOne.mockReturnValue(chainable(makeMockUser())); // existing user

      const res = await request(app)
        .post('/api/auth/signup')
        .set('Origin', ORIGIN)
        .send(validBody);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already registered/i);
    });

    test('403 — missing Origin header (CSRF protection)', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send(validBody); // no Origin header

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    test('403 — wrong Origin header', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .set('Origin', 'http://evil.example.com')
        .send(validBody);

      expect(res.status).toBe(403);
    });
  });

  // ── POST /api/auth/login ──────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    beforeEach(() => {
      User.findOne.mockReturnValue(chainable(makeMockUserWithPassword()));
    });

    test('200 — valid credentials return token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Origin', ORIGIN)
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe('test@example.com');
    });

    test('400 — missing email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Origin', ORIGIN)
        .send({ password: 'password123' });

      expect(res.status).toBe(400);
    });

    test('400 — missing password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Origin', ORIGIN)
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
    });

    test('400 — invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Origin', ORIGIN)
        .send({ email: 'bad-email', password: 'password123' });

      expect(res.status).toBe(400);
    });

    test('401 — user not found', async () => {
      User.findOne.mockReturnValue(chainable(null));

      const res = await request(app)
        .post('/api/auth/login')
        .set('Origin', ORIGIN)
        .send({ email: 'nobody@example.com', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid credentials/i);
    });

    test('401 — wrong password', async () => {
      User.findOne.mockReturnValue(
        chainable(makeMockUserWithPassword({ comparePassword: jest.fn().mockResolvedValue(false) }))
      );

      const res = await request(app)
        .post('/api/auth/login')
        .set('Origin', ORIGIN)
        .send({ email: 'test@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid credentials/i);
    });

    test('401 — inactive account', async () => {
      User.findOne.mockReturnValue(chainable(makeMockUserWithPassword({ isActive: false })));

      const res = await request(app)
        .post('/api/auth/login')
        .set('Origin', ORIGIN)
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/inactive/i);
    });

    test('403 — missing Origin header (CSRF)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(403);
    });
  });

  // ── GET /api/auth/me ──────────────────────────────────────────────────────

  describe('GET /api/auth/me', () => {
    test('200 — returns current user with valid Bearer token', async () => {
      const token = makeToken();
      const res   = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('test@example.com');
    });

    test('200 — returns current user with valid cookie', async () => {
      const token = makeToken();
      const res   = await request(app)
        .get('/api/auth/me')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('401 — no token provided', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('401 — invalid / tampered token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.value');

      expect(res.status).toBe(401);
    });

    test('401 — user no longer exists (findById returns null)', async () => {
      User.findById.mockReturnValue(chainable(null));

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${makeToken()}`);

      expect(res.status).toBe(401);
    });

    test('401 — user account is inactive', async () => {
      User.findById.mockReturnValue(chainable(makeMockUser({ isActive: false })));

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${makeToken()}`);

      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/auth/logout ─────────────────────────────────────────────────

  describe('POST /api/auth/logout', () => {
    test('200 — clears cookie on valid token', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${makeToken()}`)
        .set('Origin', ORIGIN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/logged out/i);
    });

    test('401 — no token provided', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Origin', ORIGIN);

      expect(res.status).toBe(401);
    });

    test('403 — missing Origin header', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${makeToken()}`);

      expect(res.status).toBe(403);
    });
  });

  // ── PUT /api/auth/update-profile ──────────────────────────────────────────

  describe('PUT /api/auth/update-profile', () => {
    test('200 — updates fullName with valid token', async () => {
      const res = await request(app)
        .put('/api/auth/update-profile')
        .set('Authorization', `Bearer ${makeToken()}`)
        .set('Origin', ORIGIN)
        .send({ fullName: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
    });

    test('200 — updates preferences with valid token', async () => {
      const res = await request(app)
        .put('/api/auth/update-profile')
        .set('Authorization', `Bearer ${makeToken()}`)
        .set('Origin', ORIGIN)
        .send({ preferences: { theme: 'dark', notifications: false } });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('401 — no token provided', async () => {
      const res = await request(app)
        .put('/api/auth/update-profile')
        .set('Origin', ORIGIN)
        .send({ fullName: 'New Name' });

      expect(res.status).toBe(401);
    });

    test('403 — missing Origin header', async () => {
      const res = await request(app)
        .put('/api/auth/update-profile')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ fullName: 'New Name' });

      expect(res.status).toBe(403);
    });
  });
});
