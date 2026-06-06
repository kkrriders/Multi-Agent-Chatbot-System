'use strict';



const { logger } = require('../../shared/logger');

const PISTON_URL = 'https://emkc.org/api/v2/piston/execute';
const REQUEST_TIMEOUT_MS = 10_000;

// Maps display language names to Piston runtime identifiers
const LANGUAGE_MAP = {
  javascript: { language: 'javascript', version: '18.15.0' },
  python:     { language: 'python',     version: '3.10.0'  },
  java:       { language: 'java',       version: '15.0.2'  },
  cpp:        { language: 'c++',        version: '10.2.0'  },
  c:          { language: 'c',          version: '10.2.0'  },
  typescript: { language: 'typescript', version: '5.0.3'   },
  go:         { language: 'go',         version: '1.16.2'  },
  rust:       { language: 'rust',       version: '1.50.0'  },
};


async function _executeOne(code, language, input) {
  const runtime = LANGUAGE_MAP[language];
  if (!runtime) throw new Error(`Unsupported language: ${language}`);

  const body = {
    language: runtime.language,
    version:  runtime.version,
    files: [{ content: code }],
    stdin: input || '',
    run_timeout: 5000,
  };

  const res = await fetch(PISTON_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Piston returned HTTP ${res.status}`);
  }

  const data = await res.json();
  const run = data.run || {};

  return {
    actualOutput:   (run.stdout || '').trim(),
    executionTimeMs: null, // Piston doesn't expose this per-run
    error:          run.stderr || run.code !== 0 ? (run.stderr || 'Runtime error') : null,
  };
}

/**
 * Run code against all provided test cases.
 *
 * @param {string} code
 * @param {string} language
 * @param {Array<{input, expectedOutput, hidden}>} testCases
 * @returns {Promise<{testResults, codeScore}>}
 */
async function run(code, language, testCases) {
  if (!code?.trim()) throw new Error('No code submitted');
  if (!LANGUAGE_MAP[language]) throw new Error(`Unsupported language: ${language}`);
  if (!testCases?.length)      throw new Error('No test cases defined for this question');

  const testResults = [];
  let passed = 0;

  for (const tc of testCases) {
    try {
      const { actualOutput, executionTimeMs, error } = await _executeOne(code, language, tc.input);

      const isPass = !error && actualOutput === String(tc.expectedOutput).trim();
      if (isPass) passed++;

      testResults.push({
        input:          tc.hidden ? '[hidden]' : tc.input,
        expectedOutput: tc.hidden ? '[hidden]' : tc.expectedOutput,
        actualOutput:   tc.hidden && !isPass ? '[wrong]' : actualOutput,
        passed:         isPass,
        hidden:         tc.hidden || false,
        executionTimeMs,
      });
    } catch (err) {
      logger.warn(`[code-executor] test case failed: ${err.message}`);
      testResults.push({
        input: tc.hidden ? '[hidden]' : tc.input,
        expectedOutput: tc.hidden ? '[hidden]' : tc.expectedOutput,
        actualOutput: `Error: ${err.message}`,
        passed: false,
        hidden: tc.hidden || false,
        executionTimeMs: null,
      });
    }
  }

  return {
    testResults,
    codeScore: {
      passed,
      total:    testCases.length,
      timeMs:   null,
      memoryKb: null,
    },
  };
}

module.exports = { run, LANGUAGE_MAP };
