module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/config/**',
    // Queue/worker/event infra requires a live Redis and is exercised by the
    // integration suite (real Redis) rather than unit tests.
    '!src/queue/**',
    '!src/workers/**',
    '!src/events/**',
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
  setupFiles: ['dotenv/config', '<rootDir>/tests/setup.env.js'],
  verbose: true,
};
