'use strict';

const validateEnv = require('../../../src/utils/validateEnv');

function withEnv(overrides, fn) {
  const original = {};
  for (const key of Object.keys(overrides)) {
    original[key] = process.env[key];
    process.env[key] = overrides[key];
  }
  try {
    return fn();
  } finally {
    for (const [key, val] of Object.entries(original)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  }
}

const VALID_ENV = {
  JWT_SECRET:           'a'.repeat(32),
  MONGODB_URI:          'mongodb://localhost:27017/test',
  FRONTEND_URL:         'http://localhost:3002',
  AGENT_SHARED_SECRET:  'b'.repeat(32),
};

describe('validateEnv', () => {
  test('passes with all valid required vars', () => {
    withEnv(VALID_ENV, () => expect(() => validateEnv()).not.toThrow());
  });

  test('throws when JWT_SECRET is missing', () => {
    withEnv({ ...VALID_ENV, JWT_SECRET: '' }, () =>
      expect(() => validateEnv()).toThrow(/JWT_SECRET/)
    );
  });

  test('throws when JWT_SECRET is the known default value', () => {
    withEnv({ ...VALID_ENV, JWT_SECRET: 'your-super-secret-jwt-key-change-this-in-production' }, () =>
      expect(() => validateEnv()).toThrow(/JWT_SECRET/)
    );
  });

  test('throws when JWT_SECRET is shorter than 32 chars', () => {
    withEnv({ ...VALID_ENV, JWT_SECRET: 'tooshort' }, () =>
      expect(() => validateEnv()).toThrow(/JWT_SECRET/)
    );
  });

  test('throws when MONGODB_URI has invalid scheme', () => {
    withEnv({ ...VALID_ENV, MONGODB_URI: 'postgres://localhost' }, () =>
      expect(() => validateEnv()).toThrow(/MONGODB_URI/)
    );
  });

  test('throws when FRONTEND_URL is not a valid URL', () => {
    withEnv({ ...VALID_ENV, FRONTEND_URL: 'not-a-url' }, () =>
      expect(() => validateEnv()).toThrow(/FRONTEND_URL/)
    );
  });

  test('throws when AGENT_SHARED_SECRET is too short', () => {
    withEnv({ ...VALID_ENV, AGENT_SHARED_SECRET: 'short' }, () =>
      expect(() => validateEnv()).toThrow(/AGENT_SHARED_SECRET/)
    );
  });

  test('accepts mongodb+srv:// URI scheme', () => {
    withEnv({ ...VALID_ENV, MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/db' }, () =>
      expect(() => validateEnv()).not.toThrow()
    );
  });
});
