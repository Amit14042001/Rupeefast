/**
 * RupeeFast — Server Entry Point
 *
 * Lightweight orchestrator that wires together:
 *   - Middleware: Helmet, CORS, Sentry, Rate Limiter, Metrics, Logging
 *   - API Routes: auth, loans, payments, kyc, credit, webhooks
 *   - Admin Routes: loans, notifications, investors, system management
 *   - Workers: Bull queue background job processing
 *   - Services: auth, rate-limiter, webhook-dedup
 *   - Integrations: Razorpay (re-exported)
 *
 * Graceful shutdown handles DB, Redis, Bull queues, Sentry, and logger flush.
 */

const fs = require('fs');

// Auto-create .env from .env.example if it doesn't exist
const envPath = __dirname + '/../.env';
const envExamplePath = __dirname + '/../.env.example';
if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  fs.copyFileSync(envExamplePath, envPath);
  console.log('Created .env from .env.example — edit it with your credentials');
}

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { rateLimit } = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;

const setupDB = require('./database');
const redis = require('./redis');
const logger = require('./logger');
const metrics = require('./metrics');
const sentry = require('./sentry');

// ── Shared services ──
const { createWebhookDedup } = require('./services/webhook-dedup');
const { isWebhookProcessed } = createWebhookDedup(redis);

// ── Route registrars ──
const registerAuthRoutes = require('./api/auth');
const registerLoanRoutes = require('./api/loans');
const registerPaymentRoutes = require('./api/payments');
const registerKycRoutes = require('./api/kyc');
const registerCreditRoutes = require('./api/credit');
const registerWebhookRoutes = require('./api/webhooks');
const registerOfferRoutes = require('./api/offers');
const registerCollectionRoutes = require('./api/collections');
const registerAdminLoanRoutes = require('./api/admin/loans');
const registerAdminNotificationRoutes = require('./api/admin/notifications');
const registerAdminInvestorRoutes = require('./api/admin/investors');
const registerAdminSystemRoutes = require('./api/admin/admin');
const registerAdminFraudRoutes = require('./api/admin/fraud');

// ── Workers (lazy — started after server is ready) ──
let workersStarted = false;

const app = express();
const PORT = process.env.PORT || 3000;

// ── JWT Secret: MUST be set in production ──
const rawJWTSecret = process.env.JWT_SECRET;
const isDefaultDevSecret = !rawJWTSecret || rawJWTSecret === 'rupeefast-dev-secret-change-in-production' || rawJWTSecret === 'rupeefast-docker-secret-change-in-production';

if (isDefaultDevSecret && process.env.NODE_ENV === 'production') {
  console.error('FATAL: JWT_SECRET environment variable is not set or is using the default/dev secret.');
  console.error('Set a strong, unique JWT_SECRET before deploying to production.');
  process.exit(1);
}
if (isDefaultDevSecret) {
  console.warn('WARNING: Using default JWT_SECRET for development only.');
}

const JWT_SECRET = rawJWTSecret || 'rupeefast-dev-secret-change-in-production';
const JWT_EXPIRY = '24h';

const ALLOW_MOCK_OTP = process.env.ALLOW_MOCK_OTP === 'true';
if (ALLOW_MOCK_OTP) {
  logger.warn('Mock OTP is ENABLED — any 6-digit code will be accepted. Set ALLOW_MOCK_OTP=false in production.');
}

// ── Allowed origins for CORS ──
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(',').map(s => s.trim());

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));

// ── Security headers via Helmet ──
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      frameSrc: ["'self'", 'https://api.razorpay.com'],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ── Raw body capture for webhook routes (must be before bodyParser) ──
app.use((req, res, next) => {
  if (req.url.startsWith('/api/webhooks/')) {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => { req.rawBody = data; next(); });
  } else {
    next();
  }
});

app.use(bodyParser.json());

// ── Sentry Request Handler ──
app.use(sentry.requestHandler);

// ── Request ID Middleware ──
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID().slice(0, 8);
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// ── Metrics middleware (tracks HTTP request duration, active requests) ──
app.use(metrics.middleware);

// ── Metrics endpoint (Prometheus scraper — no auth, no rate limit) ──
app.get('/api/metrics', metrics.handler);

// ── Sentry Tracing Handler ──
app.use(sentry.tracingHandler);

// ── Structured Request Logger ──
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const logData = {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent']?.slice(0, 100),
      userId: req.user?.id || null,
    };
    if (res.statusCode >= 500) logger.error(logData, 'request');
    else if (res.statusCode >= 400) logger.warn(logData, 'request');
    else logger.info(logData, 'request');
  });
  next();
});

// ═══════════════════════════════════════════════
// SHARED MIDDLEWARE & HELPERS
// ═══════════════════════════════════════════════

let db;

/**
 * Set the database instance (used by tests to inject a mock database).
 */
function setDb(database) {
  db = database;
}

/**
 * Generate a JWT for a given user.
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, mobile: user.mobile, role: user.role, jti: crypto.randomUUID() },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

/**
 * Upsert user by mobile number — creates if not exists, returns existing if found.
 */
