/**
 * RupeeFast — Shared State & Utilities
 *
 * This module establishes the global state (API base, auth tokens, current user)
 * and provides utility functions used by every other module:
 *   showLoading / hideLoading   — loading overlay
 *   showToast                   — toast notification system
 *   apiFetch                    — authenticated HTTP fetch
 *   showSuccess / closeSuccess  — success overlay
 *   setEl                       — safe setter for element textContent
 *   otpNext                     — OTP field auto-advance + submit
 *   copyCode / shareRef         — referral helpers
 *   sendChat                    — chat widget
 *   runCountUp                  — animated counter (borrower home numbers)
 *
 * Global variables declared here:
 *   API_BASE_URL, currentUser, authToken,
 *   totalCollected, selectedPaymentMethod, currentMandateId,
 *   currentStatementIdx, statementMonths
 *
 * Script load order requirement:
 *   shared.js must be loaded BEFORE navigation.js, auth.js, loans.js, payments.js
 *   because all modules depend on apiFetch, showToast, runCountUp, and the shared state.
 */

// ══════════════════════════════════════════════════
// GLOBAL STATE
// ══════════════════════════════════════════════════

const API_BASE_URL = window.location.origin + '/api';
let currentUser = null;
// ── Auth token: in-memory (primary) + sessionStorage (backup for page refresh) ──
// localStorage is NOT used because it persists indefinitely on device storage.
// Fintech best practice: token lives in memory and is cleared on app background / logout.
let authToken = null;

// Restore from sessionStorage if available (survives page refresh within same session only)
try {
  const stored = sessionStorage.getItem('rupeefast_token');
  if (stored) {
    authToken = stored;
    // Immediately remove from sessionStorage after restore — token flows only through memory
    sessionStorage.removeItem('rupeefast_token');
  }
} catch (e) {
  // sessionStorage unavailable (private browsing, etc.) — memory-only is fine
}

// Clear token when the page/tab is closed or app is backgrounded
window.addEventListener('pagehide', function() {
  authToken = null;
  try { sessionStorage.removeItem('rupeefast_token'); } catch (e) { /* ignore */ }
});

// ── Agent collection state ──
let totalCollected = 0;

// ── Payment / Mandate state ──
let selectedPaymentMethod = 'upi_autopay';
let currentMandateId = null;

// ── Investor statement state ──
let currentStatementIdx = 0;
const statementMonths = ['2025-05', '2025-04', '2025-03', '2025-02', '2025-01'];

// ══════════════════════════════════════════════════
// LOADING OVERLAY
// ══════════════════════════════════════════════════

function showLoading(msg) {
  const el = document.getElementById('loading-text');
  if (el) el.textContent = msg || 'Loading...';
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.add('active');
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.remove('active');
}

// ══════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ══════════════════════════════════════════════════

function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: 'ti ti-check-circle', error: 'ti ti-alert-circle', info: 'ti ti-info-circle' };
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = document.createElement('i');
  icon.className = icons[type] || icons.info;
  toast.appendChild(icon);
  
  const span = document.createElement('span');
  span.textContent = message;
  toast.appendChild(span);
  
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-12px) scale(0.95)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ══════════════════════════════════════════════════
// API FETCH (authenticated)
// ══════════════════════════════════════════════════

async function apiFetch(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (authToken) {
    headers['Authorization'] = 'Bearer ' + authToken;
  }

  const showLoader = options.showLoader !== false;
  if (showLoader) showLoading('Connecting...');

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'API Error');
    return data;
  } catch (err) {
    console.error('API Fetch Error:', err);
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('load')) {
      showToast('Backend server unavailable. Running in offline demo mode.', 'error', 5000);
    } else {
      showToast(err.message, 'error', 4000);
    }
    return null;
  } finally {
    if (showLoader) hideLoading();
  }
}

// ══════════════════════════════════════════════════
// SUCCESS OVERLAY
// ══════════════════════════════════════════════════

