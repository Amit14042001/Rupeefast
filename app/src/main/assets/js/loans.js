/**
 * RupeeFast — Loans & Investment Module
 *
 * Borrower domain:
 *   calcLoan(val)          — updates the loan calculator UI (amount, fees, plans)
 *   updatePaymentLabel()   — reflects the selected plan's label
 *   selPurpose(i)          — highlights a purpose button
 *   selPlan(i)             — highlights a repayment plan card
 *   submitLoan()           — submits loan application via API / navigates to success
 *   acceptOffer()          — processes offer acceptance (e-sign simulation)
 *
 * AI Score:
 *   runAIScore()           — step-by-step AI trust score simulation with progress
 *
 * Investor domain:
 *   calcInvest(val)        — updates investment calculator UI
 *   selRisk(r)             — highlights a risk bucket card
 *
 * Dependencies:
 *   shared.js — showToast, showLoading, apiFetch, currentUser, showScreen
 *   navigation.js — showScreen
 */

// ══════════════════════════════════════════════════
// BORROWER: LOAN CALCULATOR
// ══════════════════════════════════════════════════

function calcLoan(val) {
  val = parseInt(val);
  const amtVal = document.getElementById('amt-val');
  if (amtVal) amtVal.textContent = '₹' + val.toLocaleString('en-IN');
  
  const fee = Math.round(val * 0.05);
  const reserve = Math.round(val * 0.05);
  const recv = val - fee - reserve;
  
  const daily = Math.round((val * 1.2) / 100);
  const weekly = Math.round((val * 1.18) / 15);

  const p0Amt = document.getElementById('p0-amt');
  if (p0Amt) p0Amt.textContent = '₹' + daily + '/day';
  const p0Recv = document.getElementById('p0-recv');
  if (p0Recv) p0Recv.textContent = '₹' + recv.toLocaleString('en-IN');
  const p1Amt = document.getElementById('p1-amt');
  if (p1Amt) p1Amt.textContent = '₹' + weekly + '/wk';
  const p1Recv = document.getElementById('p1-recv');
  if (p1Recv) p1Recv.textContent = '₹' + (recv + 200).toLocaleString('en-IN');
  const p2Amt = document.getElementById('p2-amt');
  if (p2Amt) p2Amt.textContent = '₹' + Math.round(val * 1.18).toLocaleString('en-IN') + '/mo';
  
  const sumLoan = document.getElementById('sum-loan');
  if (sumLoan) sumLoan.textContent = '₹' + val.toLocaleString('en-IN');
  const sumFee = document.getElementById('sum-fee');
  if (sumFee) sumFee.textContent = '-₹' + fee.toLocaleString('en-IN');
  const sumRecv = document.getElementById('sum-recv');
  if (sumRecv) sumRecv.textContent = '₹' + recv.toLocaleString('en-IN');
  const sumDaily = document.getElementById('sum-daily');
  if (sumDaily) sumDaily.textContent = '₹' + daily + '/day';
  updatePaymentLabel();
}

function updatePaymentLabel() {
  const labels = ['Daily Payment', 'Weekly Payment', 'Monthly Payment'];
  let selected = 0;
  document.querySelectorAll('.plan-card').forEach((c, i) => {
    if (c.classList.contains('selected')) selected = i;
  });
  const el = document.getElementById('sum-pmt-label');
  const valEl = document.getElementById('sum-daily');
  if (el) el.textContent = labels[selected];
  const vals = ['p0-amt', 'p1-amt', 'p2-amt'];
  const amtEl = document.getElementById(vals[selected]);
  if (amtEl && valEl) {
    valEl.textContent = amtEl.textContent;
  }
}

