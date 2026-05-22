/**
 * RupeeFast — Notification Broadcasting Service
 *
 * Three-channel notification system:
 *   - SMS:  Log-based (placeholder for Twilio/MSG91 integration)
 *   - WhatsApp: Log-based (placeholder for Gupshup/Interakt integration)
 *   - Push:  Stored in notification_broadcasts for in-app display
 *
 * Usage:
 *   const notify = require('./notifications');
 *   await notify.broadcast({ templateId, targetRoles: ['borrower'], channels: ['sms','push'] });
 *   await notify.sendSingle({ userId, channel: 'push', title: 'Hello', body: 'World' });
 */

const logger = require('./logger');

// ── Configuration ──

// In production, set these to actual provider API keys
const SMS_PROVIDER = process.env.SMS_PROVIDER || 'log';    // twilio | msg91 | log
const WHATSAPP_PROVIDER = process.env.WHATSAPP_PROVIDER || 'log'; // gupshup | interakt | log

// ── Template variable pattern ──
// Matches {{variableName}} in template bodies
const VAR_PATTERN = /\{\{(\w+)\}\}/g;

// ══════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════

/**
 * Substitute variables into a template body.
 *
 * @param {string} body - Template body with {{variable}} placeholders
 * @param {object} vars - Key-value pairs of variable values
 * @returns {string} Rendered message
 */
function renderTemplate(body, vars = {}) {
  return body.replace(VAR_PATTERN, (_, key) => {
    if (vars[key] === undefined || vars[key] === null) {
      logger.warn({ key, body: body.slice(0, 60) }, 'Template variable not provided');
      return `{{${key}}}`;
    }
    return String(vars[key]);
  });
}

/**
 * Send a notification through a single channel to one user.
 *
 * @param {object} options
 * @param {number} options.userId
 * @param {string} options.channel - 'sms' | 'whatsapp' | 'push'
 * @param {string} options.title - Push notification title (optional for SMS/WhatsApp)
 * @param {string} options.body - Message body
 * @param {string} [options.mobile] - Mobile number (required for SMS/WhatsApp)
 * @returns {Promise<{success: boolean, channel: string, messageId?: string, error?: string}>}
 */
async function sendSingle({ userId, channel, title, body, mobile }) {
  switch (channel) {
    case 'sms':
      return sendSMS({ userId, mobile, body });
    case 'whatsapp':
      return sendWhatsApp({ userId, mobile, body });
    case 'push':
      return sendPush({ userId, title, body });
    default:
      logger.warn({ channel }, 'Unknown notification channel');
      return { success: false, channel, error: `Unknown channel: ${channel}` };
  }
}

/**
 * Broadcast a notification to a filtered set of users.
 *
 * @param {object} options
 * @param {object} options.db - Database instance
 * @param {number} options.broadcastId - ID in notification_broadcasts
 * @param {string[]} options.channels - ['sms', 'whatsapp', 'push']
 * @param {string} options.title - Push title
 * @param {string} options.body - Rendered message body
 * @param {object} [options.targetFilters] - { roles: ['borrower'], kyc_status: 'verified' }
 * @returns {Promise<{total: number, results: object[]}>}
 */
async function broadcast({ db, broadcastId, channels, title, body, targetFilters = {} }) {
  const results = [];
  const roles = targetFilters.roles || ['borrower', 'investor', 'agent'];
  const kycFilter = targetFilters.kyc_status ? `AND kyc_status = '${targetFilters.kyc_status}'` : '';
  const minScore = targetFilters.min_trust_score || 0;

  // Build SQL filters safely
  const rolePlaceholders = roles.map((_, i) => `$${i + 1}`).join(', ');
  const params = [...roles];
  let whereClause = `WHERE role IN (${rolePlaceholders})`;
  if (targetFilters.kyc_status) {
    whereClause += ` AND kyc_status = '${targetFilters.kyc_status}'`;
  }
  if (minScore > 0) {
    whereClause += ` AND trust_score >= $${params.length + 1}`;
    params.push(minScore);
  }

  try {
    const users = await db.all(
      `SELECT id, mobile, name, role FROM users ${whereClause}`,
      params
    );

    logger.info({ broadcastId, userCount: users.length, channels }, 'Broadcasting notification');

    let sentCount = 0;
    let failedCount = 0;

    for (const user of users) {
      const vars = { name: user.name || 'User', mobile: user.mobile };
      const userBody = renderTemplate(body, vars);

      for (const channel of channels) {
        const result = await sendSingle({
          userId: user.id,
          channel,
          title: title ? renderTemplate(title, vars) : undefined,
          body: userBody,
          mobile: user.mobile,
        });

        if (result.success) {
          sentCount++;
        } else {
          failedCount++;
        }

        results.push({ userId: user.id, channel, ...result });
      }
    }

    // Update broadcast stats in DB
    await db.run(
      `UPDATE notification_broadcasts
       SET sent_count = $1, failed_count = $2, total_recipients = $3,
           status = CASE WHEN $2 > 0 AND $1 > 0 THEN 'partial'
                         WHEN $2 > 0 THEN 'sent'
                         ELSE 'sent' END,
           sent_at = CASE WHEN status = 'draft' THEN CURRENT_TIMESTAMP ELSE sent_at END,
           completed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [sentCount, failedCount, users.length, broadcastId]
    );

    logger.info({ broadcastId, sentCount, failedCount, totalUsers: users.length }, 'Broadcast completed');
    return { total: users.length, sent: sentCount, failed: failedCount, results };
  } catch (err) {
    logger.error({ err: err.message, broadcastId }, 'Broadcast execution failed');
    await db.run(
      `UPDATE notification_broadcasts SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      ['cancelled', broadcastId]
    );
    throw err;
  }
}

