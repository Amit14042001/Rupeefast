/**
 * RupeeFast Core Application Logic
 * Modularized for Scalability
 */

// ══════════════════════════════════════════════════
// API & STATE CONFIGURATION
// ══════════════════════════════════════════════════

const API_BASE_URL = 'http://localhost:3000/api';
let currentUser = null;

async function apiFetch(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'API Error');
    return data;
  } catch (err) {
    console.error('API Fetch Error:', err);
    showSuccess('Connection Error', 'Please check if the backend server is running.');
    return null;
  }
}

// ══════════════════════════════════════════════════
// NAVIGATION & UI CORE
// ══════════════════════════════════════════════════

/**
 * Switch between screens
 * @param {string} id - The ID of the screen to show
 */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('active');
    // Scroll to top of the new screen
    el.querySelector('.scroll-body')?.scrollTo(0, 0);
  }

  // Trigger screen-specific logic
  if (id === 'screen-b-ai-score') setTimeout(runAIScore, 200);
  if (id === 'screen-b-schedule') buildSchedule();
}

/**
 * Handle Tab Navigation for all roles
 */
function showBTab(id, btn) {
  showScreen(id);
  // Remove active state from all nav items in the current bottom nav
  const nav = btn?.closest('.bottom-nav');
  if (nav) {
    nav.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
}

// Aliases for role-specific tab switching
const showITab = showBTab;
const showATab = showBTab;

/**
 * Success Overlay Controller
 */
function showSuccess(title, msg) {
  document.getElementById('so-title').textContent = title;
  document.getElementById('so-msg').textContent = msg;
  document.getElementById('success-overlay').style.display = 'flex';
}

function closeSuccess() {
  document.getElementById('success-overlay').style.display = 'none';
}

// ══════════════════════════════════════════════════
// BORROWER DOMAIN LOGIC
// ══════════════════════════════════════════════════

function calcLoan(val) {
  val = parseInt(val);
  document.getElementById('amt-val').textContent = '₹' + val.toLocaleString('en-IN');
  
  const fee = Math.round(val * 0.05);
  const reserve = Math.round(val * 0.05);
  const recv = val - fee - reserve;
  
  const daily = Math.round((val * 1.2) / 100);
  const weekly = Math.round((val * 1.18) / 15);

  document.getElementById('p0-amt').textContent = '₹' + daily + '/day';
  document.getElementById('p0-recv').textContent = '₹' + recv.toLocaleString('en-IN');
  document.getElementById('p1-amt').textContent = '₹' + weekly + '/wk';
  document.getElementById('p1-recv').textContent = '₹' + (recv + 200).toLocaleString('en-IN');
  document.getElementById('p2-amt').textContent = '₹' + Math.round(val * 1.18).toLocaleString('en-IN') + '/mo';
  
  // Summary update
  document.getElementById('sum-loan').textContent = '₹' + val.toLocaleString('en-IN');
  document.getElementById('sum-fee').textContent = '-₹' + fee.toLocaleString('en-IN');
  document.getElementById('sum-recv').textContent = '₹' + recv.toLocaleString('en-IN');
  document.getElementById('sum-daily').textContent = '₹' + daily + '/day';
}

function selPurpose(i) {
  document.querySelectorAll('.purpose-btn').forEach((b, idx) => {
    if (i === idx) {
      b.style.border = '1.5px solid var(--primary)';
      b.style.background = 'var(--primary-bg)';
      b.style.color = 'var(--primary)';
    } else {
      b.style.border = '1px solid var(--border)';
      b.style.background = 'var(--surface)';
      b.style.color = 'var(--text2)';
    }
  });
}

function selPlan(i) {
  document.querySelectorAll('.plan-card').forEach((c, idx) => {
    const check = c.querySelector('.check');
    if (i === idx) {
      c.classList.add('selected');
      if (check) {
        check.style.background = 'var(--primary)';
        check.style.borderColor = 'var(--primary)';
        check.innerHTML = '<i class="ti ti-check" style="font-size:12px;color:#fff;"></i>';
      }
    } else {
      c.classList.remove('selected');
      if (check) {
        check.style.background = '';
        check.style.borderColor = 'var(--border)';
        check.innerHTML = '';
      }
    }
  });
}

// ══════════════════════════════════════════════════
// INVESTOR DOMAIN LOGIC
// ══════════════════════════════════════════════════

function calcInvest(val) {
  val = parseInt(val);
  document.getElementById('inv-amt-val').textContent = '₹' + val.toLocaleString('en-IN');
  document.getElementById('inv-total').textContent = '₹' + val.toLocaleString('en-IN');
  
  const borrowersCount = Math.max(1, Math.floor(val / 500));
  document.getElementById('inv-borrowers').textContent = borrowersCount + ' borrowers × ₹500';
  
  const monthlyReturn = Math.round(val * 0.03);
  document.getElementById('inv-monthly').textContent = '₹' + monthlyReturn.toLocaleString('en-IN');
  
  const riskPct = Math.round((500 / val) * 100);
  document.getElementById('inv-risk').textContent = 'Only ₹500 at risk (' + riskPct + '%)';
}

function selRisk(r) {
  ['safe', 'mod', 'high'].forEach(k => {
    const el = document.getElementById('rb-' + k);
    if (!el) return;
    k === r ? el.classList.add('selected') : el.classList.remove('selected');
  });
}

// ══════════════════════════════════════════════════
// AGENT DOMAIN LOGIC
// ══════════════════════════════════════════════════

let totalCollected = 0;
function collectItem(i, name, loc) {
  const badge = document.getElementById('ci-' + i);
  if (badge && badge.textContent !== 'Collected') {
    badge.textContent = 'Collected';
    badge.style.background = 'var(--green-bg)';
    badge.style.color = 'var(--green)';
    
    totalCollected += 120;
    document.getElementById('col-done-amt').textContent = '₹' + totalCollected;
    document.getElementById('col-commission').textContent = '₹' + Math.round(totalCollected * 0.02);
    
    showSuccess('Collected!', `₹120 collected from ${name}. OTP confirmed. GPS stamped.`);
  }
}

// ══════════════════════════════════════════════════
// KYC & AI SCORE
// ══════════════════════════════════════════════════

function runAIScore() {
  const steps = [
    'Checking device fingerprint & root status...',
    'Analysing 6-month UPI transaction history...',
    'Verifying income consistency patterns...',
    'Checking SIM age & GPS stability...',
    'Scanning for fraud signals & loan rings...',
    'Analysing bank statement cash flow...',
    'Running repayment prediction model...',
    'Computing Trust Score — 47 signals...'
  ];
  
  const icons = [
    '✓ Device clean', '✓ UPI activity: High', '✓ Income: Consistent', 
    '✓ GPS: Stable', '✓ No fraud detected', '✓ Cash flow: Good', 
    '⚠ 1 existing EMI noted', 'Generating offer...'
  ];

  const prog = document.getElementById('ai-prog');
  const lbl = document.getElementById('ai-step-lbl');
  const pctEl = document.getElementById('ai-pct');
  const checks = document.getElementById('ai-checks');
  const doneBtn = document.getElementById('ai-score-done');

  prog.style.width = '0%';
  checks.innerHTML = '';
  doneBtn.style.display = 'none';

  let i = 0;
  const timer = setInterval(() => {
    if (i < steps.length) {
      lbl.textContent = steps[i];
      const pct = Math.round(((i + 1) / steps.length) * 100);
      prog.style.width = pct + '%';
      pctEl.textContent = pct + '%';
      
      const chk = document.createElement('div');
      chk.style.cssText = 'font-size:12px;color:var(--green);display:flex;align-items:center;gap:6px;';
      chk.innerHTML = `<i class="ti ti-check" style="font-size:14px;"></i>${icons[i]}`;
      checks.appendChild(chk);
      i++;
    } else {
      clearInterval(timer);
      lbl.textContent = 'Analysis complete!';
      doneBtn.style.display = 'block';
    }
  }, 700);
}

// ══════════════════════════════════════════════════
// APP INITIALIZATION
// ══════════════════════════════════════════════════

window.addEventListener('load', () => {
  buildSchedule();
});

function buildSchedule() {
  const targets = ['schedule-list', 'home-schedule-list'];
  targets.forEach(id => {
    const list = document.getElementById(id);
    if (!list) return;
    list.innerHTML = '';
    const count = id === 'home-schedule-list' ? 5 : 20;
    for (let i = 0; i < count; i++) {
      const d = document.createElement('div');
      d.className = 'list-item';
      const done = i < 5; // Simulating some paid items
      const iconClass = done ? 'green' : 'amber';
      const iconType = done ? 'check' : 'clock';
      
      d.innerHTML = `
        <div class="list-icon ${iconClass}"><i class="ti ti-${iconType}"></i></div>
        <div class="list-body">
          <div style="font-weight:600; font-size:14px; color:var(--text);">EMI — Day ${33 - i}</div>
          <div style="font-size:12px; color:var(--text3); margin-top:2px;">May ${8 - i}, 2025</div>
        </div>
        <div style="text-align:right;">
          <div style="font-weight:700; color:${done ? 'var(--green)' : 'var(--text)'};">₹120</div>
          <div style="font-size:11px; color:var(--text3);">${done ? 'Paid' : 'Upcoming'}</div>
        </div>
      `;
      list.appendChild(d);
    }
  });
}

// ══════════════════════════════════════════════════
// AUTHENTICATION LOGIC
// ══════════════════════════════════════════════════

async function doLogin(role) {
  const mobile = document.querySelector(`#screen-login-${role} input[type="tel"]`)?.value;
  if (!mobile || mobile.length < 10) {
    alert('Please enter a valid mobile number');
    return;
  }

  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ mobile, role })
  });

  if (data && data.success) {
    currentUser = data.user;
    // Show OTP screen (role-specific)
    showScreen(`screen-otp-${role}`);
  }
}

