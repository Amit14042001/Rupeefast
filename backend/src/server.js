const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const setupDB = require('./database');
const pino = require('pino');
const logger = pino({ transport: { target: 'pino-pretty' } });

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

let db;

// ══════════════════════════════════════════════════
// MIDDLEWARE & HELPERS
// ══════════════════════════════════════════════════

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// ══════════════════════════════════════════════════
// API ROUTES
// ══════════════════════════════════════════════════

// 1. Authentication (Mock OTP for now)
app.post('/api/auth/login', async (req, res) => {
  const { mobile, role } = req.body;
  if (!mobile) return res.status(400).json({ error: 'Mobile required' });

  try {
    let user = await db.get('SELECT * FROM users WHERE mobile = ?', [mobile]);
    if (!user) {
      const result = await db.run(
        'INSERT INTO users (mobile, role) VALUES (?, ?)',
        [mobile, role || 'borrower']
      );
      user = { id: result.lastID, mobile, role: role || 'borrower' };
    }
    res.json({ success: true, user, message: 'OTP Sent (Mock)' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Fetch Dashboard Data
app.get('/api/user/:id/dashboard', async (req, res) => {
  const userId = req.params.id;
  try {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let data = { user };
    if (user.role === 'borrower') {
      data.activeLoan = await db.get('SELECT * FROM loans WHERE borrower_id = ? AND status = "active"', [userId]);
      data.recentRepayments = await db.all('SELECT * FROM repayments WHERE loan_id = (SELECT id FROM loans WHERE borrower_id = ? AND status = "active") LIMIT 5', [userId]);
    } else if (user.role === 'investor') {
      data.investments = await db.all('SELECT * FROM investments WHERE investor_id = ?', [userId]);
      data.totalEarned = 1455; // Mock for now
    } else if (user.role === 'agent') {
      data.tasks = await db.all('SELECT * FROM agent_tasks WHERE agent_id = ? AND status = "pending"', [userId]);
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Create Loan Application
app.post('/api/loans/apply', async (req, res) => {
  const { borrower_id, amount, plan, purpose } = req.body;
  try {
    const result = await db.run(
      'INSERT INTO loans (borrower_id, amount, repayment_plan, purpose, status) VALUES (?, ?, ?, ?, "applied")',
      [borrower_id, amount, plan, purpose]
    );
    res.json({ success: true, loan_id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════
// SERVER START
// ══════════════════════════════════════════════════

async function start() {
  db = await setupDB();
  app.listen(PORT, () => {
    logger.info(`RupeeFast API running on http://localhost:${PORT}`);
  });
}

start();
