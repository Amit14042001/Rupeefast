module.exports = {
  displayName: 'frontend',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/__tests__/frontend/**/*.test.js'],
  setupFiles: ['<rootDir>/jest.setup.frontend.js'],
  verbose: true,
  testTimeout: 10000,
  resetMocks: false,
};
