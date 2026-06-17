module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/config/**',
    // Queue/worker infra requires a live Redis and is exercised by the
    // running stack rather than unit tests.
    '!src/queue/**',
    '!src/workers/**',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  setupFiles: ['dotenv/config'],
  verbose: true,
};
