/**
 * Jest setup for integration tests.
 *
 * Connects to a real PostgreSQL database, runs the real setupDB() to create
 * the PgWrapper (which also applies any pending migrations), then injects
 * the real database into the server via setDb().
 *
 * The app is started on a random port (PORT=0) to avoid port conflicts.
 *
 * In CI, this runs after the `npm run migrate:up` step, so all migrations
 * (including seed data) are already applied. The setupDB() will find zero
 * pending migrations and continue without reapplying anything.
 *
 * Environment variables expected:
 *   PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD (or DATABASE_URL)
 *   JWT_SECRET (or defaults to test secret)
 */

const { app, setDb } = require('./src/server');
const setupDB = require('./src/database');

// Set test-friendly env vars before anything else
process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret-not-for-production';
process.env.PORT = '0'; // random port (supertest doesn't need it, but avoids conflicts)
process.env.LOGIN_RATE_LIMIT = '10000';
process.env.GENERAL_RATE_LIMIT = '10000';
process.env.PAYMENT_RATE_LIMIT = '10000';
process.env.METRICS_ENABLED = 'false';
process.env.NODE_ENV = 'test';

let db;
let server;

beforeAll(async () => {
  try {
    // Connect to real PostgreSQL — setupDB creates the pool, PgWrapper,
    // runs any pending migrations, and returns the PgWrapper instance.
    db = await setupDB();
    setDb(db);

    // Start listening so supertest can send requests.
    // The app handles server.start internally when require.main === module,
    // but when imported as a module, we must start it ourselves.
    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });
  } catch (err) {
    console.error('Integration test setup failed:', err.message);
    console.error('Make sure PostgreSQL is running and PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD are set.');
    throw err;
  }
});

afterAll(async () => {
  // Close the HTTP server
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  // Close the database pool
  try {
    const { closeDB } = require('./src/database');
    await closeDB();
  } catch (e) {
    // Pool may not be initialized
  }
});