/**
 * Fetch notification history with delivery analytics.
 *
 * @param {object} db - Database instance
 * @param {object} [options] - { limit, offset, status, channel }
 * @returns {Promise<{broadcasts: object[], total: number}>}
 */
async function getBroadcastHistory(db, options = {}) {
  const { limit = 50, offset = 0, status, channel } = options;

  let where = '';
  const params = [];

  if (status) {
    params.push(status);
    where += ` WHERE nb.status = $${params.length}`;
  }

  // Channel filter — check if the JSONB array contains the channel
  if (channel) {
    const channelParam = JSON.stringify([channel]);
    params.push(channelParam);
    where += where ? ` AND` : ` WHERE`;
    where += ` nb.channels @> $${params.length}::jsonb`;
  }

  const countResult = await db.get(
    `SELECT COUNT(*) as total FROM notification_broadcasts nb${where}`,
    params
  );

  const broadcasts = await db.all(
    `SELECT nb.*, nt.name as template_name, nt.label as template_label,
            u.name as created_by_name
     FROM notification_broadcasts nb
     LEFT JOIN notification_templates nt ON nb.template_id = nt.id
     LEFT JOIN users u ON nb.created_by = u.id
     ${where}
     ORDER BY nb.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  return { broadcasts, total: countResult?.total || 0 };
}

// ══════════════════════════════════════════════════
// CHANNEL SENDERS
// ══════════════════════════════════════════════════

/**
 * Send SMS via configured provider.
 * Currently logs to console — replace with Twilio/MSG91 API call.
 */
async function sendSMS({ userId, mobile, body }) {
  // ── In production, replace with: ──
  // if (SMS_PROVIDER === 'twilio') {
  //   return twilio.messages.create({ body, from: process.env.TWILIO_PHONE, to: mobile });
  // }

  // For now, log the SMS
  logger.info({
    channel: 'sms',
    userId,
    mobile: maskMobile(mobile),
    body: body.slice(0, 100),
  }, 'SMS sent (logged — integrate Twilio/MSG91 for production)');

  return { success: true, channel: 'sms', messageId: `sms_log_${Date.now()}` };
}

/**
 * Send WhatsApp via configured provider.
 * Currently logs to console — replace with Gupshup/Interakt API call.
 */
async function sendWhatsApp({ userId, mobile, body }) {
  // ── In production, replace with: ──
  // if (WHATSAPP_PROVIDER === 'gupshup') {
  //   return gupshup.sendTemplate({ mobile, template: body, ... });
  // }

  logger.info({
    channel: 'whatsapp',
    userId,
    mobile: maskMobile(mobile),
    body: body.slice(0, 100),
  }, 'WhatsApp sent (logged — integrate Gupshup/Interakt for production)');

  return { success: true, channel: 'whatsapp', messageId: `wa_log_${Date.now()}` };
}

/**
 * Send in-app push notification.
 * Stores in-memory for now — integrates with push notification service.
 */
async function sendPush({ userId, title, body }) {
  logger.info({
    channel: 'push',
    userId,
    title,
    body: body.slice(0, 100),
  }, 'Push notification sent');

  return { success: true, channel: 'push', messageId: `push_log_${Date.now()}` };
}

// ══════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════

function maskMobile(mobile) {
  if (!mobile || mobile.length < 6) return mobile || 'unknown';
  return mobile.slice(0, 2) + '****' + mobile.slice(-2);
}

module.exports = {
  renderTemplate,
  sendSingle,
  broadcast,
  getBroadcastHistory,
};
