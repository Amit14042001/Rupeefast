const { Pool } = require('pg');
const logger = require('./logger');

let pool;

/**
 * PostgreSQL wrapper that mimics the sqlite API (get, all, run, exec)
 * so the rest of the server code doesn't need to change.
 */
class PgWrapper {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Fetch a single row. Returns the row object or undefined.
   * Usage: await db.get('SELECT * FROM users WHERE id = $1', [id])
   */
  async get(sql, params = []) {
    const result = await this.pool.query(sql, params);
    return result.rows[0];
  }

  /**
   * Fetch all matching rows. Returns an array of row objects.
   * Usage: await db.all('SELECT * FROM loans WHERE borrower_id = $1', [id])
   */
  async all(sql, params = []) {
    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  /**
   * Execute a write query (INSERT, UPDATE, DELETE).
   * If the query includes RETURNING, the affected rows are returned.
   * Usage: await db.run('INSERT INTO users (mobile, role) VALUES ($1, $2) RETURNING id', [mobile, role])
   * Returns an object with { lastID, rowCount, rows }.
   */
  async run(sql, params = []) {
    const result = await this.pool.query(sql, params);
    return {
      lastID: result.rows[0]?.id || result.rows[0]?.loan_id || null,
      rowCount: result.rowCount,
      rows: result.rows
    };
  }

  /**
   * Execute raw SQL (for schema setup, no params).
   * Usage: await db.exec('CREATE TABLE IF NOT EXISTS ...')
   */
  async exec(sql) {
    await this.pool.query(sql);
  }
}

/**
 * Initialize the PostgreSQL connection pool and create the schema.
 * Reads connection config from environment variables.
 */
async function setupDB() {
  const poolConfig = {
    max: parseInt(process.env.PGPOOL_MAX, 10) || 20,
    idleTimeoutMillis: parseInt(process.env.PGPOOL_IDLE_TIMEOUT, 10) || 30000,
    connectionTimeoutMillis: parseInt(process.env.PGPOOL_CONNECT_TIMEOUT, 10) || 5000,
  };

  const connectionString = process.env.DATABASE_URL;
  
  if (connectionString) {
    pool = new Pool({ connectionString, ...poolConfig });
  } else {
    pool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432'),
      database: process.env.PGDATABASE || 'rupeefast',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      ...poolConfig,
    });
  }

  logger.info('Connecting to PostgreSQL...');

  // Test the connection
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    logger.info('PostgreSQL connection established.');
  } finally {
    client.release();
  }

  const db = new PgWrapper(pool);

  // Run pending migrations on startup
  logger.info('Checking for pending database migrations...');
  const { runMigrations } = require('./migrate');
  try {
    const applied = await runMigrations(pool);
    if (applied > 0) {
      logger.info({ applied }, 'Database migrations applied successfully.');
    } else {
      logger.info('Database schema is up to date.');
    }
  } catch (err) {
    // Check if this is a fresh DB with no schema at all
    try {
      const checkClient = await pool.connect();
      try {
        const result = await checkClient.query(
          `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '_migrations')`
        );
        if (!result.rows[0].exists) {
          // Fresh deployment with no existing schema — crash hard rather than silently starting with zero tables
          logger.error(err, 'Migration failed on fresh database — cannot continue without schema');
          throw err;
        }
      } finally {
        checkClient.release();
      }
    } catch (checkErr) {
      if (checkErr !== err) {
        // Connection/query error, not the re-thrown migration error
        logger.error(checkErr, 'Failed to check database state after migration error');
      }
      throw checkErr;
    }
    logger.warn(err, 'Migration check failed — continuing with existing schema');
  }

  return db;
}

/**
 * Gracefully close the pool (for shutdown).
 */
async function closeDB() {
  if (pool) {
    await pool.end();
    logger.info('PostgreSQL pool closed.');
  }
}

module.exports = setupDB;
module.exports.closeDB = closeDB;
module.exports.getPool = () => pool;
