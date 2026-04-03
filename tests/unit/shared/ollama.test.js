'use strict';

// ── Mocks (hoisted before all requires) ─────────────────────────────────────
jest.mock('groq-sdk');
jest.mock('../../../src/shared/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

// Synchronous withRetry that respects retryOn and maxAttempts (no real delays)
jest.mock('../../../src/shared/retry', () => ({
  withRetry: async (fn, opts) => {
    const max = opts?.maxAttempts ?? 3;
    const retryOn = opts?.retryOn ??
      ((e) => ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNABORTED', 'ENETUNREACH', 'EAI_AGAIN'].includes(e.code));
    let lastErr;
    for (let i = 0; i < max; i++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        if (!retryOn(e)) throw e;
      }
    }
    throw lastErr;
  },
}));

const Groq = require('groq-sdk');

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockCompletion(content) {
  return {
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 10, completion_tokens: 20 },
  };
}

let mockCreate;

beforeEach(() => {
  jest.resetModules();

  // Re-apply mocks after resetModules so the lazily required module picks them up
  jest.mock('groq-sdk');
  jest.mock('../../../src/shared/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
  }));
  jest.mock('../../../src/shared/retry', () => ({
    withRetry: async (fn, opts) => {
      const max = opts?.maxAttempts ?? 3;
      const retryOn = opts?.retryOn ??
        ((e) => ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNABORTED', 'ENETUNREACH', 'EAI_AGAIN'].includes(e.code));
      let lastErr;
      for (let i = 0; i < max; i++) {
        try {
          return await fn();
        } catch (e) {
          lastErr = e;
          if (!retryOn(e)) throw e;
        }
      }
      throw lastErr;
    },
  }));

  mockCreate = jest.fn();
  const GroqMock = require('groq-sdk');
  GroqMock.mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
    models: { list: jest.fn().mockResolvedValue({ data: [] }) },
  }));

  // Provide a dummy API key so getClient() does not throw
  process.env.GROQ_API_KEY = 'test-key';
});

// ── generateResponse ──────────────────────────────────────────────────────────

describe('generateResponse', () => {
  test('success path — returns trimmed content', async () => {
    mockCreate.mockResolvedValue(mockCompletion('  hello world  '));

    const { generateResponse } = require('../../../src/shared/ollama');
    const result = await generateResponse('some-model', 'prompt');

    expect(result).toBe('hello world');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  test('strips <think> blocks from the output', async () => {
    mockCreate.mockResolvedValue(mockCompletion('<think>reasoning</think>actual answer'));

    const { generateResponse } = require('../../../src/shared/ollama');
    const result = await generateResponse('some-model', 'prompt');

    expect(result).toBe('actual answer');
  });

  test('propagates error after retry exhaustion for ECONNRESET', async () => {
    const connErr = Object.assign(new Error('reset'), { code: 'ECONNRESET' });
    mockCreate.mockRejectedValue(connErr);

    const { generateResponse } = require('../../../src/shared/ollama');
    await expect(generateResponse('some-model', 'prompt', {})).rejects.toThrow('reset');

    // withRetry mock retries up to maxAttempts (3) times
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  test('does not retry Groq 429 (no err.code) — throws after 1 attempt', async () => {
    // Groq rate-limit errors have status:429 but no .code property
    const rateLimitErr = Object.assign(new Error('rate limited'), { status: 429 });
    mockCreate.mockRejectedValue(rateLimitErr);

    const { generateResponse } = require('../../../src/shared/ollama');
    await expect(generateResponse('some-model', 'prompt')).rejects.toThrow('rate limited');

    // No retryable .code → should NOT be retried
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});

// ── generateResponseJson ─────────────────────────────────────────────────────

describe('generateResponseJson', () => {
  test('returns parsed object on valid JSON response', async () => {
    mockCreate.mockResolvedValue(mockCompletion('{"key":"value"}'));

    const { generateResponseJson } = require('../../../src/shared/ollama');
    const result = await generateResponseJson('some-model', 'prompt');

    expect(result).toEqual({ key: 'value' });
  });

  test('throws with "Model returned invalid JSON" when model returns bad JSON', async () => {
    mockCreate.mockResolvedValue(mockCompletion('not json'));

    const { generateResponseJson } = require('../../../src/shared/ollama');
    await expect(generateResponseJson('some-model', 'prompt')).rejects.toThrow(
      /Model returned invalid JSON/
    );
  });
});
