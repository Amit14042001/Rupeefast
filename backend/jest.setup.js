// Silence pino logger during tests
process.env.JWT_SECRET = 'test-secret-not-for-production';
process.env.PORT = '0'; // Random port for supertest
process.env.LOGIN_RATE_LIMIT = '100'; // High limit to avoid rate limiting during tests
process.env.GENERAL_RATE_LIMIT = '1000'; // Disable general rate limiting for tests
process.env.PAYMENT_RATE_LIMIT = '1000'; // Disable payment rate limiting for tests

// Mock pino to silent logger for cleaner test output
jest.mock('pino', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => mockLogger),
  };
  return jest.fn(() => mockLogger);
});