function selPurpose(i) {
  document.querySelectorAll('.purpose-btn').forEach((b, idx) => {
    if (i === idx) {
      b.style.border = '1.5px solid var(--primary)';
      b.style.background = 'var(--primary-bg)';
      b.style.color = 'var(--primary)';
      b.style.transform = 'scale(1.02)';
    } else {
      b.style.border = '1px solid var(--border)';
      b.style.background = 'var(--surface)';
      b.style.color = 'var(--text2)';
      b.style.transform = 'scale(1)';
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
  updatePaymentLabel();
}

// ══════════════════════════════════════════════════
// BORROWER: SUBMIT LOAN
// ══════════════════════════════════════════════════

async function submitLoan() {
  if (!currentUser) return;
  const amount = parseInt(document.getElementById('loan-range')?.value || 0);
  const purposeEl = document.querySelector('.purpose-btn[style*="border:1.5px solid var(--primary)"]');
  const purpose = purposeEl?.textContent?.trim() || 'Business';
  const plans = ['Daily', 'Weekly', 'Monthly'];
  let plan = 'Daily';
  document.querySelectorAll('.plan-card').forEach((c, i) => {
    if (c.classList.contains('selected')) plan = plans[i];
  });

  const data = await apiFetch('/loans/apply', {
    method: 'POST',
    body: JSON.stringify({ amount, plan, purpose }),
    showLoader: true
  });

  if (data && data.success) {
    showScreen('screen-b-success');
  }
}

function acceptOffer() {
  if (!currentUser) {
    showToast('Please login first', 'error');
    return;
  }
  showToast('Processing e-sign...', 'info');
  setTimeout(() => {
    showScreen('screen-b-success');
  }, 1000);
}

// ══════════════════════════════════════════════════
// AI TRUST SCORE
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
  const circle = document.getElementById('ai-circle');

  if (prog) prog.style.width = '0%';
  if (checks) checks.innerHTML = '';
  if (doneBtn) doneBtn.style.display = 'none';

  let i = 0;
  const timer = setInterval(() => {
    if (i < steps.length) {
      if (lbl) lbl.textContent = steps[i];
      const pct = Math.round(((i + 1) / steps.length) * 100);
      if (prog) prog.style.width = pct + '%';
      if (pctEl) pctEl.textContent = pct + '%';

      if (circle) {
        const circumference = 2 * Math.PI * 70;
        circle.style.strokeDasharray = circumference;
        circle.style.strokeDashoffset = circumference - (circumference * pct / 100);
      }
      
      if (checks) {
        const chk = document.createElement('div');
        chk.style.cssText = 'font-size:12px;color:var(--green);display:flex;align-items:center;gap:6px;animation:fadeInUp 0.3s ease;';
        chk.innerHTML = `<i class="ti ti-check" style="font-size:14px;"></i>${icons[i]}`;
        checks.appendChild(chk);
      }
      i++;
    } else {
      clearInterval(timer);
      if (lbl) lbl.textContent = 'Analysis complete!';
      if (doneBtn) doneBtn.style.display = 'block';
      showToast('AI Trust Score calculated successfully!', 'success');
    }
  }, 700);
}

// ══════════════════════════════════════════════════
// INVESTOR: CALCULATORS
// ══════════════════════════════════════════════════

function calcInvest(val) {
  val = parseInt(val);
  const invAmtVal = document.getElementById('inv-amt-val');
  if (invAmtVal) invAmtVal.textContent = '₹' + val.toLocaleString('en-IN');
  const invTotal = document.getElementById('inv-total');
  if (invTotal) invTotal.textContent = '₹' + val.toLocaleString('en-IN');
  
  const borrowersCount = Math.max(1, Math.floor(val / 500));
  const invBorrowers = document.getElementById('inv-borrowers');
  if (invBorrowers) invBorrowers.textContent = borrowersCount + ' borrowers × ₹500';
  
  const monthlyReturn = Math.round(val * 0.03);
  const invMonthly = document.getElementById('inv-monthly');
  if (invMonthly) invMonthly.textContent = '₹' + monthlyReturn.toLocaleString('en-IN');
  
  const riskPct = Math.round((500 / val) * 100);
  const invRisk = document.getElementById('inv-risk');
  if (invRisk) invRisk.textContent = 'Only ₹500 at risk (' + riskPct + '%)';
}

function selRisk(r) {
  ['safe', 'mod', 'high'].forEach(k => {
    const el = document.getElementById('rb-' + k);
    if (!el) return;
    if (k === r) {
      el.classList.add('selected');
    } else {
      el.classList.remove('selected');
    }
  });
}
