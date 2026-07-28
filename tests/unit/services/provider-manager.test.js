'use strict';

jest.mock('../../../src/services/ai/providers/groq-provider');
jest.mock('../../../src/models/AiUsageLog', () => ({ create: jest.fn().mockResolvedValue({}) }));
jest.mock('../../../src/services/ai/response-cache');

const { z } = require('zod');

describe('provider-manager.generateJson', () => {
  let ai, groq, AiUsageLog;
  const schema = z.object({ score: z.number() });

  beforeEach(() => {
    jest.resetModules();
    delete process.env.OPENROUTER_API_KEY; // keep the fallback chain single-provider for these tests
    groq = require('../../../src/services/ai/providers/groq-provider');
    groq.name = 'groq';
    AiUsageLog = require('../../../src/models/AiUsageLog');
    ai = require('../../../src/services/ai/provider-manager');
  });

  test('returns validated data when schema matches on first try', async () => {
    groq.generateJson.mockResolvedValue({ data: { score: 80 }, inputTokens: 10, outputTokens: 5, provider: 'groq' });
    const result = await ai.generateJson('prompt', 'fast', { schema, callSite: 'test' });
    expect(result.data).toEqual({ score: 80 });
    expect(groq.generateJson).toHaveBeenCalledTimes(1);
  });

  test('retries once with validation issues appended, then succeeds', async () => {
    groq.generateJson
      .mockResolvedValueOnce({ data: { score: 'not-a-number' }, inputTokens: 10, outputTokens: 5, provider: 'groq' })
      .mockResolvedValueOnce({ data: { score: 90 }, inputTokens: 10, outputTokens: 5, provider: 'groq' });

    const result = await ai.generateJson('prompt', 'fast', { schema, callSite: 'test' });

    expect(result.data).toEqual({ score: 90 });
    expect(groq.generateJson).toHaveBeenCalledTimes(2);
    expect(groq.generateJson.mock.calls[1][1]).toContain('previous response was invalid');
  });

  test('throws a clear error when the retry also fails schema validation', async () => {
    groq.generateJson.mockResolvedValue({ data: { score: 'nope' }, inputTokens: 10, outputTokens: 5, provider: 'groq' });

    await expect(ai.generateJson('prompt', 'fast', { schema, callSite: 'test' }))
      .rejects.toThrow('failed schema validation');
    expect(groq.generateJson).toHaveBeenCalledTimes(2);
  });

  test('skips validation entirely when no schema is passed', async () => {
    groq.generateJson.mockResolvedValue({ data: { anything: true }, inputTokens: 1, outputTokens: 1, provider: 'groq' });
    const result = await ai.generateJson('prompt', 'fast');
    expect(result.data).toEqual({ anything: true });
    expect(groq.generateJson).toHaveBeenCalledTimes(1);
  });

  test('logs usage on success, tagged with the callSite, without throwing', async () => {
    groq.generateJson.mockResolvedValue({ data: {}, inputTokens: 10, outputTokens: 20, provider: 'groq' });
    await ai.generateJson('prompt', 'fast', { callSite: 'usage-test' });
    expect(AiUsageLog.create).toHaveBeenCalledWith(expect.objectContaining({
      callSite: 'usage-test',
      provider: 'groq',
      success: true,
      inputTokens: 10,
      outputTokens: 20,
    }));
  });

  test('logs usage as a failure when every provider is exhausted, and still throws', async () => {
    const err = new Error('quota exceeded');
    err.providerErrorType = 'quota_exhausted';
    groq.generateJson.mockRejectedValue(err);

    await expect(ai.generateJson('prompt', 'fast', { callSite: 'usage-fail' })).rejects.toThrow('All AI providers exhausted');
    expect(AiUsageLog.create).toHaveBeenCalledWith(expect.objectContaining({
      callSite: 'usage-fail',
      success: false,
    }));
  });

  test('a usage-log write failure never breaks the caller', async () => {
    AiUsageLog.create.mockRejectedValueOnce(new Error('Mongo down'));
    groq.generateJson.mockResolvedValue({ data: { score: 1 }, inputTokens: 1, outputTokens: 1, provider: 'groq' });
    await expect(ai.generateJson('prompt', 'fast', { schema, callSite: 'test' })).resolves.toBeDefined();
  });
});

