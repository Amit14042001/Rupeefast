/**
 * RupeeFast Prometheus Metrics
 *
 * Exposes /api/metrics for Prometheus scraping. Provides:
 *   - Default Node.js metrics (CPU, memory, event loop lag, garbage collection)
 *   - HTTP request duration histogram (method, route, status code)
 *   - HTTP request counter (total requests by method/route/status)
 *   - Active requests gauge
 *   - Database query duration histogram (operation type)
 *   - Business counters (loans, mandates, webhooks, errors, users)
 *
 * Usage:
 *   const metrics = require('./metrics');
 *   app.use(metrics.middleware);          // track HTTP duration
 *   app.get('/api/metrics', metrics.handler);  // expose endpoint
 *   metrics.loansApplied.inc();          // increment a counter
 */

const client = require('prom-client');
const logger = require('./logger');

const METRICS_ENABLED = process.env.METRICS_ENABLED !== 'false';

let httpDuration, httpTotal, httpActive, dbDuration;
let loansApplied, mandatesCreated, mandatesCancelled;
let webhooksReceived, paymentVerifications, errorsTotal, usersCreated;

if (METRICS_ENABLED) {
  // ── Default Node.js metrics ──
  // Collects: CPU, memory, event loop lag, garbage collection, handles, etc.
  client.collectDefaultMetrics({
    prefix: 'rupeefast_',
    gcDurationBuckets: [0.001, 0.01, 0.1, 1, 5],
  });

  // ── HTTP metrics ──
  httpDuration = new client.Histogram({
    name: 'rupeefast_http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 0.5, 1, 3, 5, 10],
  });

  httpTotal = new client.Counter({
    name: 'rupeefast_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
  });

  httpActive = new client.Gauge({
    name: 'rupeefast_http_requests_active',
    help: 'Number of HTTP requests currently being processed',
  });

  // ── Database metrics ──
  dbDuration = new client.Histogram({
    name: 'rupeefast_db_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['operation'],  // get, all, run
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  });

  // ── Business metrics ──
  loansApplied = new client.Counter({
    name: 'rupeefast_loans_applied_total',
    help: 'Total number of loan applications submitted',
  });

  loansDisbursed = new client.Counter({
    name: 'rupeefast_loans_disbursed_total',
    help: 'Total number of loans disbursed',
  });

  mandatesCreated = new client.Counter({
    name: 'rupeefast_mandates_created_total',
    help: 'Total number of payment mandates created',
    labelNames: ['method'],
  });

  mandatesCancelled = new client.Counter({
    name: 'rupeefast_mandates_cancelled_total',
    help: 'Total number of payment mandates cancelled',
  });

  webhooksReceived = new client.Counter({
    name: 'rupeefast_webhooks_received_total',
    help: 'Total number of Razorpay webhooks received',
    labelNames: ['event'],
  });

  paymentVerifications = new client.Counter({
    name: 'rupeefast_payment_verifications_total',
    help: 'Total number of payment verification attempts',
    labelNames: ['result'],  // success, failure
  });

  errorsTotal = new client.Counter({
    name: 'rupeefast_errors_total',
    help: 'Total number of errors',
    labelNames: ['type'],    // api, webhook, db, auth
  });

  usersCreated = new client.Counter({
    name: 'rupeefast_users_created_total',
    help: 'Total number of new users registered',
  });

  kycSubmitted = new client.Counter({
    name: 'rupeefast_kyc_submitted_total',
    help: 'Total number of KYC submissions',
  });

  kycVerified = new client.Counter({
    name: 'rupeefast_kyc_verified_total',
    help: 'Total number of KYC verifications completed',
  });

  collectionCreated = new client.Counter({
    name: 'rupeefast_collection_logs_created_total',
    help: 'Total number of collection log entries created',
  });

  logger.info('Prometheus metrics enabled');
} else {
  logger.info('Prometheus metrics disabled (set METRICS_ENABLED=true to enable)');
}

// ── Safe counter/gauge helpers (no-op when metrics disabled) ──
function safeInc(counter, labels) {
  if (counter) counter.inc(labels);
}

function safeSet(gauge, value) {
  if (gauge) gauge.set(value);
}

// Track active requests using a local counter (no internal hashMap access)
let activeRequests = 0;

// ── Express middleware: track HTTP request duration, total, and active ──
function metricsMiddleware(req, res, next) {
  if (!METRICS_ENABLED || req.url === '/api/metrics') return next();

  activeRequests++;
  safeSet(httpActive, activeRequests);

  const end = httpDuration?.startTimer();

  res.on('finish', () => {
    const route = req.route?.path || req.path || req.url;
    const labels = { method: req.method, route, status_code: res.statusCode };

    if (end) end(labels);
    safeInc(httpTotal, labels);

    activeRequests = Math.max(0, activeRequests - 1);
    safeSet(httpActive, activeRequests);
  });

  next();
}

// ── Express handler: expose metrics in Prometheus text format ──
async function metricsHandler(req, res) {
  if (!METRICS_ENABLED) {
    return res.status(404).json({ error: 'Metrics are disabled' });
  }
  res.set('Content-Type', client.register.contentType);
  res.send(await client.register.metrics());
}

module.exports = {
  METRICS_ENABLED,
  middleware: metricsMiddleware,
  handler: metricsHandler,

  // Counters
  loansApplied:       { inc: () => safeInc(loansApplied) },
  loansDisbursed:     { inc: () => safeInc(loansDisbursed) },
  mandatesCreated:    { inc: (method) => safeInc(mandatesCreated, { method }) },
  mandatesCancelled:  { inc: () => safeInc(mandatesCancelled) },
  webhooksReceived:   { inc: (event) => safeInc(webhooksReceived, { event }) },
  paymentVerifications: { inc: (result) => safeInc(paymentVerifications, { result }) },
  errorsTotal:        { inc: (type) => safeInc(errorsTotal, { type }) },
  usersCreated:       { inc: () => safeInc(usersCreated) },
  kycSubmitted:       { inc: () => safeInc(kycSubmitted) },  kycVerified:       { inc: () => safeInc(kycVerified) },
  collectionCreated: { inc: () => safeInc(collectionCreated) },

  // DB query timer helper
  dbQueryTimer(operation) {
    if (!dbDuration) return { end: () => {} };
    const end = dbDuration.startTimer({ operation });
    return { end: () => end() };
  },
};
