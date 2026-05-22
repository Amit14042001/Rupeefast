/**
 * RupeeFast — DigiLocker Integration
 *
 * Fetch verified documents (Aadhaar, PAN, income, etc.) via DigiLocker API.
 * https://www.digilocker.gov.in/developers
 *
 * TODO: Replace mock implementations with real DigiLocker API calls.
 * Required env: DIGILOCKER_CLIENT_ID, DIGILOCKER_CLIENT_SECRET
 */

const logger = require('../logger');

const BASE_URL = process.env.DIGILOCKER_BASE_URL || 'https://api.digilocker.gov.in';
const CLIENT_ID = process.env.DIGILOCKER_CLIENT_ID || '';
const CLIENT_SECRET = process.env.DIGILOCKER_CLIENT_SECRET || '';

/**
 * Exchange an OTP-verified access token for a user's DigiLocker documents.
 * @param {string} accessToken - Short-lived token from DigiLocker OAuth flow
 * @returns {Promise<{success: boolean, documents?: Array, error?: string}>}
 */
async function fetchDocuments(accessToken) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    logger.warn('DigiLocker not configured');
    return { success: false, error: 'DIGILOCKER_NOT_CONFIGURED' };
  }
  // TODO: Implement real API call
  return { success: false, error: 'NOT_IMPLEMENTED' };
}

/**
 * Fetch a specific issuer document (e.g., income certificate).
 * @param {string} accessToken
 * @param {string} issuerId
 * @param {string} docType
 * @returns {Promise<{success: boolean, document?: object, error?: string}>}
 */
async function fetchIssuerDocument(accessToken, issuerId, docType) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return { success: false, error: 'DIGILOCKER_NOT_CONFIGURED' };
  }
  return { success: false, error: 'NOT_IMPLEMENTED' };
}

module.exports = { fetchDocuments, fetchIssuerDocument };
