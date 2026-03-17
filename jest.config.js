/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/tests/e2e/**/*.test.js',
  ],
  // Don't transform node_modules
  transformIgnorePatterns: ['/node_modules/'],
  // Timeout per test — agent tests may hit real FS; e2e tests spin up an app
  testTimeout: 15_000,
  // Clear mocks between tests to prevent state leakage
  clearMocks: true,
  restoreMocks: true,
  // Each test file gets its own isolated module registry (default true for Jest)
  // Prevents cross-test mock contamination without explicit resetModules()
};
