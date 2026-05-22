/**
 * RupeeFast Logger — Configurable Pino logger with optional log shipping
 *
 * ── Console (always on) ──
 * Uses pino-pretty in development for human-readable output.
 * In production, uses standard JSON lines output (more efficient, easier to pipe).
 *
 * ── Log Shipping (optional) ──
 * When LOG_SHIP_ADDRESS is set, logs are also forwarded to a remote TCP or UDP
 * endpoint (e.g., Logstash, Papertrail, syslog-ng, Better Stack, or a custom
 * log aggregator).
 *
 *   LOG_SHIP_ADDRESS=logs.papertrailapp.com
 *   LOG_SHIP_PORT=12345
 *   LOG_SHIP_MODE=tcp        # tcp (default) or udp
 *
 * ── Graceful shutdown ──
 * Call logger.flush() or logger.end() before process exit to ensure buffered
 * log entries are sent before the process terminates.
 */

const pino = require('pino');

const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const NODE_ENV = process.env.NODE_ENV || 'development';

const transports = [];

// ── Console transport ──
// In development, use pino-pretty for readability.
// In production, use standard JSON lines (more parseable, lower overhead).
if (NODE_ENV === 'development' || NODE_ENV === 'test') {
  transports.push({
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:HH:MM:ss.l',
      ignore: 'pid,hostname',
    },
    level: LOG_LEVEL,
  });
} else {
  // Production: structured JSON to stdout (PM2 / Docker captures it)
  transports.push({ target: 'pino/file', options: {}, level: LOG_LEVEL });
}

// ── Remote log shipping (optional) ──
// Activated by setting LOG_SHIP_ADDRESS. Logs are forwarded in JSON lines format
// over TCP or UDP to the specified host and port.
const shipAddress = process.env.LOG_SHIP_ADDRESS;
const shipPort = process.env.LOG_SHIP_PORT;
const shipMode = (process.env.LOG_SHIP_MODE || 'tcp').toLowerCase();

if (shipAddress && shipPort) {
  if (!['tcp', 'udp'].includes(shipMode)) {
    console.error(`Invalid LOG_SHIP_MODE "${shipMode}". Must be "tcp" or "udp". Falling back to tcp.`);
  }

  const pinoSocketOptions = {
    address: shipAddress,
    port: parseInt(shipPort, 10),
    mode: shipMode === 'udp' ? 'udp' : 'tcp',
    reconnect: true,
    // No reconnectTries set — defaults to Infinity (retry indefinitely)
    reconnectTimeout: 5000,    // 5 seconds between retries
  };

  // Log a one-time message to console about shipping (don't use logger yet — it's being built)
  console.log(
    `[Logger] Shipping logs to ${shipAddress}:${shipPort} via ${shipMode} ` +
    `(reconnect enabled, retry every 5s)`
  );

  transports.push({
    target: 'pino-socket',
    options: pinoSocketOptions,
    level: LOG_LEVEL,
  });
}

// ── Build the logger ──
const logger = transports.length > 1
  ? pino(pino.transport({ targets: transports }))
  : pino(transports[0] || { level: LOG_LEVEL });

// ── Graceful shutdown helper ──
// Call this on SIGTERM/SIGINT to flush buffered logs before exit.
logger.flushAndClose = async function flushAndClose() {
  try {
    await logger.flush();
  } catch (err) {
    console.error('[Logger] Error flushing logs:', err.message);
  }
};

module.exports = logger;
