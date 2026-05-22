/**
 * RupeeFast — Signzy eKYC Integration
 *
 * Integration for Aadhaar, PAN, and Voter ID verification via Signzy API.
 * https://signzy.com/
 *
 * TODO: Replace mock implementations with real Signzy API calls.
 * Required env: SIGNZY_API_KEY, SIGNZY_SECRET, SIGNZY_BASE_URL
 */

const logger = require('../logger');

const BASE_URL = process.env.SIGNZY_BASE_URL || 'https://api.signzy.com/v3';
const API_KEY = process.env.SIGNZY_API_KEY || '';
const API_SECRET = process.env.SIGNZY_SECRET || '';

/**
 * Verify an Aadhaar number (masked — only last 4 digits stored).
 * @param {string} aadhaarRef - 12-digit Aadhaar number or last 4 digits + UIDAI token
 * @returns {Promise<{verified: boolean, name?: string, dob?: string, gender?: string, error?: string}>}
 */
async function verifyAadhaar(aadhaarRef) {
  if (!API_KEY || !API_SECRET) {
    logger.warn('Signzy not configured — skipping Aadhaar verification');
    return { verified: false, error: 'SIGNZY_NOT_CONFIGURED' };
  }
  // TODO: Implement real API call
  return { verified: false, error: 'NOT_IMPLEMENTED' };
}

/**
 * Verify a PAN card number.
 * @param {string} pan - 10-character PAN
 * @returns {Promise<{verified: boolean, name?: string, panStatus?: string, error?: string}>}
 */
async function verifyPAN(pan) {
  if (!API_KEY || !API_SECRET) {
    logger.warn('Signzy not configured — skipping PAN verification');
    return { verified: false, error: 'SIGNZY_NOT_CONFIGURED' };
  }
  // TODO: Implement real API call
  return { verified: false, error: 'NOT_IMPLEMENTED' };
}

/**
 * Verify a Voter ID (EPIC) number.
 * @param {string} epicNumber
 * @returns {Promise<{verified: boolean, name?: string, error?: string}>}
 */
async function verifyVoterID(epicNumber) {
  if (!API_KEY || !API_SECRET) {
    return { verified: false, error: 'SIGNZY_NOT_CONFIGURED' };
  }
  return { verified: false, error: 'NOT_IMPLEMENTED' };
}

module.exports = { verifyAadhaar, verifyPAN, verifyVoterID };
