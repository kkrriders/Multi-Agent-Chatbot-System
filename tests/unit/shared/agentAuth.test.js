'use strict';

const { signAgentRequest, verifyAgentRequest } = require('../../../src/shared/agentAuth');
const express = require('express');
const request = require('supertest');

const SECRET = 'a'.repeat(32);

describe('signAgentRequest', () => {
  test('returns x-agent-signature header', () => {
    const headers = signAgentRequest({ foo: 'bar' }, SECRET);
    expect(headers).toHaveProperty('x-agent-signature');
    expect(typeof headers['x-agent-signature']).toBe('string');
    expect(headers['x-agent-signature']).toHaveLength(64); // SHA-256 hex = 64 chars
  });

  test('same body produces same signature', () => {
    const body = { content: 'hello', from: 'user' };
    expect(signAgentRequest(body, SECRET)['x-agent-signature'])
      .toBe(signAgentRequest(body, SECRET)['x-agent-signature']);
  });

  test('different body produces different signature', () => {
    const s1 = signAgentRequest({ a: 1 }, SECRET)['x-agent-signature'];
    const s2 = signAgentRequest({ a: 2 }, SECRET)['x-agent-signature'];
    expect(s1).not.toBe(s2);
  });
});

describe('verifyAgentRequest middleware', () => {
  function buildApp(secret) {
    const app = express();
    app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
    app.post('/message', verifyAgentRequest(secret), (_req, res) => res.json({ ok: true }));
    return app;
  }

  test('passes request with valid signature', async () => {
    const app  = buildApp(SECRET);
    const body = { content: 'test', from: 'manager' };
    const sig  = signAgentRequest(body, SECRET);

    const res = await request(app)
      .post('/message')
      .set(sig)
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('rejects request with missing signature', async () => {
    const app = buildApp(SECRET);
    const res = await request(app).post('/message').send({ content: 'test' });
    expect(res.status).toBe(403);
  });

  test('rejects request with tampered body', async () => {
    const app      = buildApp(SECRET);
    const original = { content: 'original', from: 'manager' };
    const sig      = signAgentRequest(original, SECRET);

    const res = await request(app)
      .post('/message')
      .set(sig)
      .send({ content: 'tampered', from: 'manager' }); // different body, same sig

    expect(res.status).toBe(403);
  });

  test('rejects request with wrong secret', async () => {
    const app  = buildApp(SECRET);
    const body = { content: 'test', from: 'manager' };
    const sig  = signAgentRequest(body, 'wrong-secret'.padEnd(32, 'x'));

    const res = await request(app).post('/message').set(sig).send(body);
    expect(res.status).toBe(403);
  });
});
