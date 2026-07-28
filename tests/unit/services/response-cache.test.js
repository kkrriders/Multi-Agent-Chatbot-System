'use strict';

describe('response-cache (Redis available)', () => {
  let cache, redisMock;

  beforeEach(() => {
    jest.resetModules();
    redisMock = { get: jest.fn(), set: jest.fn() };
    jest.doMock('../../../src/config/redis', () => redisMock);
    cache = require('../../../src/services/ai/response-cache');
  });

  test('get() returns null on a cache miss', async () => {
    redisMock.get.mockResolvedValue(null);
    const result = await cache.get('site', 'fast', 'prompt');
    expect(result).toBeNull();
  });

  test('get() returns the parsed value on a cache hit', async () => {
    redisMock.get.mockResolvedValue(JSON.stringify({ data: { score: 90 } }));
    const result = await cache.get('site', 'fast', 'prompt');
    expect(result).toEqual({ data: { score: 90 } });
  });

  test('get() returns null (not a throw) when Redis errors', async () => {
    redisMock.get.mockRejectedValue(new Error('connection reset'));
    await expect(cache.get('site', 'fast', 'prompt')).resolves.toBeNull();
  });

  test('set() stores JSON with an expiry', async () => {
    redisMock.set.mockResolvedValue('OK');
    await cache.set('site', 'fast', 'prompt', { data: { score: 1 } }, 3600);
    expect(redisMock.set).toHaveBeenCalledWith(
      expect.stringContaining('ai-cache:site:'),
      JSON.stringify({ data: { score: 1 } }),
      'EX',
      3600
    );
  });

  test('set() swallows Redis errors without throwing', async () => {
    redisMock.set.mockRejectedValue(new Error('write failed'));
    await expect(cache.set('site', 'fast', 'prompt', {}, 60)).resolves.toBeUndefined();
  });

  test('same (callSite, tier, prompt) produces the same cache key', async () => {
    redisMock.get.mockResolvedValue(null);
    await cache.get('site', 'fast', 'identical prompt');
    await cache.get('site', 'fast', 'identical prompt');
    expect(redisMock.get.mock.calls[0][0]).toBe(redisMock.get.mock.calls[1][0]);
  });

  test('a different prompt produces a different cache key', async () => {
    redisMock.get.mockResolvedValue(null);
    await cache.get('site', 'fast', 'prompt A');
    await cache.get('site', 'fast', 'prompt B');
    expect(redisMock.get.mock.calls[0][0]).not.toBe(redisMock.get.mock.calls[1][0]);
  });
});

describe('response-cache (Redis absent — fails open)', () => {
  let cache, redisMock;

  beforeEach(() => {
    jest.resetModules();
    redisMock = null;
    jest.doMock('../../../src/config/redis', () => redisMock);
    cache = require('../../../src/services/ai/response-cache');
  });

  test('get() always returns null without touching Redis', async () => {
    await expect(cache.get('site', 'fast', 'prompt')).resolves.toBeNull();
  });

  test('set() is a no-op', async () => {
    await expect(cache.set('site', 'fast', 'prompt', { a: 1 }, 60)).resolves.toBeUndefined();
  });
});
