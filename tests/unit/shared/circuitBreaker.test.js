'use strict';

const { CircuitBreaker, CircuitOpenError, STATE } = require('../../../src/shared/circuitBreaker');

function makeBreaker(opts = {}) {
  return new CircuitBreaker('test-agent', {
    failureThreshold: 3,
    recoveryTimeoutMs: 30_000,
    ...opts,
  });
}

describe('CircuitBreaker — state transitions', () => {
  test('starts in CLOSED state', () => {
    expect(makeBreaker().state).toBe(STATE.CLOSED);
  });

  test('stays CLOSED after successes', async () => {
    const cb = makeBreaker();
    await cb.execute(() => Promise.resolve('ok'));
    await cb.execute(() => Promise.resolve('ok'));
    expect(cb.state).toBe(STATE.CLOSED);
  });

  test('opens after failureThreshold consecutive failures', async () => {
    const cb = makeBreaker({ failureThreshold: 3 });
    const fail = () => Promise.reject(new Error('boom'));

    await expect(cb.execute(fail)).rejects.toThrow('boom');
    await expect(cb.execute(fail)).rejects.toThrow('boom');
    await expect(cb.execute(fail)).rejects.toThrow('boom');

    expect(cb.state).toBe(STATE.OPEN);
  });

  test('rejects immediately with CircuitOpenError when OPEN', async () => {
    const cb = makeBreaker({ failureThreshold: 1 });
    await expect(cb.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(cb.state).toBe(STATE.OPEN);

    await expect(cb.execute(() => Promise.resolve('ok'))).rejects.toBeInstanceOf(CircuitOpenError);
  });

  test('transitions to HALF_OPEN after recovery timeout', async () => {
    jest.useFakeTimers();
    const cb = makeBreaker({ failureThreshold: 1, recoveryTimeoutMs: 1000 });
    await expect(cb.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(cb.state).toBe(STATE.OPEN);

    jest.advanceTimersByTime(1001);

    // Next execute attempt transitions to HALF_OPEN then runs the fn
    await cb.execute(() => Promise.resolve('probe'));
    expect(cb.state).toBe(STATE.CLOSED); // success in HALF_OPEN → CLOSED

    jest.useRealTimers();
  });

  test('re-opens from HALF_OPEN on failure', async () => {
    jest.useFakeTimers();
    const cb = makeBreaker({ failureThreshold: 1, recoveryTimeoutMs: 1000 });
    await expect(cb.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();

    jest.advanceTimersByTime(1001);
    await expect(cb.execute(() => Promise.reject(new Error('y')))).rejects.toThrow('y');
    expect(cb.state).toBe(STATE.OPEN);

    jest.useRealTimers();
  });

  test('emits stateChange events', async () => {
    const cb = makeBreaker({ failureThreshold: 1 });
    const changes = [];
    cb.on('stateChange', (e) => changes.push(e));

    await expect(cb.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(changes).toEqual([{ name: 'test-agent', from: STATE.CLOSED, to: STATE.OPEN }]);
  });

  test('status() returns a plain object with current state', () => {
    const cb = makeBreaker();
    const s = cb.status();
    expect(s).toMatchObject({ name: 'test-agent', state: STATE.CLOSED, failures: 0 });
  });
});
