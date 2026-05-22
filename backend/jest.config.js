module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/__tests__/api*.test.js'],
  resetMocks: true,
  resetModules: true,
  setupFiles: ['<rootDir>/jest.setup.js'],
  verbose: true,
  testTimeout: 10000,
};
