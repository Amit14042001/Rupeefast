#!/usr/bin/env node
/**
 * RupeeFast Database Migration Runner
 *
 * Usage:
 *   node src/migrate.js up          # Run all pending migrations
 *   node src/migrate.js down        # Rollback the last migration batch
 *   node src/migrate.js status      # Show migration status
 *   node src/migrate.js create <name>  # Scaffold new migration files
 *   node src/migrate.js --help      # Show help
 *
 * Programmatic usage (called from database.js on startup):
 *   const { runMigrations } = require('./migrate');
 *   await runMigrations(pool);      // Returns number of migrations applied
 *
 * Migration file format:
 *   migrations/NNNN_description.up.sql
 *   migrations/NNNN_description.down.sql
 */

const fs = require('fs');
const path = require('path');

// Bootstrap: load .env before anything else
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const { Pool } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const TRACKING_TABLE = '_migrations';

// ── Pool creation (mirrors database.js config) ──
function createPool() {
  const poolConfig = {
    max: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: parseInt(process.env.PGPOOL_CONNECT_TIMEOUT, 10) || 5000,
  };

  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL, ...poolConfig });
  }
  return new Pool({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432'),
    database: process.env.PGDATABASE || 'rupeefast',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    ...poolConfig,
  });
}

// ── Parse migration files ──
function getMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(MIGRATIONS_DIR);
  const migrationMap = new Map();

  for (const file of files) {
    // Match: NNNN_description.up.sql or NNNN_description.down.sql
    const match = file.match(/^(\d{4})_(.+)\.(up|down)\.sql$/);
    if (!match) continue;

    const [, seq, desc, direction] = match;
    const key = `${seq}_${desc}`;

    if (!migrationMap.has(key)) {
      migrationMap.set(key, { seq: parseInt(seq, 10), desc, up: null, down: null });
    }

    const entry = migrationMap.get(key);
    entry[direction] = path.join(MIGRATIONS_DIR, file);
  }

  // Sort by sequence number ascending
  return Array.from(migrationMap.values())
    .filter(m => m.up !== null) // Must have at least an up file
    .sort((a, b) => a.seq - b.seq);
}

// ── Ensure tracking table exists ──
async function ensureTrackingTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
      id          SERIAL PRIMARY KEY,
      seq         INTEGER NOT NULL,
      description TEXT NOT NULL,
      direction   TEXT NOT NULL DEFAULT 'up' CHECK(direction IN ('up', 'down')),
      applied_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      checksum    TEXT,
      UNIQUE(seq, direction)
    )
  `);
}

// ── Get applied migrations ──
async function getApplied(client) {
  const result = await client.query(
    `SELECT seq, description, direction, applied_at, checksum
     FROM ${TRACKING_TABLE}
     WHERE direction = 'up'
     ORDER BY seq ASC`
  );
  return result.rows;
}

// ── Record a migration ──
async function recordMigration(client, seq, desc, direction, checksum) {
  await client.query(
    `INSERT INTO ${TRACKING_TABLE} (seq, description, direction, checksum)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (seq, direction) DO UPDATE SET
       applied_at = CURRENT_TIMESTAMP,
       checksum = EXCLUDED.checksum`,
    [seq, desc, direction, checksum]
  );
}

// ── Remove a migration record ──
async function removeMigration(client, seq) {
  await client.query(
    `DELETE FROM ${TRACKING_TABLE} WHERE seq = $1 AND direction = 'up'`,
    [seq]
  );
}

// ── Compute a simple checksum for a file ──
function checksum(content) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

// ── Read SQL content from a file ──
function readSQL(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8').trim();
}

// ══════════════════════════════════════════════════
// COMMANDS
// ══════════════════════════════════════════════════

/**
 * Run all pending migrations (up).
 * Executes each migration's .up.sql in sequence order.
 * Each migration runs in its own transaction for atomicity.
 */
async function cmdUp(pool) {
  const client = await pool.connect();
  try {
    await ensureTrackingTable(client);
    const all = getMigrations();
    const applied = await getApplied(client);
    const appliedSeqs = new Set(applied.map(m => m.seq));

    const pending = all.filter(m => !appliedSeqs.has(m.seq));

    if (pending.length === 0) {
      console.log('✓ All migrations have been applied. Nothing to do.');
      return { applied: 0 };
    }

    console.log(`\nRunning ${pending.length} pending migration(s)...\n`);

    for (const mig of pending) {
      const sql = readSQL(mig.up);
      if (!sql) {
        console.warn(`  ⚠  ${mig.seq}_${mig.desc}.up.sql is empty — skipping`);
        continue;
      }

      const chk = checksum(sql);
      console.log(`  ↑ ${mig.seq}_${mig.desc} — applying...`);

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await recordMigration(client, mig.seq, mig.desc, 'up', chk);
        await client.query('COMMIT');
        console.log(`  ✓ ${mig.seq}_${mig.desc} applied`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ✗ ${mig.seq}_${mig.desc} FAILED: ${err.message}`);
        throw err;
      }
    }

    console.log('\n✓ All pending migrations applied successfully.\n');
    return { applied: pending.length };
  } finally {
    client.release();
  }
}

