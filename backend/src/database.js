const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function setupDB() {
  const db = await open({
    filename: path.join(__dirname, 'rupeefast.db'),
    driver: sqlite3.Database
  });

  console.log('Initializing RupeeFast Database Schema...');

  // 1. USERS TABLE
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mobile TEXT UNIQUE NOT NULL,
      name TEXT,
      role TEXT CHECK(role IN ('borrower', 'investor', 'agent', 'admin')),
      kyc_status TEXT DEFAULT 'pending',
      trust_score INTEGER DEFAULT 50,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. LOANS TABLE (For Borrowers)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      borrower_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      repayment_plan TEXT,
      purpose TEXT,
      status TEXT DEFAULT 'applied',
      disbursed_at DATETIME,
      total_to_repay REAL,
      remaining_balance REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(borrower_id) REFERENCES users(id)
    )
  `);

  // 3. REPAYMENTS TABLE
  await db.exec(`
    CREATE TABLE IF NOT EXISTS repayments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      due_date DATE NOT NULL,
      paid_at DATETIME,
      method TEXT, -- 'auto', 'cash', 'upi'
      agent_id INTEGER,
      FOREIGN KEY(loan_id) REFERENCES loans(id),
      FOREIGN KEY(agent_id) REFERENCES users(id)
    )
  `);

  // 4. INVESTMENTS TABLE (For Investors)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS investments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      investor_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      risk_bucket TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(investor_id) REFERENCES users(id)
    )
  `);

  // 5. AGENT_TASKS TABLE
  await db.exec(`
    CREATE TABLE IF NOT EXISTS agent_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL,
      target_user_id INTEGER,
      loan_id INTEGER,
      task_type TEXT CHECK(task_type IN ('verify', 'collect', 'recover')),
      status TEXT DEFAULT 'pending',
      location_lat REAL,
      location_lng REAL,
      otp_verified BOOLEAN DEFAULT FALSE,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(agent_id) REFERENCES users(id)
    )
  `);

  console.log('Database Schema Initialized Successfully.');
  return db;
}

if (require.main === module) {
  setupDB().catch(err => console.error(err));
}

module.exports = setupDB;
