/**
 * RupeeFast — API Management Service
 *
 * Handles:
 *   - API key lifecycle (generate, rotate, revoke)
 *   - Webhook event logging & replay
 *   - Service health checking & status tracking
 *   - Integration configuration management
 *
 * @module api-management
 */

const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { Pool } = require('pg');
const logger = require('./logger');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ────────────────────────────────────────────────────────────────
// WEBHOOK LOGGING
// ────────────────────────────────────────────────────────────────

/**
 * Log an incoming webhook event for monitoring & replay.
 * @param {object} event - Webhook event data
 * @param {string} event.provider - 'razorpay', 'sms_dlr', 'whatsapp_dlr'
 * @param {string} event.eventType - Provider event type
 * @param {string} [event.eventId] - Provider unique event ID for dedup
 * @param {string} [event.sourceIp] - Source IP address
 * @param {object} [event.headers] - Request headers
 * @param {string} [event.rawBody] - Raw request body
 * @param {object} [event.parsedBody] - Parsed JSON body
 * @returns {Promise<number>} The webhook_log id
 */
async function logWebhookEvent(event) {
  const { rows } = await pool.query(
    `INSERT INTO webhook_logs (provider, event_type, event_id, http_method, source_ip, headers, raw_body, parsed_body)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      event.provider,
      event.eventType,
      event.eventId || null,
      event.httpMethod || 'POST',
      event.sourceIp || null,
      event.headers ? JSON.stringify(event.headers) : null,
      event.rawBody || null,
      event.parsedBody ? JSON.stringify(event.parsedBody) : null,
    ]
  );
  return rows[0].id;
}

/**
 * Update a webhook log entry with processing result.
 * @param {number} logId - The webhook_log id
 * @param {object} result
 * @param {'received'|'processed'|'failed'|'replayed'|'ignored'} result.status
 * @param {number} [result.httpStatus] - HTTP response status code
 * @param {string} [result.errorMessage] - Error message if failed
 * @param {number} [result.processingTimeMs] - Processing duration
 */
async function updateWebhookLog(logId, result) {
  await pool.query(
    `UPDATE webhook_logs
        SET status = $1,
            http_status = $2,
            error_message = $3,
            processing_time_ms = $4,
            processed_at = NOW()
      WHERE id = $5`,
    [
      result.status,
      result.httpStatus || null,
      result.errorMessage || null,
      result.processingTimeMs || null,
      logId,
    ]
  );
}

/**
 * Replay a webhook event (creates a replayed copy).
 * @param {number} logId - Original webhook_log id
 * @returns {Promise<object>} The replayed webhook event data
 */
async function replayWebhookEvent(logId) {
  const { rows } = await pool.query('SELECT * FROM webhook_logs WHERE id = $1', [logId]);
  if (rows.length === 0) throw new Error(`Webhook log ${logId} not found`);
  const original = rows[0];

  // Insert a replayed copy referencing the original
  const { rows: newRows } = await pool.query(
    `INSERT INTO webhook_logs (provider, event_type, event_id, http_method, source_ip, headers, raw_body, parsed_body, status, replayed_from)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'received', $9)
     RETURNING *`,
    [
      original.provider,
      original.event_type,
      original.event_id,
      original.http_method,
      original.source_ip,
      original.headers,
      original.raw_body,
      original.parsed_body,
      original.id,
    ]
  );

  logger.info({ webhookLogId: newRows[0].id, replayedFrom: logId }, 'Webhook event replayed');
  return newRows[0];
}

/**
 * List webhook logs with filters and pagination.
 * @param {object} filters
 * @param {string} [filters.provider] - Filter by provider
 * @param {string} [filters.status] - Filter by processing status
 * @param {string} [filters.eventType] - Filter by event type
 * @param {number} [filters.page=1] - Page number (1-based)
 * @param {number} [filters.limit=50] - Items per page
 * @returns {Promise<{logs: object[], total: number, page: number, pages: number}>}
 */
async function listWebhookLogs(filters = {}) {
  const conditions = [];
  const params = [];
  let paramIndex = 0;

  if (filters.provider) {
    paramIndex++;
    conditions.push(`provider = $${paramIndex}`);
    params.push(filters.provider);
  }
  if (filters.status) {
    paramIndex++;
    conditions.push(`status = $${paramIndex}`);
    params.push(filters.status);
  }
  if (filters.eventType) {
    paramIndex++;
    conditions.push(`event_type = $${paramIndex}`);
    params.push(filters.eventType);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(200, Math.max(1, filters.limit || 50));
  const offset = (page - 1) * limit;

  const countResult = await pool.query(`SELECT COUNT(*) FROM webhook_logs ${whereClause}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  const { rows } = await pool.query(
    `SELECT * FROM webhook_logs ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  return {
    logs: rows,
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

/**
 * Get webhook analytics (aggregate stats by provider/status).
 * @returns {Promise<object>} Analytics data
 */
async function getWebhookAnalytics() {
  const { rows: byProvider } = await pool.query(`
    SELECT provider,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status = 'processed') AS processed,
           COUNT(*) FILTER (WHERE status = 'failed') AS failed,
           ROUND(AVG(processing_time_ms) FILTER (WHERE processing_time_ms IS NOT NULL)) AS avg_ms
      FROM webhook_logs
     WHERE created_at > NOW() - INTERVAL '7 days'
     GROUP BY provider
     ORDER BY total DESC
  `);

  const { rows: hourly } = await pool.query(`
    SELECT DATE_TRUNC('hour', created_at) AS hour,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status = 'failed') AS failures
      FROM webhook_logs
     WHERE created_at > NOW() - INTERVAL '24 hours'
     GROUP BY hour
     ORDER BY hour
  `);

  const { rows: totals } = await pool.query(`
    SELECT COUNT(*) AS total_all,
           COUNT(*) FILTER (WHERE status = 'processed') AS total_processed,
           COUNT(*) FILTER (WHERE status = 'failed') AS total_failed,
           COUNT(*) FILTER (WHERE status = 'received') AS total_pending
      FROM webhook_logs
     WHERE created_at > NOW() - INTERVAL '7 days'
  `);

  return {
    totals: totals[0],
    byProvider,
    hourly,
  };
}

// ────────────────────────────────────────────────────────────────
// API KEY MANAGEMENT
// ────────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically secure API key.
 * Format: rf_<service>_<32 random hex chars>
 * @param {string} serviceName - e.g., 'razorpay', 'sms_gateway'
 * @returns {string} Generated key
 */
function generateKeyValue(serviceName) {
  const prefix = serviceName.substring(0, 8).toLowerCase().replace(/[^a-z0-9]/g, '');
  const random = crypto.randomBytes(16).toString('hex');
  return `rf_${prefix}_${random}`;
}

/**
 * Create a new API key record.
 * @param {object} keyData
 * @param {string} keyData.serviceName
 * @param {string} keyData.keyLabel
 * @param {string} [keyData.environment='production']
 * @param {string} [keyData.notes]
 * @param {number} [keyData.createdBy] - Admin user ID
 * @returns {Promise<{key: object, rawValue: string}>} The key record + raw value (shown once)
 */
async function createApiKey(keyData) {
  const rawValue = generateKeyValue(keyData.serviceName);
  const prefix = rawValue.substring(0, 12);

  const { rows } = await pool.query(
    `INSERT INTO api_keys (service_name, key_label, key_prefix, environment, created_by, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, service_name, key_label, key_prefix, environment, status, created_at`,
    [
      keyData.serviceName,
      keyData.keyLabel,
      prefix,
      keyData.environment || 'production',
      keyData.createdBy || null,
      keyData.notes || null,
    ]
  );

  logger.info({ keyId: rows[0].id, service: keyData.serviceName }, 'API key created');
  return { key: rows[0], rawValue };
}

/**
 * Rotate an API key — revokes old, creates new with reference.
 * @param {number} keyId - Existing key ID to rotate
 * @param {number} [userId] - Admin performing the rotation
 * @returns {Promise<{oldKey: object, newKey: object, rawValue: string}>}
 */
async function rotateApiKey(keyId, userId) {
  const { rows } = await pool.query('SELECT * FROM api_keys WHERE id = $1', [keyId]);
  if (rows.length === 0) throw new Error(`API key ${keyId} not found`);
  const oldKey = rows[0];

  if (oldKey.status !== 'active') {
    throw new Error(`Cannot rotate key with status '${oldKey.status}'`);
  }

  // Revoke old key
  await pool.query(
    `UPDATE api_keys SET status = 'rotated', rotated_at = NOW(), rotated_from_id = NULL, updated_at = NOW() WHERE id = $1`,
    [keyId]
  );

  // Create new key linked to old one
  const rawValue = generateKeyValue(oldKey.service_name);
  const prefix = rawValue.substring(0, 12);

  const { rows: newRows } = await pool.query(
    `INSERT INTO api_keys (service_name, key_label, key_prefix, environment, created_by, rotated_from_id, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, service_name, key_label, key_prefix, environment, status, created_at`,
    [
      oldKey.service_name,
      `${oldKey.key_label} (rotated ${new Date().toISOString().split('T')[0]})`,
      prefix,
      oldKey.environment,
      userId || null,
      keyId,
      oldKey.notes,
    ]
  );

  logger.info({ oldKeyId: keyId, newKeyId: newRows[0].id }, 'API key rotated');
  return { oldKey: { ...oldKey, status: 'rotated' }, newKey: newRows[0], rawValue };
}

/**
 * Revoke an API key (set status to 'revoked').
 * @param {number} keyId
 * @param {number} [userId]
 */
async function revokeApiKey(keyId, userId) {
  const { rows } = await pool.query(
    `UPDATE api_keys SET status = 'revoked', updated_at = NOW() WHERE id = $1 RETURNING *`,
    [keyId]
  );
  if (rows.length === 0) throw new Error(`API key ${keyId} not found`);
  logger.info({ keyId, userId }, 'API key revoked');
  return rows[0];
}

/**
 * List API keys with filtering.
 * @param {object} filters
 * @param {string} [filters.serviceName]
 * @param {string} [filters.status]
 * @param {string} [filters.environment]
 * @returns {Promise<object[]>}
 */
async function listApiKeys(filters = {}) {
  const conditions = [];
  const params = [];
  let paramIndex = 0;

  if (filters.serviceName) {
    paramIndex++;
    conditions.push(`service_name = $${paramIndex}`);
    params.push(filters.serviceName);
  }
  if (filters.status) {
    paramIndex++;
    conditions.push(`status = $${paramIndex}`);
    params.push(filters.status);
  }
  if (filters.environment) {
    paramIndex++;
    conditions.push(`environment = $${paramIndex}`);
    params.push(filters.environment);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT ak.*, u.name AS created_by_name
       FROM api_keys ak
       LEFT JOIN users u ON u.id = ak.created_by
       ${whereClause}
      ORDER BY ak.created_at DESC`,
    params
  );

  return rows;
}