async function upsertUser(mobile, role) {
  let user = await db.get('SELECT * FROM users WHERE mobile = $1', [mobile]);
  if (!user) {
    const result = await db.run(
      'INSERT INTO users (mobile, role) VALUES ($1, $2) RETURNING id',
      [mobile, role || 'borrower']
    );
    user = { id: result.lastID, mobile, role: role || 'borrower' };
    metrics.usersCreated.inc();
  }
  return user;
}

/**
 * JWT Authentication Middleware
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.jti) {
      const blacklistKey = `token:blacklist:${decoded.jti}`;

      if (redis.getStatus().connected) {
        redis.get(blacklistKey).then((revoked) => {
          if (revoked) return res.status(401).json({ error: 'Token has been revoked' });
          req.user = decoded;
          next();
        }).catch(() => { req.user = decoded; next(); });
        return;
      }

      if (db) {
        db.get('SELECT id FROM token_blacklist WHERE jti = $1 AND expires_at > CURRENT_TIMESTAMP', [decoded.jti])
          .then((row) => {
            if (row) return res.status(401).json({ error: 'Token has been revoked' });
            req.user = decoded;
            next();
          })
          .catch(() => { req.user = decoded; next(); });
        return;
      }
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ═══════════════════════════════════════════════
// CONTEXT OBJECT (shared with all route modules)
// ═══════════════════════════════════════════════

const ctx = {
  get db() { return db; },
  redis,
  metrics,
  authMiddleware,
  generateToken,
  upsertUser,
  ALLOW_MOCK_OTP,
  isWebhookProcessed,
};

// ═══════════════════════════════════════════════
// RATE LIMITER SETUP
// ═══════════════════════════════════════════════

let loginLimiter, generalLimiter, paymentLimiter;

function createRateLimiter(options) {
  const redisClient = redis.getClient();
  const store = redisClient && redis.getStatus().connected
    ? new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
        prefix: `rl:${options.prefix || 'gen'}:`,
      })
    : undefined;

  return rateLimit({
    windowMs: options.windowMs,
    limit: parseInt(options.envLimit, 10) || options.defaultLimit,
    message: { error: options.message },
    standardHeaders: true,
    legacyHeaders: false,
    store,
    requestWasSuccessful: options.requestWasSuccessful,
    ...(options.skipFailedRequests ? { skipFailedRequests: true } : {}),
  });
}

// ═══════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════

// ── Health Check (Public) ──
app.get('/api/health', async (req, res) => {
  const health = { status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() };

  if (db) {
    try {
      await db.get('SELECT 1');
      health.database = 'connected';
      try {
        const { getMigrationStatus } = require('./migrate');
        if (db.pool) {
          health.migrations = await getMigrationStatus(db.pool);
        }
      } catch (migErr) {
        health.migrations = { applied: 0, pending: 0, latest: null, error: migErr.message };
      }
    } catch (err) {
      health.database = 'disconnected';
      health.status = 'degraded';
    }
  } else {
    health.database = 'not_initialized';
  }

  try {
    const redisPing = await redis.ping();
    health.redis = redisPing ? 'connected' : 'disconnected';
  } catch {
    health.redis = 'disconnected';
  }

  res.status(health.status === 'ok' ? 200 : 503).json(health);
});

// ── Auth routes ──
const authRouter = express.Router();
registerAuthRoutes(authRouter, ctx);
app.use('/api/auth', authRouter);

// ── Loan routes (dashboard + apply + disburse) ──
const loanRouter = express.Router();
registerLoanRoutes(loanRouter, ctx);
app.use('/api', loanRouter); // dashboard is at /api/user/:id/dashboard

// ── Payment routes ──
const paymentRouter = express.Router();
registerPaymentRoutes(paymentRouter, ctx);
app.use('/api/payments', paymentRouter);

// ── KYC routes ──
const kycRouter = express.Router();
registerKycRoutes(kycRouter, ctx);
app.use('/api/kyc', kycRouter);

// ── Credit routes ──
const creditRouter = express.Router();
registerCreditRoutes(creditRouter, ctx);
app.use('/api/credit', creditRouter);

// ── Webhook routes (raw body already captured by middleware) ──
const webhookRouter = express.Router();
registerWebhookRoutes(webhookRouter, ctx);
app.use('/api/webhooks', webhookRouter);

// ── Loan Offer routes ──
const offerRouter = express.Router();
registerOfferRoutes(offerRouter, ctx);
app.use('/api/offers', offerRouter);

// ── Collection Log routes ──
const collectionRouter = express.Router();
registerCollectionRoutes(collectionRouter, ctx);
app.use('/api/collections', collectionRouter);

// ═══════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════

// Admin loan review workflows
const adminLoanRouter = express.Router();
registerAdminLoanRoutes(adminLoanRouter, ctx);
app.use('/api/admin', adminLoanRouter);

// Admin notification management
const adminNotificationRouter = express.Router();
registerAdminNotificationRoutes(adminNotificationRouter, ctx);
app.use('/api/admin/notifications', adminNotificationRouter);

// Admin investor dashboard
const adminInvestorRouter = express.Router();
registerAdminInvestorRoutes(adminInvestorRouter, ctx);
app.use('/api/admin/investors', adminInvestorRouter);

// Admin system management (API keys, webhooks, services, integrations)
const adminSystemRouter = express.Router();
registerAdminSystemRoutes(adminSystemRouter, ctx);
app.use('/api/admin', adminSystemRouter);

// Admin fraud event management
const adminFraudRouter = express.Router();
registerAdminFraudRoutes(adminFraudRouter, ctx);
app.use('/api/admin/fraud', adminFraudRouter);

// ═══════════════════════════════════════════════
// STATIC FILES & SPA FALLBACK
// ═══════════════════════════════════════════════

const assetsPath = path.join(__dirname, '..', '..', 'app', 'src', 'main', 'assets');
app.use(express.static(assetsPath));

app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(assetsPath, 'index.html'));
});

// ═══════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════

// Sentry error handler (MUST be before global handler)
app.use(sentry.errorHandler);

// Global error handler
app.use((err, req, res, next) => {
  const errorData = {
    err: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    requestId: req.requestId,
    userId: req.user?.id,
  };
  logger.error(errorData, 'Unhandled error');
  metrics.errorsTotal.inc('api');
  sentry.captureError(err, { requestId: req.requestId, url: req.url, method: req.method });
  res.status(500).json({ error: 'Internal server error' });
});

// ═══════════════════════════════════════════════
// SERVER START & GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════

let server;

async function start() {
  // Connect to Redis (non-blocking — graceful fallback if unavailable)
  try {
    await redis.connect();
    logger.info('Redis connected — rate limiting is cluster-aware');
  } catch (err) {
    logger.warn({ err: err.message }, 'Redis unavailable — rate limiting falls back to in-memory (not cluster-safe)');
  }

  // Create rate limiters AFTER Redis connects (so they use Redis-backed store)
  loginLimiter = createRateLimiter({
    prefix: 'login',
    windowMs: 15 * 60 * 1000,
    envLimit: process.env.LOGIN_RATE_LIMIT,
    defaultLimit: 5,
    message: 'Too many login attempts. Please try again after 15 minutes.',
    requestWasSuccessful: (req, res) => res.statusCode < 400,
  });

  generalLimiter = createRateLimiter({
    prefix: 'general',
    windowMs: 60 * 1000,
    envLimit: process.env.GENERAL_RATE_LIMIT,
    defaultLimit: 60,
    message: 'Too many requests. Please slow down.',
  });

  paymentLimiter = createRateLimiter({
    prefix: 'payment',
    windowMs: 60 * 1000,
    envLimit: process.env.PAYMENT_RATE_LIMIT,
    defaultLimit: 10,
    message: 'Too many payment requests. Please try again later.',
  });

  // Apply rate limiters to routes
  app.use('/api/auth/', loginLimiter);
  app.use('/api/', generalLimiter);
  app.use('/api/payments/', paymentLimiter);
  app.use('/api/loans/', generalLimiter);

  try {
    db = await setupDB();
    server = app.listen(PORT, () => {
      logger.info(`RupeeFast running on http://localhost:${PORT}`);
      logger.info(`Frontend: http://localhost:${PORT}`);
      logger.info(`API:      http://localhost:${PORT}/api`);
      logger.info(`Health:   http://localhost:${PORT}/api/health`);
    });

    // Start background workers (non-blocking)
    startWorkers();
  } catch (err) {
    logger.error(err, 'Failed to start server');
    logger.info('Frontend will still serve static files.');
    server = app.listen(PORT, () => {
      logger.info(`RupeeFast frontend running on http://localhost:${PORT} (DB unavailable)`);
    });
  }

  // ── Graceful Shutdown ──
  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutdown signal received. Closing gracefully...');
    server.close(async () => {
      logger.info('HTTP server closed.');

      // Close Bull queues
      try {
        const { closeAll } = require('./workers/queue');
        await closeAll();
      } catch (e) { /* queue module may not be loaded */ }

      try {
        const { closeDB } = require('./database');
        await closeDB();
      } catch (e) { /* DB might not be initialized */ }

      try {
        await redis.close();
      } catch (e) { /* Redis might not be initialized */ }

      try {
        await sentry.close();
      } catch (e) { /* Sentry might not be initialized */ }

      await logger.flushAndClose();
      logger.info('Goodbye.');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

/**
 * Start Bull background workers if Redis is available.
 * Called once DB is connected and server is listening.
 */
function startWorkers() {
  if (workersStarted) return;
  workersStarted = true;

  if (!redis.getStatus().connected) {
    logger.info('Bull workers skipped — Redis not connected');
    return;
  }

  try {
    const { getQueue } = require('./workers/queue');

    const q = getQueue('webhook');
    if (q) {
      const registerWebhookWorker = require('./workers/webhook-worker');
      registerWebhookWorker(q, db);
      logger.info('Webhook worker registered');
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to start Bull workers (non-fatal)');
  }
}

// Only start the server when run directly (not when required as a module)
if (require.main === module) {
  start();
}

module.exports = { app, setDb };
