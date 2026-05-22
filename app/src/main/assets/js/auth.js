/**
 * RupeeFast — Authentication Module
 *
 * Handles the entire auth flow:
 *   1. doLogin(role)   — validates mobile, sends OTP via API, stores token
 *   2. verifyOTP(role) — verifies OTP (currently delegates to loadDashboard)
 *   3. loadDashboard   — fetches user data and navigates to role-specific home
 *   4. logoutUser      — clears auth state and returns to role-select screen
 *
 * Dependencies:
 *   shared.js — showToast, showLoading, apiFetch, currentUser, authToken
 *   navigation.js — showScreen
 */

// ══════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════

async function doLogin(role) {
  const mobile = document.querySelector(`#screen-login-${role} input[type="tel"]`)?.value;
  if (!mobile || mobile.length < 10) {
    showToast('Please enter a valid 10-digit mobile number', 'error');
    return;
  }

  showLoading('Sending OTP...');
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ mobile, role })
  });

  if (data && data.success) {
    authToken = data.token;
    // Store token in memory only (NOT localStorage — cleared on app background via pagehide handler)
    currentUser = data.user;
    showToast('OTP sent to ' + mobile, 'success');
    showScreen(`screen-otp-${role}`);
  }
}

// ══════════════════════════════════════════════════
// OTP VERIFICATION
// ══════════════════════════════════════════════════

async function verifyOTP(role) {
  if (!currentUser) return;
  showToast('Verifying OTP...', 'info');
  await loadDashboard(role);
}

// ══════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════

async function loadDashboard(role) {
  if (!currentUser) return;

  const data = await apiFetch(`/user/${currentUser.id}/dashboard`);
  if (data) {
    showToast('Welcome ' + (currentUser.name || 'User') + '!', 'success');
    if (role === 'borrower') {
      showScreen('screen-b-home');
      document.querySelectorAll('.b-name').forEach(el => el.textContent = currentUser.name || 'User');
    } else if (role === 'investor') {
      showScreen('screen-i-home');
      document.querySelectorAll('.i-name').forEach(el => el.textContent = currentUser.name || 'Investor');
    } else if (role === 'agent') {
      showScreen('screen-a-home');
    }
  }
}

// ══════════════════════════════════════════════════
// LOGOUT
// ══════════════════════════════════════════════════

function logoutUser() {
  authToken = null;
  currentUser = null;
  // Clear any persisted token remnants
  try {
    sessionStorage.removeItem('rupeefast_token');
  } catch (e) { /* ignore */ }
  showToast('Logged out successfully', 'info');
  showScreen('screen-home');
}
