'use strict';

const { auditEvent } = require('../../../src/middleware/auditLog');

// auditLog writes to a Winston file transport.
// We just verify the exported API is callable without throwing —
// the actual file write is tested by the transport, not our code.
describe('auditEvent', () => {
  test('does not throw with full fields', () => {
    expect(() => auditEvent({
      userId:    'user123',
      email:     'test@example.com',
      action:    'login.success',
      ip:        '127.0.0.1',
      userAgent: 'jest',
      success:   true,
    })).not.toThrow();
  });

  test('does not throw with minimal fields', () => {
    expect(() => auditEvent({ action: 'test.event', ip: '::1' })).not.toThrow();
  });

  test('does not throw when success is false', () => {
    expect(() => auditEvent({
      email:   'bad@example.com',
      action:  'login.failure',
      ip:      '10.0.0.1',
      success: false,
      detail:  'wrong password',
    })).not.toThrow();
  });
});
