/**
 * Jest configuration for integration tests against a real PostgreSQL database.
 *
 * Unlike the unit test config (jest.config.js), this does NOT mock the database
 * module. Instead, jest.setup.integration.js connects to a real PostgreSQL
 * instance (configured via PGHOST / PGPORT / PGDATABASE env vars), applies
 * pending migrations, creates the PgWrapper, and injects it into the server.
 *
 * Run with:
 *   npm run test:integration
 *
 * Prerequisites:
 *   - A running PostgreSQL instance with the rupeefast database
 *   - PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD env vars set
 *   - Migrations should already be applied (npm run migrate:up)
 *
 * In CI, the PostgreSQL service container is started automatically and
 * migrations are applied in a separate workflow step before this runs.
 */
module.exports = {
  displayName: 'integration',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/__tests__/integration/**/*.test.js'],
  setupFiles: ['<rootDir>/jest.setup.integration.js'],
  // Integration tests connect to a real database; give them more time
  testTimeout: 30000,
  verbose: true,
  // Don't mock anything — this is a real integration test
  resetMocks: false,
  resetModules: false,
  // Disable coverage for integration tests (they test the real stack,
  // and coverage is better collected from unit tests)
  collectCoverage: false,
};