async function verifyOTP(role) {
  if (!currentUser) return;
  // Simulating successful OTP verification for now
  // In a real app, you'd call an API here
  
  // After verification, load the role-specific dashboard
  loadDashboard(role);
}

async function loadDashboard(role) {
  if (!currentUser) return;
  
  const data = await apiFetch(`/user/${currentUser.id}/dashboard`);
  if (data) {
    // Update UI based on data
    if (role === 'borrower') {
      document.querySelectorAll('.b-name').forEach(el => el.textContent = currentUser.name || 'User');
      showScreen('screen-b-home');
    } else if (role === 'investor') {
      document.querySelectorAll('.i-name').forEach(el => el.textContent = currentUser.name || 'Investor');
      showScreen('screen-i-home');
    } else if (role === 'agent') {
      showScreen('screen-a-home');
    }
  }
}

async function submitLoan() {
  if (!currentUser) return;
  const amount = parseInt(document.getElementById('loan-range').value);
  const purpose = 'Business'; // Mock for now, should get from UI
  const plan = 'Daily'; // Mock for now

  const data = await apiFetch('/loans/apply', {
    method: 'POST',
    body: JSON.stringify({
      borrower_id: currentUser.id,
      amount,
      plan,
      purpose
    })
  });

  if (data && data.success) {
    showScreen('screen-b-success');
  }
}

// Global Helpers
function otpNext(el, nextId) {
  if (el.value.length >= 1) document.getElementById(nextId)?.focus();
}

function copyCode() { showSuccess('Code Copied!', 'Referral code copied to clipboard.'); }
function shareRef(m) { showSuccess('Shared!', `Referral link shared via ${m}.`); }
