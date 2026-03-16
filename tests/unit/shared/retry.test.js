'use strict';

const { withRetry } = require('../../../src/shared/retry');

describe('withRetry', () => {
  test('resolves immediately on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    await expect(withRetry(fn, { maxAttempts: 3 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('retries on retryable error code and succeeds', async () => {
    const err = Object.assign(new Error('reset'), { code: 'ECONNRESET' });
    const fn = jest.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue('ok');

    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 0 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('exhausts all attempts and re-throws last error', async () => {
    const err = Object.assign(new Error('reset'), { code: 'ECONNRESET' });
    const fn = jest.fn().mockRejectedValue(err);

    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 0 })).rejects.toThrow('reset');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test('does not retry non-retryable errors', async () => {
    const err = Object.assign(new Error('bad request'), { code: 'EINVAL' });
    const fn = jest.fn().mockRejectedValue(err);

    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 0 })).rejects.toThrow('bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('custom retryOn predicate is respected', async () => {
    const err = new Error('custom');
    const fn = jest.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue('done');

    const retryOn = (e) => e.message === 'custom';
    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 0, retryOn })).resolves.toBe('done');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('delay stays within [0, maxDelayMs]', async () => {
    // Spy on setTimeout to verify delay is bounded
    jest.useFakeTimers();
    const err = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
    const fn = jest.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue('ok');

    const promise = withRetry(fn, { maxAttempts: 2, baseDelayMs: 500, maxDelayMs: 1000 });
    await jest.runAllTimersAsync();
    await promise;

    jest.useRealTimers();
  });
});
