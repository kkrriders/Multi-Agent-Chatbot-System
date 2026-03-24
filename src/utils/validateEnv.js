/**
 * Startup environment validation.
 *
 * Must be called at the very top of the process entry point — before any
 * middleware, database connections, or route registration — so that a missing
 * or weak secret fails loudly at boot rather than silently at runtime.
 *
 * Throws on the first validation failure so the error message is unambiguous.
 */

const KNOWN_WEAK_SECRETS = new Set([
  'your-super-secret-jwt-key-change-this-in-production',
  'secret',
  'changeme',
  'password',
  'jwt_secret',
  '12345678901234567890123456789012',
]);

const REQUIRED = [
  {
    key: 'JWT_SECRET',
    validate(val) {
      if (KNOWN_WEAK_SECRETS.has(val)) return 'is a known default — set a unique random value';
      if (val.length < 32) return 'must be at least 32 characters';
      return null;
    },
  },
  {
    key: 'MONGODB_URI',
    validate(val) {
      if (!val.startsWith('mongodb://') && !val.startsWith('mongodb+srv://'))
        return 'must be a valid MongoDB connection string';
      return null;
    },
  },
  {
    key: 'FRONTEND_URL',
    validate(val) {
      try { new URL(val); return null; } catch {
        return 'must be a valid URL (e.g. http://localhost:3002)';
      }
    },
  },
  {
    key: 'AGENT_SHARED_SECRET',
    validate(val) {
      if (val.length < 32) return 'must be at least 32 characters';
      return null;
    },
  },
  {
    key: 'GROQ_API_KEY',
    validate(val) {
      if (!val.startsWith('gsk_')) return 'must be a valid Groq API key (starts with gsk_)';
      if (val.length < 20) return 'appears too short — check your Groq API key';
      return null;
    },
  },
];

// Optional — warn when missing but don't abort startup
const OPTIONAL = [
  'REDIS_URL',
  'COOKIE_SECRET',
];

function validateEnv() {
  const errors = [];

  for (const { key, validate } of REQUIRED) {
    const val = process.env[key];
    if (!val) {
      errors.push(`  ✗ ${key} is not set`);
      continue;
    }
    const msg = validate(val);
    if (msg) errors.push(`  ✗ ${key} ${msg}`);
  }

  if (errors.length > 0) {
    throw new Error(
      `\n\nStartup aborted — invalid environment configuration:\n${errors.join('\n')}\n\n` +
      `Copy .env.example to .env and fill in all required values.\n`
    );
  }

  // Warn about optional vars
  for (const key of OPTIONAL) {
    if (!process.env[key]) {
      console.warn(`[validateEnv] WARNING: ${key} is not set — some features will be degraded`);
    }
  }
}

module.exports = validateEnv;