describe('provider-manager.generateJsonWithEscalation', () => {
  let ai, groq, AiUsageLog;
  const confidentSchema = z.object({ score: z.number(), confidence: z.number() });

  beforeEach(() => {
    jest.resetModules();
    delete process.env.OPENROUTER_API_KEY;
    groq = require('../../../src/services/ai/providers/groq-provider');
    groq.name = 'groq';
    AiUsageLog = require('../../../src/models/AiUsageLog');
    ai = require('../../../src/services/ai/provider-manager');
  });

  test('stays on the fast tier when confidence is high enough', async () => {
    groq.generateJson.mockResolvedValue({ data: { score: 80, confidence: 0.9 }, inputTokens: 10, outputTokens: 5, provider: 'groq' });

    const result = await ai.generateJsonWithEscalation('prompt', { schema: confidentSchema, callSite: 'x' });

    expect(result.data).toEqual({ score: 80, confidence: 0.9 });
    expect(groq.generateJson).toHaveBeenCalledTimes(1);
    expect(groq.generateJson.mock.calls[0][0]).toBe(ai.MODELS.fast.groq);
  });

  test('escalates to the balanced tier when fast-tier confidence is low', async () => {
    groq.generateJson
      .mockResolvedValueOnce({ data: { score: 55, confidence: 0.3 }, inputTokens: 10, outputTokens: 5, provider: 'groq' })
      .mockResolvedValueOnce({ data: { score: 70, confidence: 0.85 }, inputTokens: 10, outputTokens: 5, provider: 'groq' });

    const result = await ai.generateJsonWithEscalation('prompt', { schema: confidentSchema, callSite: 'x' });

    expect(groq.generateJson).toHaveBeenCalledTimes(2);
    expect(groq.generateJson.mock.calls[0][0]).toBe(ai.MODELS.fast.groq);
    expect(groq.generateJson.mock.calls[1][0]).toBe(ai.MODELS.balanced.groq);
    expect(result.data).toEqual({ score: 70, confidence: 0.85 });
    expect(AiUsageLog.create).toHaveBeenCalledWith(expect.objectContaining({ callSite: 'x:escalated' }));
  });

  test('respects a custom confidenceThreshold', async () => {
    groq.generateJson.mockResolvedValue({ data: { score: 80, confidence: 0.7 }, inputTokens: 10, outputTokens: 5, provider: 'groq' });

    await ai.generateJsonWithEscalation('prompt', { schema: confidentSchema, callSite: 'x', confidenceThreshold: 0.9 });

    expect(groq.generateJson).toHaveBeenCalledTimes(2); // 0.7 < 0.9 threshold, so it escalates
  });

  test('does not escalate when the schema has no confidence field', async () => {
    const noConfidenceSchema = z.object({ score: z.number() });
    groq.generateJson.mockResolvedValue({ data: { score: 80 }, inputTokens: 10, outputTokens: 5, provider: 'groq' });

    await ai.generateJsonWithEscalation('prompt', { schema: noConfidenceSchema, callSite: 'x' });

    expect(groq.generateJson).toHaveBeenCalledTimes(1);
  });
});

describe('provider-manager cacheTtlSeconds', () => {
  let ai, groq, AiUsageLog, responseCache;

  beforeEach(() => {
    jest.resetModules();
    delete process.env.OPENROUTER_API_KEY;
    groq = require('../../../src/services/ai/providers/groq-provider');
    groq.name = 'groq';
    AiUsageLog = require('../../../src/models/AiUsageLog');
    responseCache = require('../../../src/services/ai/response-cache');
    ai = require('../../../src/services/ai/provider-manager');
  });

  test('does not touch the cache when cacheTtlSeconds is not set', async () => {
    groq.generateJson.mockResolvedValue({ data: { ok: true }, inputTokens: 1, outputTokens: 1, provider: 'groq' });
    await ai.generateJson('prompt', 'fast', { callSite: 'x' });
    expect(responseCache.get).not.toHaveBeenCalled();
    expect(responseCache.set).not.toHaveBeenCalled();
  });

  test('skips the AI call entirely on a cache hit, and logs a :cache-hit usage entry', async () => {
    responseCache.get.mockResolvedValue({ data: { ok: true }, provider: 'groq' });

    const result = await ai.generateJson('prompt', 'fast', { callSite: 'x', cacheTtlSeconds: 3600 });

    expect(result).toEqual({ data: { ok: true }, provider: 'groq' });
    expect(groq.generateJson).not.toHaveBeenCalled();
    expect(AiUsageLog.create).toHaveBeenCalledWith(expect.objectContaining({
      callSite: 'x:cache-hit',
      provider: 'cache',
      success: true,
    }));
  });

  test('calls the AI and stores the result on a cache miss', async () => {
    responseCache.get.mockResolvedValue(null);
    groq.generateJson.mockResolvedValue({ data: { ok: true }, inputTokens: 1, outputTokens: 1, provider: 'groq' });

    const result = await ai.generateJson('prompt', 'fast', { callSite: 'x', cacheTtlSeconds: 3600 });

    expect(groq.generateJson).toHaveBeenCalledTimes(1);
    expect(responseCache.set).toHaveBeenCalledWith('x', 'fast', 'prompt', result, 3600);
  });
});
