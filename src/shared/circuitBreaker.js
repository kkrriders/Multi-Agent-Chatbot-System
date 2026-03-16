/**
 * Circuit Breaker (per-agent)
 *
 * Problem: when Ollama is loading a model or the GPU is saturated, every call
 * to an agent times out after 60 s. Without a circuit breaker the manager keeps
 * firing retries, creating a thundering-herd that prolongs the outage.
 *
 * State machine:
 *   CLOSED  → normal operation, all calls pass through
 *   OPEN    → agent is failing; calls are rejected immediately (fail-fast)
 *   HALF_OPEN → one probe call is allowed; success → CLOSED, failure → OPEN
 *
 * Usage:
 *   const cb = new CircuitBreaker('agent-1', { failureThreshold: 3, recoveryTimeoutMs: 30_000 })
 *   const result = await cb.execute(() => axios.post(...))
 */

'use strict';

const { EventEmitter } = require('events');

const STATE = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' };

class CircuitBreaker extends EventEmitter {
  /**
   * @param {string} name               - Identifier (used in logs + metrics)
   * @param {object} [opts]
   * @param {number} [opts.failureThreshold=3]      - Failures before opening
   * @param {number} [opts.recoveryTimeoutMs=30000]  - Time before trying HALF_OPEN
   * @param {number} [opts.successThreshold=1]       - Successes in HALF_OPEN to close
   */
  constructor(name, opts = {}) {
    super();
    this.name             = name;
    this.failureThreshold = opts.failureThreshold  ?? 3;
    this.recoveryTimeout  = opts.recoveryTimeoutMs ?? 30_000;
    this.successThreshold = opts.successThreshold  ?? 1;

    this._state          = STATE.CLOSED;
    this._failures       = 0;
    this._successes      = 0;
    this._lastFailureAt  = null;
  }

  get state() { return this._state; }

  /**
   * Execute fn through the circuit breaker.
   * @param {() => Promise<any>} fn
   * @returns {Promise<any>}
   * @throws {CircuitOpenError} when the circuit is OPEN
   */
  async execute(fn) {
    if (this._state === STATE.OPEN) {
      const elapsed = Date.now() - this._lastFailureAt;
      if (elapsed >= this.recoveryTimeout) {
        this._transition(STATE.HALF_OPEN);
      } else {
        throw new CircuitOpenError(
          `Circuit OPEN for ${this.name} — retry in ${Math.ceil((this.recoveryTimeout - elapsed) / 1000)}s`
        );
      }
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure(err);
      throw err;
    }
  }

  _onSuccess() {
    this._failures = 0;
    if (this._state === STATE.HALF_OPEN) {
      this._successes++;
      if (this._successes >= this.successThreshold) {
        this._transition(STATE.CLOSED);
      }
    }
  }

  _onFailure(err) {
    this._lastFailureAt = Date.now();
    this._successes = 0;
    this._failures++;

    if (this._state === STATE.HALF_OPEN || this._failures >= this.failureThreshold) {
      this._transition(STATE.OPEN);
    }
  }

  _transition(newState) {
    const prev = this._state;
    this._state = newState;

    if (newState === STATE.CLOSED) {
      this._failures = 0;
      this._successes = 0;
    }

    if (prev !== newState) {
      this.emit('stateChange', { name: this.name, from: prev, to: newState });
    }
  }

  /** Returns a plain object safe to embed in API responses / logs */
  status() {
    return {
      name:           this.name,
      state:          this._state,
      failures:       this._failures,
      lastFailureAt:  this._lastFailureAt,
    };
  }
}

class CircuitOpenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CircuitOpenError';
    this.code = 'CIRCUIT_OPEN';
  }
}

module.exports = { CircuitBreaker, CircuitOpenError, STATE };
