'use strict';

// ── Mock factories ────────────────────────────────────────────────────────────
// Defined outside beforeEach so tests can mutate the jest.fn() return values
const mockRedis = {
  set:    jest.fn().mockResolvedValue('OK'),
  exists: jest.fn().mockResolvedValue(0),
};

// ── Module lifecycle ──────────────────────────────────────────────────────────
// The module caches the redis reference at load time, so we must re-require
// it after each resetModules call to pick up the fresh mock.
let blacklistToken, isBlacklisted;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();

  // Re-register mocks AFTER resetModules so the next require() sees them
  jest.mock('../../../src/config/redis', () => mockRedis);
  jest.mock('../../../src/shared/logger', () => ({
    logger: { warn: jest.fn() },
  }));

  ({ blacklistToken, isBlacklisted } = require('../../../src/utils/tokenBlacklist'));
});

// ── blacklistToken ────────────────────────────────────────────────────────────

describe('blacklistToken', () => {
  const JTI = 'test-jti-abc';
  const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

  test('calls redis.set with correct key and TTL when jti is set and token not expired', async () => {
    await blacklistToken(JTI, futureExp);

    expect(mockRedis.set).toHaveBeenCalledTimes(1);
    const [key, value, exFlag, ttl] = mockRedis.set.mock.calls[0];
    expect(key).toBe(`jwt:bl:${JTI}`);
    expect(value).toBe('1');
    expect(exFlag).toBe('EX');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(3600);
  });

  test('skips redis.set when jti is null', async () => {
    await blacklistToken(null, futureExp);
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  test('skips redis.set when jti is undefined', async () => {
    await blacklistToken(undefined, futureExp);
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  test('skips redis.set when Redis is null', async () => {
    jest.resetModules();
    jest.mock('../../../src/config/redis', () => null);
    jest.mock('../../../src/shared/logger', () => ({
      logger: { warn: jest.fn() },
    }));
    const { blacklistToken: bt } = require('../../../src/utils/tokenBlacklist');

    await bt(JTI, futureExp);
    // mockRedis.set should never be called — null redis guard fired
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  test('skips redis.set when token is already expired (exp < now)', async () => {
    const pastExp = Math.floor(Date.now() / 1000) - 60; // 1 minute ago
    await blacklistToken(JTI, pastExp);
    expect(mockRedis.set).not.toHaveBeenCalled();
  });
});

// ── isBlacklisted ─────────────────────────────────────────────────────────────

describe('isBlacklisted', () => {
  const JTI = 'test-jti-xyz';

  test('returns true when redis.exists returns 1', async () => {
    mockRedis.exists.mockResolvedValueOnce(1);
    const result = await isBlacklisted(JTI);
    expect(result).toBe(true);
  });

  test('returns false when redis.exists returns 0', async () => {
    mockRedis.exists.mockResolvedValueOnce(0);
    const result = await isBlacklisted(JTI);
    expect(result).toBe(false);
  });

  test('returns false when jti is null', async () => {
    const result = await isBlacklisted(null);
    expect(result).toBe(false);
    expect(mockRedis.exists).not.toHaveBeenCalled();
  });

  test('returns false when jti is undefined', async () => {
    const result = await isBlacklisted(undefined);
    expect(result).toBe(false);
    expect(mockRedis.exists).not.toHaveBeenCalled();
  });

  test('returns false when Redis is null', async () => {
    jest.resetModules();
    jest.mock('../../../src/config/redis', () => null);
    jest.mock('../../../src/shared/logger', () => ({
      logger: { warn: jest.fn() },
    }));
    const { isBlacklisted: ib } = require('../../../src/utils/tokenBlacklist');

    const result = await ib(JTI);
    expect(result).toBe(false);
  });

  test('returns false (fail open) when Redis.exists throws', async () => {
    mockRedis.exists.mockRejectedValueOnce(new Error('Redis connection lost'));
    const result = await isBlacklisted(JTI);
    expect(result).toBe(false);
  });
});