/**
 * Rollback the last batch of migrations (down).
 * Rolls back one migration at a time from the most recent applied.
 */
async function cmdDown(pool, steps = 1) {
  const client = await pool.connect();
  try {
    await ensureTrackingTable(client);
    const all = getMigrations();
    const applied = await getApplied(client);

    if (applied.length === 0) {
      console.log('✓ No migrations to roll back.');
      return { rolledBack: 0 };
    }

    const toRollback = applied.slice(-steps).reverse();

    console.log(`\nRolling back ${toRollback.length} migration(s)...\n`);

    for (const record of toRollback) {
      const mig = all.find(m => m.seq === record.seq);
      if (!mig) {
        console.warn(`  ⚠  ${record.seq}_${record.description} — no migration files found, skipping`);
        continue;
      }

      const sql = readSQL(mig.down);
      if (!sql) {
        console.warn(`  ⚠  ${mig.seq}_${mig.desc}.down.sql is empty — skipping`);
        continue;
      }

      console.log(`  ↓ ${mig.seq}_${mig.desc} — rolling back...`);

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await removeMigration(client, mig.seq);
        await client.query('COMMIT');
        console.log(`  ✓ ${mig.seq}_${mig.desc} rolled back`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ✗ ${mig.seq}_${mig.desc} FAILED: ${err.message}`);
        throw err;
      }
    }

    console.log('\n✓ Rollback complete.\n');
    return { rolledBack: toRollback.length };
  } finally {
    client.release();
  }
}

/**
 * Show the status of all migrations (applied vs pending).
 */
async function cmdStatus(pool) {
  const client = await pool.connect();
  try {
    await ensureTrackingTable(client);
    const all = getMigrations();
    const applied = await getApplied(client);
    const appliedSeqs = new Set(applied.map(m => m.seq));

    if (all.length === 0) {
      console.log('No migration files found in:', MIGRATIONS_DIR);
      return;
    }

    console.log('\nMigration Status\n');
    console.log('  Seq   Description                    Status     Applied At');
    console.log('  ────  ─────────────────────────────  ─────────  ───────────────────────');

    for (const mig of all) {
      const isApplied = appliedSeqs.has(mig.seq);
      const record = applied.find(m => m.seq === mig.seq);
      const status = isApplied ? '✓ APPLIED' : '○ PENDING';
      const timestamp = record ? new Date(record.applied_at).toISOString().replace('T', ' ').slice(0, 22) : '';
      const label = `${mig.seq}_${mig.desc}`.padEnd(35);
      console.log(`  ${label} ${status.padEnd(9)} ${timestamp}`);
    }

    const appliedCount = applied.length;
    const pendingCount = all.length - appliedCount;
    console.log(`\n  ${appliedCount} applied, ${pendingCount} pending\n`);
  } finally {
    client.release();
  }
}

/**
 * Scaffold a new migration.
 * Creates NNNN_name.up.sql and NNNN_name.down.sql in the migrations directory.
 */
function cmdCreate(name) {
  if (!name || name.length < 2) {
    console.error('Error: Migration name is required (min 2 chars).');
    console.log('  Usage: node src/migrate.js create add_user_preferences');
    process.exit(1);
  }

  // Sanitize: lowercase, replace spaces/special chars with underscores
  const safeName = name
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_|_$/g, '');

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
  }

  // Get next sequence number
  const existing = fs.readdirSync(MIGRATIONS_DIR);
  const maxSeq = existing.reduce((max, f) => {
    const m = f.match(/^(\d{4})_/);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);
  const nextSeq = String(maxSeq + 1).padStart(4, '0');

  const upPath = path.join(MIGRATIONS_DIR, `${nextSeq}_${safeName}.up.sql`);
  const downPath = path.join(MIGRATIONS_DIR, `${nextSeq}_${safeName}.down.sql`);

  const template = `-- Migration ${nextSeq}: ${safeName}
-- 
-- Describe what this migration does here.
-- Be specific about what tables/columns/indexes are affected.

-- migrate:up
-- (write your UP migration SQL here)

`;

  const downTemplate = `-- Migration ${nextSeq}: ${safeName} (DOWN)
--
-- Undo the changes made in the UP migration.
-- Drop tables/columns/indexes in reverse creation order.

-- migrate:down
-- (write your DOWN migration SQL here)

`;

  fs.writeFileSync(upPath, template);
  fs.writeFileSync(downPath, downTemplate);

  console.log(`\n  Created: ${upPath}`);
  console.log(`  Created: ${downPath}`);
  console.log(`\n  Next steps:\n    1. Edit ${nextSeq}_${safeName}.up.sql with your schema changes`);
  console.log(`    2. Edit ${nextSeq}_${safeName}.down.sql with the rollback SQL`);
  console.log(`    3. Run: node src/migrate.js up\n`);
}

function showHelp() {
  console.log(`
RupeeFast Database Migration Runner

  Usage:
    node src/migrate.js up              Run all pending migrations
    node src/migrate.js down            Rollback the last migration
    node src/migrate.js down --all      Rollback all migrations
    node src/migrate.js status          Show migration status
    node src/migrate.js create <name>   Scaffold new migration files
    node src/migrate.js --help          Show this help

  Examples:
    node src/migrate.js create add_user_email
    node src/migrate.js up
    node src/migrate.js status
`);
}

// ══════════════════════════════════════════════════
// SERVER INTEGRATION
// ══════════════════════════════════════════════════

/**
 * Run pending migrations programmatically (called from database.js on startup).
 * @param {Pool} pool - An active pg.Pool instance
 * @returns {Promise<number>} Number of migrations applied
 */
async function runMigrations(pool) {
  const client = await pool.connect();
  try {
    await ensureTrackingTable(client);
    const all = getMigrations();
    const applied = await getApplied(client);
    const appliedSeqs = new Set(applied.map(m => m.seq));

    const pending = all.filter(m => !appliedSeqs.has(m.seq));

    if (pending.length === 0) return 0;

    const logger = require('./logger');
    logger.info({ pending: pending.length }, 'Running pending database migrations...');

    for (const mig of pending) {
      const sql = readSQL(mig.up);
      if (!sql) {
        logger.warn({ migration: `${mig.seq}_${mig.desc}` }, 'Migration file is empty, skipping');
        continue;
      }

      const chk = checksum(sql);

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await recordMigration(client, mig.seq, mig.desc, 'up', chk);
        await client.query('COMMIT');
        logger.info({ migration: `${mig.seq}_${mig.desc}` }, 'Migration applied');
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error({ err, migration: `${mig.seq}_${mig.desc}` }, 'Migration failed');
        throw err;
      }
    }

    logger.info({ applied: pending.length }, 'Pending migrations completed');
    return pending.length;
  } finally {
    client.release();
  }
}

// ══════════════════════════════════════════════════
// CLI ENTRY POINT
// ══════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    showHelp();
    process.exit(0);
  }

  const pool = createPool();

  (async () => {
    try {
      switch (command) {
        case 'up':
          await cmdUp(pool);
          break;

        case 'down': {
          const steps = args.includes('--all') ? 9999 : (parseInt(args[1], 10) || 1);
          await cmdDown(pool, steps);
          break;
        }

        case 'status':
          await cmdStatus(pool);
          break;

        case 'create':
          cmdCreate(args[1]);
          break;

        default:
          console.error(`Unknown command: "${command}"`);
          showHelp();
          process.exit(1);
      }
    } catch (err) {
      console.error('Migration error:', err.message);
      process.exit(1);
    } finally {
      await pool.end();
    }
  })();
}

/**
 * Get migration status for the health endpoint.
 * Queries the _migrations tracking table and cross-references against
 * migration files on disk to report applied vs pending counts.
 * @param {Pool} pool - An active pg.Pool instance
 * @returns {Promise<{applied: number, pending: number, latest: object|null}>}
 */
async function getMigrationStatus(pool) {
  const result = {
    applied: 0,
    pending: 0,
    latest: null,
  };

  let client;
  try {
    client = await pool.connect();
  } catch {
    // Pool might not be connected yet
    return result;
  }

  try {
    // Check if tracking table exists
    const tableCheck = await client.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '_migrations')`
    );
    if (!tableCheck.rows[0].exists) {
      return result;
    }

    const appliedRows = await client.query(
      `SELECT seq, description, applied_at
       FROM _migrations
       WHERE direction = 'up'
       ORDER BY seq ASC`
    );

    result.applied = appliedRows.rows.length;

    if (appliedRows.rows.length > 0) {
      const latestRow = appliedRows.rows[appliedRows.rows.length - 1];
      result.latest = {
        seq: latestRow.seq,
        description: latestRow.description,
        applied_at: latestRow.applied_at,
      };
    }

    // Cross-reference with migration files on disk to get pending count
    const allMigrations = getMigrations();
    const appliedSeqs = new Set(appliedRows.rows.map(r => r.seq));
    result.pending = allMigrations.filter(m => !appliedSeqs.has(m.seq)).length;
  } catch {
    // Table query might fail if it doesn't exist yet
  } finally {
    client.release();
  }

  return result;
}

module.exports = { runMigrations, getMigrationStatus };