// ────────────────────────────────────────────────────────────────
// SERVICE HEALTH CHECKS
// ────────────────────────────────────────────────────────────────

/**
 * Record a health check result.
 * @param {object} check
 * @param {string} check.serviceName
 * @param {'up'|'degraded'|'down'|'unknown'} check.status
 * @param {number} [check.responseTimeMs]
 * @param {string} [check.endpointTested]
 * @param {string} [check.errorMessage]
 * @param {object} [check.details]
 * @param {'system'|'manual'} [check.checkedBy='system']
 * @returns {Promise<object>}
 */
async function recordHealthCheck(check) {
  const { rows } = await pool.query(
    `INSERT INTO service_health_checks (service_name, status, response_time_ms, endpoint_tested, error_message, details, checked_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      check.serviceName,
      check.status,
      check.responseTimeMs || null,
      check.endpointTested || null,
      check.errorMessage || null,
      check.details ? JSON.stringify(check.details) : null,
      check.checkedBy || 'system',
    ]
  );
  return rows[0];
}

/**
 * Get latest health status for all services (latest check per service).
 * @returns {Promise<object[]>}
 */
async function getLatestHealthStatus() {
  const { rows } = await pool.query(`
    SELECT DISTINCT ON (sh.service_name)
           sh.id,
           sh.service_name,
           sh.status,
           sh.response_time_ms,
           sh.endpoint_tested,
           sh.error_message,
           sh.details,
           sh.checked_by,
           sh.created_at
      FROM service_health_checks sh
     ORDER BY sh.service_name, sh.created_at DESC
  `);

  // For services without any health check, use integration_config
  const { rows: configs } = await pool.query(
    `SELECT service_name, display_name, is_enabled, last_checked_at FROM integration_config`
  );

  const configured = new Set(configs.map(c => c.service_name));
  const checkedServices = new Set(rows.map(r => r.service_name));

  configs.forEach(config => {
    if (!checkedServices.has(config.service_name)) {
      rows.push({
        service_name: config.service_name,
        status: 'unknown',
        response_time_ms: null,
        endpoint_tested: null,
        error_message: null,
        details: null,
        checked_by: null,
        created_at: config.last_checked_at || config.is_enabled ? null : null,
      });
    }
  });

  return rows;
}

/**
 * Get health check history for a service.
 * @param {string} serviceName
 * @param {number} [hours=24]
 * @returns {Promise<object[]>}
 */
async function getHealthCheckHistory(serviceName, hours = 24) {
  const { rows } = await pool.query(
    `SELECT * FROM service_health_checks
      WHERE service_name = $1
        AND created_at > NOW() - ($2 || ' hours')::INTERVAL
      ORDER BY created_at DESC`,
    [serviceName, hours]
  );
  return rows;
}

/**
 * Get uptime stats for the last N days.
 * @param {number} [days=7]
 * @returns {Promise<object[]>}
 */
async function getUptimeStats(days = 7) {
  const { rows } = await pool.query(`
    SELECT service_name,
           COUNT(*) AS total_checks,
           COUNT(*) FILTER (WHERE status = 'up') AS up_count,
           COUNT(*) FILTER (WHERE status = 'degraded') AS degraded_count,
           COUNT(*) FILTER (WHERE status = 'down') AS down_count,
           ROUND(
             COUNT(*) FILTER (WHERE status = 'up') * 100.0 / NULLIF(COUNT(*), 0)
           ) AS uptime_pct,
           ROUND(AVG(response_time_ms) FILTER (WHERE response_time_ms IS NOT NULL)) AS avg_response_ms
      FROM service_health_checks
     WHERE created_at > NOW() - ($1 || ' days')::INTERVAL
     GROUP BY service_name
     ORDER BY service_name
  `, [days]);
  return rows;
}

// ────────────────────────────────────────────────────────────────
// INTEGRATION CONFIGURATION
// ────────────────────────────────────────────────────────────────

/**
 * Get all integration configs.
 * @returns {Promise<object[]>}
 */
async function getIntegrationConfigs() {
  const { rows } = await pool.query(
    `SELECT ic.*,
            (SELECT sh.status
               FROM service_health_checks sh
              WHERE sh.service_name = ic.service_name
              ORDER BY sh.created_at DESC
              LIMIT 1
            ) AS current_status
       FROM integration_config ic
      ORDER BY ic.display_name`
  );
  return rows;
}

/**
 * Upsert integration configuration.
 * @param {object} config
 * @param {string} config.serviceName
 * @param {string} config.displayName
 * @param {string} [config.baseUrl]
 * @param {object} [config.config]
 * @param {boolean} [config.isEnabled]
 * @param {object} [config.featureFlags]
 * @returns {Promise<object>}
 */
async function upsertIntegrationConfig(config) {
  const { rows } = await pool.query(
    `INSERT INTO integration_config (service_name, display_name, base_url, config, is_enabled, feature_flags)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (service_name)
     DO UPDATE SET
       display_name = COALESCE($2, integration_config.display_name),
       base_url = COALESCE($3, integration_config.base_url),
       config = CASE WHEN $4::JSONB = '{}'::JSONB THEN integration_config.config ELSE $4::JSONB END,
       is_enabled = COALESCE($5, integration_config.is_enabled),
       feature_flags = CASE WHEN $6::JSONB = '{}'::JSONB THEN integration_config.feature_flags ELSE $6::JSONB END,
       updated_at = NOW()
     RETURNING *`,
    [
      config.serviceName,
      config.displayName || config.serviceName,
      config.baseUrl || null,
      config.config ? JSON.stringify(config.config) : '{}',
      config.isEnabled !== undefined ? config.isEnabled : true,
      config.featureFlags ? JSON.stringify(config.featureFlags) : '{}',
    ]
  );
  return rows[0];
}

/**
 * Toggle integration enabled/disabled.
 * @param {string} serviceName
 * @param {boolean} isEnabled
 * @returns {Promise<object>}
 */
async function toggleIntegration(serviceName, isEnabled) {
  const { rows } = await pool.query(
    `UPDATE integration_config SET is_enabled = $1, updated_at = NOW()
      WHERE service_name = $2 RETURNING *`,
    [isEnabled, serviceName]
  );
  if (rows.length === 0) throw new Error(`Integration '${serviceName}' not found`);
  return rows[0];
}

// ────────────────────────────────────────────────────────────────
// RUN HEALTH CHECKS
// ────────────────────────────────────────────────────────────────

/**
 * Run a health check against a service endpoint.
 * Uses HTTP GET to check reachability.
 * @param {string} serviceName
 * @param {string} url - Endpoint to check
 * @param {object} [options]
 * @param {number} [options.timeout=5000]
 * @param {boolean} [options.manual=false]
 * @returns {Promise<object>} The recorded health check row
 */
async function runHealthCheck(serviceName, url, options = {}) {
  const timeout = options.timeout || 5000;
  const start = Date.now();

  try {
    const mod = url.startsWith('https') ? https : http;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const response = await new Promise((resolve, reject) => {
      const req = mod.get(url, { signal: controller.signal }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, data: data.substring(0, 200) }));
      });
      req.on('error', reject);
      req.end();
    });

    clearTimeout(timer);
    const responseTimeMs = Date.now() - start;

    const isUp = response.statusCode >= 200 && response.statusCode < 500;
    const status = isUp ? 'up' : 'degraded';
    const errorMessage = isUp ? null : `HTTP ${response.statusCode}`;

    return await recordHealthCheck({
      serviceName,
      status,
      responseTimeMs,
      endpointTested: url,
      errorMessage,
      checkedBy: options.manual ? 'manual' : 'system',
    });
  } catch (err) {
    const responseTimeMs = Date.now() - start;
    return await recordHealthCheck({
      serviceName,
      status: err.name === 'AbortError' ? 'degraded' : 'down',
      responseTimeMs,
      endpointTested: url,
      errorMessage: err.name === 'AbortError' ? 'Timeout exceeded' : err.message,
      checkedBy: options.manual ? 'manual' : 'system',
    });
  }
}

/**
 * Run all configured health checks.
 * @returns {Promise<object[]>}
 */
async function runAllHealthChecks() {
  const configs = await getIntegrationConfigs();
  const results = [];

  for (const config of configs) {
    if (!config.base_url) {
      await recordHealthCheck({
        serviceName: config.service_name,
        status: 'unknown',
        errorMessage: 'No endpoint configured',
        checkedBy: 'system',
      });
      continue;
    }

    const result = await runHealthCheck(config.service_name, config.base_url);
    results.push(result);
  }

  return results;
}

module.exports = {
  // Webhooks
  logWebhookEvent,
  updateWebhookLog,
  replayWebhookEvent,
  listWebhookLogs,
  getWebhookAnalytics,
  // API Keys
  createApiKey,
  rotateApiKey,
  revokeApiKey,
  listApiKeys,
  // Health Checks
  recordHealthCheck,
  getLatestHealthStatus,
  getHealthCheckHistory,
  getUptimeStats,
  runHealthCheck,
  runAllHealthChecks,
  // Integration Config
  getIntegrationConfigs,
  upsertIntegrationConfig,
  toggleIntegration,
};
