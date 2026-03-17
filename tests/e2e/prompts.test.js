'use strict';

// ── Mocks (hoisted before all requires) ─────────────────────────────────────
jest.mock('../../src/models/User', () => ({
  findOne:         jest.fn(),
  findById:        jest.fn(),
  create:          jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));
jest.mock('../../src/models/Conversation', () => ({}));
jest.mock('../../src/models/PromptVersion', () => ({
  find:              jest.fn(),
  findById:          jest.fn(),
  create:            jest.fn(),
  nextVersionNumber: jest.fn(),
  activate:          jest.fn(),
}));
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

const request       = require('supertest');
const User          = require('../../src/models/User');
const PromptVersion = require('../../src/models/PromptVersion');
const { createTestApp, ORIGIN }                                       = require('./helpers/app');
const { makeToken, makeMockUser, makeMockVersion, chainable, sortSelectLean, VERSION_ID, VERSION_ID2 } = require('./helpers/fixtures');

// ── Helpers ──────────────────────────────────────────────────────────────────

const VALID_AGENT   = 'agent-1';
const INVALID_AGENT = 'agent-99';
const INVALID_VID   = 'bad-id';

function authed(app) {
  const token = makeToken();
  return {
    get:    (url) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    post:   (url) => request(app).post(url).set('Authorization', `Bearer ${token}`).set('Origin', ORIGIN),
    put:    (url) => request(app).put(url).set('Authorization', `Bearer ${token}`).set('Origin', ORIGIN),
    delete: (url) => request(app).delete(url).set('Authorization', `Bearer ${token}`).set('Origin', ORIGIN),
  };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Prompt Routes', () => {
  let app;
  let api;

  beforeAll(() => {
    app = createTestApp();
    api = authed(app);
  });

  beforeEach(() => {
    // Auth middleware
    User.findById.mockReturnValue(chainable(makeMockUser()));

    // Default prompt version mocks
    const sortQuery = sortSelectLean([makeMockVersion()]);
    PromptVersion.find.mockReturnValue(sortQuery);
    PromptVersion.findById.mockResolvedValue(makeMockVersion());
    PromptVersion.create.mockResolvedValue(makeMockVersion());
    PromptVersion.nextVersionNumber.mockResolvedValue(1);
    PromptVersion.activate.mockResolvedValue(makeMockVersion({ active: true }));
  });

  // ── GET /api/prompts/:agentId ─────────────────────────────────────────────

  describe('GET /api/prompts/:agentId', () => {
    test('200 — returns prompt versions for a valid agent', async () => {
      const res = await api.get(`/api/prompts/${VALID_AGENT}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.count).toBe(1);
    });

    test('200 — returns empty list when no versions exist', async () => {
      PromptVersion.find.mockReturnValue(sortSelectLean([]));
      const res = await api.get(`/api/prompts/${VALID_AGENT}`);
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
    });

    test('200 — works for all valid agent IDs', async () => {
      const agents = ['agent-1', 'agent-2', 'agent-3', 'agent-4', 'manager'];
      for (const agentId of agents) {
        const res = await api.get(`/api/prompts/${agentId}`);
        expect(res.status).toBe(200);
      }
    });

    test('400 — invalid agentId', async () => {
      const res = await api.get(`/api/prompts/${INVALID_AGENT}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/agentId must be one of/i);
    });

    test('401 — no token', async () => {
      const res = await request(app).get(`/api/prompts/${VALID_AGENT}`);
      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/prompts/:agentId ────────────────────────────────────────────

  describe('POST /api/prompts/:agentId', () => {
    const validBody = {
      systemPrompt: 'You are a helpful coding assistant.',
      description:  'Initial coding prompt',
    };

    test('201 — creates a new prompt version', async () => {
      const res = await api.post(`/api/prompts/${VALID_AGENT}`)
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.agentId).toBe('agent-1');
      expect(res.body.data.version).toBe(1);
    });

    test('201 — creates without optional description', async () => {
      const res = await api.post(`/api/prompts/${VALID_AGENT}`)
        .send({ systemPrompt: 'You are an assistant.' });
      expect(res.status).toBe(201);
    });

    test('400 — missing systemPrompt', async () => {
      const res = await api.post(`/api/prompts/${VALID_AGENT}`)
        .send({ description: 'No prompt' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/systemPrompt is required/i);
    });

    test('400 — empty systemPrompt', async () => {
      const res = await api.post(`/api/prompts/${VALID_AGENT}`)
        .send({ systemPrompt: '   ' });
      expect(res.status).toBe(400);
    });

    test('400 — systemPrompt exceeds 10,000 characters', async () => {
      const res = await api.post(`/api/prompts/${VALID_AGENT}`)
        .send({ systemPrompt: 'x'.repeat(10001) });
      expect(res.status).toBe(400);
    });

    test('400 — description exceeds 500 characters', async () => {
      const res = await api.post(`/api/prompts/${VALID_AGENT}`)
        .send({ systemPrompt: 'Valid prompt.', description: 'x'.repeat(501) });
      expect(res.status).toBe(400);
    });

    test('400 — invalid agentId', async () => {
      const res = await api.post(`/api/prompts/${INVALID_AGENT}`)
        .send(validBody);
      expect(res.status).toBe(400);
    });

    test('401 — no token', async () => {
      const res = await request(app)
        .post(`/api/prompts/${VALID_AGENT}`)
        .set('Origin', ORIGIN)
        .send(validBody);
      expect(res.status).toBe(401);
    });

    test('403 — missing Origin header', async () => {
      const res = await request(app)
        .post(`/api/prompts/${VALID_AGENT}`)
        .set('Authorization', `Bearer ${makeToken()}`)
        .send(validBody);
      expect(res.status).toBe(403);
    });
  });

  // ── PUT /api/prompts/:agentId/:versionId/activate ────────────────────────

  describe('PUT /api/prompts/:agentId/:versionId/activate', () => {
    test('200 — activates a valid prompt version', async () => {
      const res = await api.put(`/api/prompts/${VALID_AGENT}/${VERSION_ID}/activate`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.active).toBe(true);
    });

    test('404 — version not found', async () => {
      PromptVersion.activate.mockResolvedValue(null);
      const res = await api.put(`/api/prompts/${VALID_AGENT}/${VERSION_ID}/activate`);
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    test('400 — invalid agentId', async () => {
      const res = await api.put(`/api/prompts/${INVALID_AGENT}/${VERSION_ID}/activate`);
      expect(res.status).toBe(400);
    });

    test('400 — invalid versionId format', async () => {
      const res = await api.put(`/api/prompts/${VALID_AGENT}/${INVALID_VID}/activate`);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid version id/i);
    });

    test('401 — no token', async () => {
      const res = await request(app)
        .put(`/api/prompts/${VALID_AGENT}/${VERSION_ID}/activate`)
        .set('Origin', ORIGIN);
      expect(res.status).toBe(401);
    });
  });

  // ── DELETE /api/prompts/:agentId/:versionId ───────────────────────────────

  describe('DELETE /api/prompts/:agentId/:versionId', () => {
    test('200 — deletes an inactive prompt version', async () => {
      PromptVersion.findById.mockResolvedValue(
        makeMockVersion({ agentId: VALID_AGENT, active: false })
      );
      const res = await api.delete(`/api/prompts/${VALID_AGENT}/${VERSION_ID}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/deleted/i);
    });

    test('409 — cannot delete the active version', async () => {
      PromptVersion.findById.mockResolvedValue(
        makeMockVersion({ agentId: VALID_AGENT, active: true })
      );
      const res = await api.delete(`/api/prompts/${VALID_AGENT}/${VERSION_ID}`);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/cannot delete the active/i);
    });

    test('404 — version not found', async () => {
      PromptVersion.findById.mockResolvedValue(null);
      const res = await api.delete(`/api/prompts/${VALID_AGENT}/${VERSION_ID}`);
      expect(res.status).toBe(404);
    });

    test('404 — version belongs to different agent', async () => {
      PromptVersion.findById.mockResolvedValue(
        makeMockVersion({ agentId: 'agent-2', active: false }) // wrong agent
      );
      const res = await api.delete(`/api/prompts/${VALID_AGENT}/${VERSION_ID}`);
      expect(res.status).toBe(404);
    });

    test('400 — invalid agentId', async () => {
      const res = await api.delete(`/api/prompts/${INVALID_AGENT}/${VERSION_ID}`);
      expect(res.status).toBe(400);
    });

    test('400 — invalid versionId format', async () => {
      const res = await api.delete(`/api/prompts/${VALID_AGENT}/${INVALID_VID}`);
      expect(res.status).toBe(400);
    });

    test('401 — no token', async () => {
      const res = await request(app)
        .delete(`/api/prompts/${VALID_AGENT}/${VERSION_ID}`)
        .set('Origin', ORIGIN);
      expect(res.status).toBe(401);
    });

    test('403 — missing Origin header', async () => {
      const res = await request(app)
        .delete(`/api/prompts/${VALID_AGENT}/${VERSION_ID}`)
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(403);
    });
  });
});