function showSuccess(title, msg) {
  const titleEl = document.getElementById('so-title');
  const msgEl = document.getElementById('so-msg');
  const overlay = document.getElementById('success-overlay');
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = msg;
  if (overlay) overlay.style.display = 'flex';
}

function closeSuccess() {
  const overlay = document.getElementById('success-overlay');
  if (overlay) overlay.style.display = 'none';
}

// ══════════════════════════════════════════════════
// SAFE ELEMENT TEXT SETTER
// ══════════════════════════════════════════════════

function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ══════════════════════════════════════════════════
// OTP AUTO-ADVANCE + SUBMIT
// ══════════════════════════════════════════════════

function otpNext(el, nextId) {
  if (el.value.length >= 1) {
    const next = document.getElementById(nextId);
    if (next) {
      next.focus();
      // Auto-submit when last OTP digit is entered
      if (next.id.endsWith('4')) {
        const form = next.closest('form');
        if (form) {
          setTimeout(() => {
            form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
          }, 200);
        }
      }
    }
  }
}

// ══════════════════════════════════════════════════
// REFERRAL HELPERS
// ══════════════════════════════════════════════════

function copyCode() {
  showToast('Referral code copied to clipboard!', 'success');
}

function shareRef(m) {
  showToast(`Referral link shared via ${m}`, 'success');
}

// ══════════════════════════════════════════════════
// CHAT WIDGET
// ══════════════════════════════════════════════════

function sendChat() {
  const input = document.getElementById('chat-input');
  const msg = input?.value?.trim();
  if (!msg) return;
  
  const wrap = document.getElementById('chat-wrap');
  if (!wrap) return;
  
  const userDiv = document.createElement('div');
  userDiv.className = 'chat-msg user';
  userDiv.textContent = msg;
  wrap.appendChild(userDiv);
  input.value = '';
  
  setTimeout(() => {
    const botDiv = document.createElement('div');
    botDiv.className = 'chat-msg bot';
    
    const responses = [
      'Your current loan balance is ₹8,700 with 67 remaining EMIs of ₹120 each.',
      'You are eligible for a top-up loan of up to ₹15,000 based on your repayment history.',
      'Your next EMI of ₹120 is due tomorrow at 9 AM via UPI AutoPay.',
      'Your Trust Score is 74/100. Timely repayment of 3 more EMIs will increase it to 80.',
      'To apply for a higher loan, complete your current loan first and maintain a good repayment record.'
    ];
    botDiv.textContent = responses[Math.floor(Math.random() * responses.length)];
    wrap.appendChild(botDiv);
    wrap.scrollTop = wrap.scrollHeight;
  }, 500);
  
  wrap.scrollTop = wrap.scrollHeight;
}

// ══════════════════════════════════════════════════
// COUNT-UP ANIMATION
// ══════════════════════════════════════════════════

function runCountUp() {
  document.querySelectorAll('[data-count-to]').forEach(el => {
    const target = parseFloat(el.dataset.countTo);
    if (isNaN(target)) return;

    const suffix = el.dataset.countSuffix || '';
    const duration = parseInt(el.dataset.countDuration) || 1000;
    const decimals = el.dataset.countDecimals !== undefined ? parseInt(el.dataset.countDecimals) : 0;
    const delay = parseInt(el.dataset.countDelay) || 0;

    const initialValue = decimals > 0 ? '0.' + '0'.repeat(decimals) : '0';
    el.textContent = initialValue + suffix;

    setTimeout(() => {
      const startTime = performance.now();

      function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = eased * target;

        let formatted;
        if (decimals > 0) {
          formatted = current.toFixed(decimals);
        } else {
          formatted = Math.round(current).toLocaleString('en-IN');
        }

        el.textContent = formatted + suffix;

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      }

      requestAnimationFrame(animate);
    }, delay);
  });
}
