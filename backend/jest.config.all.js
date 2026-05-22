/**
 * Combined Jest configuration that runs both backend API and frontend UI test suites.
 * Coverage is automatically merged across both environments (node + jsdom).
 */
module.exports = {
  // Reference both existing configs as independent projects
  projects: [
    '<rootDir>/jest.config.js',
    '<rootDir>/jest.config.frontend.js',
  ],

  // Coverage collection — merged across all projects
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'clover'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/rupeefast.db',
    '!src/**/*.db',
  ],

  // Fail if coverage drops below thresholds
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },

  verbose: true,
};
