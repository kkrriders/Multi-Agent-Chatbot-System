'use strict';

// ── Mocks (hoisted before all requires) ─────────────────────────────────────
jest.mock('../../src/models/User', () => ({
  findOne:         jest.fn(),
  findById:        jest.fn(),
  create:          jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));
jest.mock('../../src/models/Conversation', () => ({
  getUserConversations: jest.fn(),
  getConversationById:  jest.fn(),
  getUserTags:          jest.fn(),
  findByTags:           jest.fn(),
  create:               jest.fn(),
  findOne:              jest.fn(),
  findOneAndUpdate:     jest.fn(),
  findByIdAndUpdate:    jest.fn(),
}));
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

const request      = require('supertest');
const User         = require('../../src/models/User');
const Conversation = require('../../src/models/Conversation');
const { createTestApp, ORIGIN }                           = require('./helpers/app');
const { makeToken, makeMockUser, makeMockConversation, chainable, CONV_ID } = require('./helpers/fixtures');

// ── Helpers ──────────────────────────────────────────────────────────────────

const VALID_ID   = CONV_ID;                         // valid 24-hex ObjectId
const INVALID_ID = 'not-an-object-id';

/** Supertest agent with auth + Origin pre-set. */
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

describe('Conversation Routes', () => {
  let app;
  let api;

  beforeAll(() => {
    app = createTestApp();
    api = authed(app);
  });

  beforeEach(() => {
    // Auth middleware — every request needs a valid user
    User.findById.mockReturnValue(chainable(makeMockUser()));
    // Default: empty conversation list
    Conversation.getUserConversations.mockResolvedValue([]);
    Conversation.getConversationById.mockResolvedValue(makeMockConversation());
    Conversation.getUserTags.mockResolvedValue([]);
    Conversation.findByTags.mockResolvedValue([]);
    Conversation.create.mockResolvedValue(makeMockConversation());
    Conversation.findOne.mockReturnValue(chainable(makeMockConversation()));
    Conversation.findOneAndUpdate.mockResolvedValue(makeMockConversation());
    Conversation.findByIdAndUpdate.mockResolvedValue(makeMockConversation());
  });

  // ── GET /api/conversations ────────────────────────────────────────────────

  describe('GET /api/conversations', () => {
    test('200 — returns empty list by default', async () => {
      const res = await api.get('/api/conversations');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('200 — returns list of conversations', async () => {
      Conversation.getUserConversations.mockResolvedValue([makeMockConversation()]);
      const res = await api.get('/api/conversations');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
    });

    test('200 — accepts valid status query param', async () => {
      const res = await api.get('/api/conversations?status=archived');
      expect(res.status).toBe(200);
    });

    test('200 — accepts valid limit query param', async () => {
      const res = await api.get('/api/conversations?limit=10');
      expect(res.status).toBe(200);
    });

    test('400 — invalid status query param', async () => {
      const res = await api.get('/api/conversations?status=invalid');
      expect(res.status).toBe(400);
    });

    test('400 — limit out of range', async () => {
      const res = await api.get('/api/conversations?limit=999');
      expect(res.status).toBe(400);
    });

    test('401 — no token', async () => {
      const res = await request(app).get('/api/conversations');
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/conversations/tags/all ──────────────────────────────────────

  describe('GET /api/conversations/tags/all', () => {
    test('200 — returns empty tags list', async () => {
      const res = await api.get('/api/conversations/tags/all');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('200 — returns tag list when tags exist', async () => {
      Conversation.getUserTags.mockResolvedValue([{ tag: 'ai', count: 3 }]);
      const res = await api.get('/api/conversations/tags/all');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
    });

    test('401 — no token', async () => {
      const res = await request(app).get('/api/conversations/tags/all');
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/conversations/search/by-tags ────────────────────────────────

  describe('GET /api/conversations/search/by-tags', () => {
    test('200 — returns matching conversations', async () => {
      Conversation.findByTags.mockResolvedValue([makeMockConversation()]);
      const res = await api.get('/api/conversations/search/by-tags?tags=ai,ml');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
    });

    test('400 — missing tags parameter', async () => {
      const res = await api.get('/api/conversations/search/by-tags');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/tags parameter is required/i);
    });

    test('400 — invalid status', async () => {
      const res = await api.get('/api/conversations/search/by-tags?tags=ai&status=bad');
      expect(res.status).toBe(400);
    });

    test('401 — no token', async () => {
      const res = await request(app).get('/api/conversations/search/by-tags?tags=ai');
      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/conversations ───────────────────────────────────────────────

  describe('POST /api/conversations', () => {
    test('201 — creates with title and agentType', async () => {
      const res = await api.post('/api/conversations')
        .send({ title: 'My Chat', agentType: 'agent-1' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBeDefined();
    });

    test('201 — creates with defaults when no body sent', async () => {
      const res = await api.post('/api/conversations').send({});
      expect(res.status).toBe(201);
    });

    test('400 — title too long (> 200 chars)', async () => {
      const res = await api.post('/api/conversations')
        .send({ title: 'x'.repeat(201) });
      expect(res.status).toBe(400);
    });

    test('400 — invalid agentType', async () => {
      const res = await api.post('/api/conversations')
        .send({ agentType: 'agent-99' });
      expect(res.status).toBe(400);
    });

    test('400 — empty title string', async () => {
      const res = await api.post('/api/conversations')
        .send({ title: '   ' });
      expect(res.status).toBe(400);
    });

    test('401 — no token', async () => {
      const res = await request(app)
        .post('/api/conversations')
        .set('Origin', ORIGIN)
        .send({ title: 'My Chat' });
      expect(res.status).toBe(401);
    });

    test('403 — missing Origin header', async () => {
      const res = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ title: 'My Chat' });
      expect(res.status).toBe(403);
    });
  });

  // ── GET /api/conversations/:id ────────────────────────────────────────────

  describe('GET /api/conversations/:id', () => {
    test('200 — returns conversation by valid id', async () => {
      const res = await api.get(`/api/conversations/${VALID_ID}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(CONV_ID);
    });

    test('400 — invalid ObjectId format', async () => {
      const res = await api.get(`/api/conversations/${INVALID_ID}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid id/i);
    });

    test('404 — conversation not found', async () => {
      Conversation.getConversationById.mockResolvedValue(null);
      const res = await api.get(`/api/conversations/${VALID_ID}`);
      expect(res.status).toBe(404);
    });

    test('401 — no token', async () => {
      const res = await request(app).get(`/api/conversations/${VALID_ID}`);
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/conversations/:id/usage ─────────────────────────────────────

  describe('GET /api/conversations/:id/usage', () => {
    test('200 — returns token usage summary', async () => {
      const convWithUsage = makeMockConversation({
        messages: [
          { role: 'user', content: 'hi', tokenUsage: { inputTokens: 10, outputTokens: 0 }, metadata: { model: 'llama3' } },
          { role: 'assistant', content: 'hello', tokenUsage: { inputTokens: 0, outputTokens: 20 }, metadata: { model: 'llama3' } },
        ],
      });
      // usage route uses findOne().lean()
      Conversation.findOne.mockReturnValue(Object.assign(Promise.resolve(convWithUsage), {
        lean: jest.fn().mockResolvedValue(convWithUsage),
      }));

      const res = await api.get(`/api/conversations/${VALID_ID}/usage`);
      expect(res.status).toBe(200);
      expect(res.body.data.totalInputTokens).toBe(10);
      expect(res.body.data.totalOutputTokens).toBe(20);
      expect(res.body.data.totalTokens).toBe(30);
      expect(res.body.data.byModel.llama3).toBeDefined();
    });

    test('200 — returns zero totals for conversation with no token usage', async () => {
      const convNoUsage = makeMockConversation({ messages: [] });
      Conversation.findOne.mockReturnValue(Object.assign(Promise.resolve(convNoUsage), {
        lean: jest.fn().mockResolvedValue(convNoUsage),
      }));

      const res = await api.get(`/api/conversations/${VALID_ID}/usage`);
      expect(res.status).toBe(200);
      expect(res.body.data.totalTokens).toBe(0);
    });

    test('400 — invalid id', async () => {
      const res = await api.get(`/api/conversations/${INVALID_ID}/usage`);
      expect(res.status).toBe(400);
    });

    test('404 — conversation not found', async () => {
      Conversation.findOne.mockReturnValue(Object.assign(Promise.resolve(null), {
        lean: jest.fn().mockResolvedValue(null),
      }));
      const res = await api.get(`/api/conversations/${VALID_ID}/usage`);
      expect(res.status).toBe(404);
    });
  });

  // ── POST /api/conversations/:id/messages ─────────────────────────────────

  describe('POST /api/conversations/:id/messages', () => {
    test('200 — adds a user message', async () => {
      const res = await api.post(`/api/conversations/${VALID_ID}/messages`)
        .send({ role: 'user', content: 'Hello world' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('200 — adds an assistant message with agentId', async () => {
      const res = await api.post(`/api/conversations/${VALID_ID}/messages`)
        .send({ role: 'assistant', content: 'Hello back', agentId: 'agent-1' });

      expect(res.status).toBe(200);
    });

    test('400 — missing role', async () => {
      const res = await api.post(`/api/conversations/${VALID_ID}/messages`)
        .send({ content: 'Hello' });
      expect(res.status).toBe(400);
    });

    test('400 — missing content', async () => {
      const res = await api.post(`/api/conversations/${VALID_ID}/messages`)
        .send({ role: 'user' });
      expect(res.status).toBe(400);
    });

    test('400 — invalid role', async () => {
      const res = await api.post(`/api/conversations/${VALID_ID}/messages`)
        .send({ role: 'superuser', content: 'Hello' });
      expect(res.status).toBe(400);
    });

    test('400 — content is not a string', async () => {
      const res = await api.post(`/api/conversations/${VALID_ID}/messages`)
        .send({ role: 'user', content: { injected: 'object' } });
      expect(res.status).toBe(400);
    });

    test('400 — content exceeds 10,000 chars', async () => {
      const res = await api.post(`/api/conversations/${VALID_ID}/messages`)
        .send({ role: 'user', content: 'x'.repeat(10001) });
      expect(res.status).toBe(400);
    });

    test('400 — invalid id', async () => {
      const res = await api.post(`/api/conversations/${INVALID_ID}/messages`)
        .send({ role: 'user', content: 'Hi' });
      expect(res.status).toBe(400);
    });

    test('404 — conversation not found', async () => {
      Conversation.findOne.mockReturnValue(chainable(null));
      const res = await api.post(`/api/conversations/${VALID_ID}/messages`)
        .send({ role: 'user', content: 'Hi' });
      expect(res.status).toBe(404);
    });

    test('401 — no token', async () => {
      const res = await request(app)
        .post(`/api/conversations/${VALID_ID}/messages`)
        .set('Origin', ORIGIN)
        .send({ role: 'user', content: 'Hi' });
      expect(res.status).toBe(401);
    });
  });

  // ── PUT /api/conversations/:id ────────────────────────────────────────────

  describe('PUT /api/conversations/:id', () => {
    test('200 — updates title', async () => {
      const res = await api.put(`/api/conversations/${VALID_ID}`)
        .send({ title: 'New Title' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('200 — updates status to archived', async () => {
      const res = await api.put(`/api/conversations/${VALID_ID}`)
        .send({ status: 'archived' });
      expect(res.status).toBe(200);
    });

    test('200 — updates tags array', async () => {
      const res = await api.put(`/api/conversations/${VALID_ID}`)
        .send({ tags: ['ai', 'work'] });
      expect(res.status).toBe(200);
    });

    test('400 — invalid status value', async () => {
      const res = await api.put(`/api/conversations/${VALID_ID}`)
        .send({ status: 'paused' });
      expect(res.status).toBe(400);
    });

    test('400 — empty title string', async () => {
      const res = await api.put(`/api/conversations/${VALID_ID}`)
        .send({ title: '' });
      expect(res.status).toBe(400);
    });

    test('400 — invalid ObjectId', async () => {
      const res = await api.put(`/api/conversations/${INVALID_ID}`)
        .send({ title: 'x' });
      expect(res.status).toBe(400);
    });

    test('404 — conversation not found', async () => {
      Conversation.findOneAndUpdate.mockResolvedValue(null);
      const res = await api.put(`/api/conversations/${VALID_ID}`)
        .send({ title: 'New' });
      expect(res.status).toBe(404);
    });

    test('401 — no token', async () => {
      const res = await request(app)
        .put(`/api/conversations/${VALID_ID}`)
        .set('Origin', ORIGIN)
        .send({ title: 'x' });
      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/conversations/:id/tags ─────────────────────────────────────

  describe('POST /api/conversations/:id/tags', () => {
    test('200 — adds tags to conversation', async () => {
      const res = await api.post(`/api/conversations/${VALID_ID}/tags`)
        .send({ tags: ['ai', 'coding'] });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('400 — empty tags array', async () => {
      const res = await api.post(`/api/conversations/${VALID_ID}/tags`)
        .send({ tags: [] });
      expect(res.status).toBe(400);
    });

    test('400 — tags is not an array', async () => {
      const res = await api.post(`/api/conversations/${VALID_ID}/tags`)
        .send({ tags: 'ai' });
      expect(res.status).toBe(400);
    });

    test('404 — conversation not found', async () => {
      Conversation.findOne.mockReturnValue(chainable(null));
      const res = await api.post(`/api/conversations/${VALID_ID}/tags`)
        .send({ tags: ['ai'] });
      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /api/conversations/:id/tags ───────────────────────────────────

  describe('DELETE /api/conversations/:id/tags', () => {
    test('200 — removes tags from conversation', async () => {
      const res = await api.delete(`/api/conversations/${VALID_ID}/tags`)
        .send({ tags: ['ai'] });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('400 — empty tags array', async () => {
      const res = await api.delete(`/api/conversations/${VALID_ID}/tags`)
        .send({ tags: [] });
      expect(res.status).toBe(400);
    });

    test('404 — conversation not found', async () => {
      Conversation.findOne.mockReturnValue(chainable(null));
      const res = await api.delete(`/api/conversations/${VALID_ID}/tags`)
        .send({ tags: ['ai'] });
      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /api/conversations/:id ────────────────────────────────────────

  describe('DELETE /api/conversations/:id', () => {
    test('200 — soft-deletes conversation', async () => {
      const res = await api.delete(`/api/conversations/${VALID_ID}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/deleted/i);
    });

    test('400 — invalid ObjectId', async () => {
      const res = await api.delete(`/api/conversations/${INVALID_ID}`);
      expect(res.status).toBe(400);
    });

    test('404 — conversation not found', async () => {
      Conversation.findOneAndUpdate.mockResolvedValue(null);
      const res = await api.delete(`/api/conversations/${VALID_ID}`);
      expect(res.status).toBe(404);
    });

    test('401 — no token', async () => {
      const res = await request(app)
        .delete(`/api/conversations/${VALID_ID}`)
        .set('Origin', ORIGIN);
      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/conversations/:id/end ──────────────────────────────────────

  describe('POST /api/conversations/:id/end', () => {
    test('200 — returns PDF buffer for valid conversation', async () => {
      const conv = makeMockConversation({
        title: 'Chat Export',
        messages: [
          { role: 'user', content: 'Hello', timestamp: new Date(), agentId: null },
          { role: 'assistant', content: 'Hi there!', timestamp: new Date(), agentId: 'agent-1' },
        ],
      });
      Conversation.findOne.mockReturnValue(chainable(conv));

      const res = await api.post(`/api/conversations/${VALID_ID}/end`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
      expect(res.body).toBeTruthy();
    });

    test('404 — conversation not found', async () => {
      Conversation.findOne.mockReturnValue(chainable(null));
      const res = await api.post(`/api/conversations/${VALID_ID}/end`);
      expect(res.status).toBe(404);
    });

    test('400 — invalid ObjectId', async () => {
      const res = await api.post(`/api/conversations/${INVALID_ID}/end`);
      expect(res.status).toBe(400);
    });

    test('401 — no token', async () => {
      const res = await request(app)
        .post(`/api/conversations/${VALID_ID}/end`)
        .set('Origin', ORIGIN);
      expect(res.status).toBe(401);
    });
  });
});
