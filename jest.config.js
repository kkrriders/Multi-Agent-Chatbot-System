/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/unit/**/*.test.js'],
  // Don't transform node_modules
  transformIgnorePatterns: ['/node_modules/'],
  // Timeout per test — agent tests may hit real FS
  testTimeout: 10_000,
  // Clear mocks between tests to prevent state leakage
  clearMocks: true,
  restoreMocks: true,
};
