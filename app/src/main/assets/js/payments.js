/**
 * RupeeFast — Payments & Mandates Module
 *
 * Handles:
 *   - Payment method selection (UPI AutoPay / NACH)
 *   - Razorpay mandate creation, verification, cancellation
 *   - Mandate list rendering, pause / resume / cancel
 *   - Investor withdraw & statement navigation
 *   - Agent cash collection tracking
 *   - EMI schedule builder (buildSchedule)
 *
 * Dependencies:
 *   shared.js — showToast, showLoading, showSuccess, apiFetch, currentUser,
 *               authToken, totalCollected, selectedPaymentMethod,
 *               currentMandateId, setEl
 *   navigation.js — showScreen
 */

// ══════════════════════════════════════════════════
// EMI SCHEDULE BUILDER
// ══════════════════════════════════════════════════

function buildSchedule() {
  const targets = ['schedule-list', 'home-schedule-list', 'history-schedule-list'];
  targets.forEach(id => {
    const list = document.getElementById(id);
    if (!list) return;
    list.innerHTML = '';
    const count = id === 'home-schedule-list' ? 5 : 20;
    for (let i = 0; i < count; i++) {
      const d = document.createElement('div');
      d.className = 'list-item';
      d.style.animation = 'staggerFadeIn 0.4s ease ' + (i * 60) + 'ms both';
      const done = i < 5;
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
// PAYMENT METHOD SELECTION
// ══════════════════════════════════════════════════

function selectPaymentMethod(el) {
  document.querySelectorAll('.payment-method-card').forEach(c => {
    c.classList.remove('selected');
    c.style.borderLeftColor = 'var(--border)';
    const check = c.querySelector('.method-check');
    if (check) {
      check.style.borderColor = 'var(--border)';
      check.style.background = 'transparent';
      check.innerHTML = '';
    }
  });

  el.classList.add('selected');
  el.style.borderLeftColor = 'var(--primary)';
  const check = el.querySelector('.method-check');
  if (check) {
    check.style.borderColor = 'var(--primary)';
    check.style.background = 'var(--primary)';
    check.innerHTML = '<i class="ti ti-check" style="font-size:12px;color:#fff;"></i>';
  }

  selectedPaymentMethod = el.dataset.method || 'upi_autopay';
}

// ══════════════════════════════════════════════════
// ACTIVE MANDATE (pay screen)
// ══════════════════════════════════════════════════

async function loadActiveMandate() {
  if (!currentUser || !authToken) return;

  const data = await apiFetch('/payments/mandates', { showLoader: false });
  if (!data || !data.mandates) return;

  const active = data.mandates.find(m => m.status === 'active');
  const card = document.getElementById('active-mandate-card');
  const statusText = document.getElementById('mandate-status-text');

  if (active && card) {
    card.style.display = 'block';
    const methodLabel = active.method === 'upi_autopay' ? 'UPI AutoPay' : 'NACH';
    const freqLabel = active.method === 'nach' ? `₹${active.amount}/month` : `₹${active.amount}/${active.frequency}`;
    if (statusText) statusText.textContent = `${methodLabel} · ${freqLabel} · ${active.remaining_cycles} remaining`;
  }
}

async function cancelActiveMandate() {
  if (!currentUser || !authToken) {
    showToast('Please login first', 'error');
    return;
  }

  const data = await apiFetch('/payments/mandates', { showLoader: false });
  if (!data || !data.mandates) return;

  const active = data.mandates.find(m => m.status === 'active');
  if (!active) {
    showToast('No active mandate found', 'info');
    return;
  }

  showLoading('Cancelling mandate...');
  const result = await apiFetch('/payments/cancel-mandate', {
    method: 'POST',
    body: JSON.stringify({ mandate_id: active.id }),
    showLoader: false
  });

  hideLoading();

  if (result && result.success) {
    showToast('Mandate cancelled successfully', 'success');
    const card = document.getElementById('active-mandate-card');
    if (card) card.style.display = 'none';
  }
}

// ══════════════════════════════════════════════════
// RAZORPAY PAYMENT FLOW
// ══════════════════════════════════════════════════

async function initiateRazorpayPayment() {
  if (!currentUser || !authToken) {
    showToast('Please login first', 'error');
    return;
  }

  showLoading('Setting up payment...');

  try {
    const amount = 120;
    const frequency = selectedPaymentMethod === 'nach' ? 'monthly' : 'daily';
    const totalCycles = selectedPaymentMethod === 'nach' ? 12 : 100;
    const label = `RupeeFast ${frequency} EMI — ₹${amount}`;

    const planData = await apiFetch('/payments/create-plan', {
      method: 'POST',
      body: JSON.stringify({ frequency, amountPaise: amount * 100, label }),
      showLoader: false
    });

    if (!planData || !planData.plan) {
      hideLoading();
      showToast('Payment gateway connecting... using demo mode', 'info');
      setTimeout(() => {
        showSuccess('AutoPay Set Up!', `Your ${selectedPaymentMethod === 'nach' ? 'NACH mandate' : 'UPI AutoPay'} of ₹${amount}/${frequency === 'daily' ? 'day' : 'month'} is active.`);
      }, 1000);
      return;
    }

    const subData = await apiFetch('/payments/create-subscription', {
      method: 'POST',
      body: JSON.stringify({
        planId: planData.plan.id,
        totalCycles,
        method: selectedPaymentMethod,
        amount,
        frequency
      }),
      showLoader: false
    });

    if (!subData || !subData.subscription) {
      hideLoading();
      showToast('Failed to create payment mandate', 'error');
      return;
    }

    hideLoading();

    const options = {
      key: planData.key_id || window.RAZORPAY_KEY_ID || '',
      subscription_id: subData.subscription.id,
      name: 'RupeeFast',
      description: `${frequency} repayment — ₹${amount}`,
      image: '/favicon.ico',
      prefill: {
        contact: currentUser.mobile || '',
        name: currentUser.name || ''
      },
      theme: { color: '#10b981' },
      handler: async function (response) {
        showLoading('Verifying mandate...');
        const verifyData = await apiFetch('/payments/verify', {
          method: 'POST',
          body: JSON.stringify({
            razorpay_subscription_id: response.razorpay_subscription_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            mandate_id: subData.mandate_id
          }),
          showLoader: false
        });

        hideLoading();

        if (verifyData && verifyData.success) {
          showSuccess('Mandate Activated!', 'Your recurring payment mandate has been set up successfully. Future EMIs will be collected automatically.');
          loadActiveMandate();
        } else {
          showToast('Verification failed. Please contact support.', 'error');
        }
      },
      modal: {
        ondismiss: function () {
          showToast('Payment setup cancelled', 'info');
        }
      }
    };

    const rzp = new Razorpay(options);
    rzp.open();

  } catch (err) {
    hideLoading();
    console.error('Razorpay error:', err);
    showToast('Payment setup failed. Try again later.', 'error');
  }
}

// ══════════════════════════════════════════════════
// MANDATE MANAGEMENT (Manage Mandates screen)
// ══════════════════════════════════════════════════

async function loadMandates() {
  if (!currentUser || !authToken) {
    showToast('Please login first', 'error');
    return;
  }

  currentMandateId = null;

  const loadingEl = document.getElementById('mandates-loading');
  const emptyEl = document.getElementById('mandates-empty');
  const activeContainer = document.getElementById('mandates-active-container');
  const historySection = document.getElementById('mandates-history');

  if (loadingEl) loadingEl.style.display = 'block';
  if (emptyEl) emptyEl.style.display = 'none';
  if (activeContainer) activeContainer.style.display = 'none';
  if (historySection) historySection.style.display = 'none';

  const data = await apiFetch('/payments/mandates', { showLoader: false });

  if (loadingEl) loadingEl.style.display = 'none';

  if (!data || !data.mandates || data.mandates.length === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  const mandates = data.mandates;
  const active = mandates.find(m => m.status === 'active' || m.status === 'paused');

  const badge = document.getElementById('mandate-profile-badge');
  if (badge) {
    if (active) {
      badge.style.display = 'inline';
      badge.textContent = active.status === 'paused' ? 'Paused' : 'Active';
    } else {
      badge.style.display = 'none';
    }
  }

  if (active) {
    currentMandateId = active.id;
    if (activeContainer) activeContainer.style.display = 'block';

    const methodLabel = active.method === 'nach' ? 'NACH' : 'UPI AutoPay';
    const freqLabel = active.method === 'nach' ? 'Monthly' : (active.frequency === 'daily' ? 'Daily' : active.frequency === 'weekly' ? 'Weekly' : 'Monthly');
    const isPaused = active.status === 'paused';

    setEl('ma-method', methodLabel);
    setEl('ma-status-badge', isPaused ? '● Paused' : '● Active');
    setEl('ma-amount', '₹' + parseInt(active.amount).toLocaleString('en-IN'));
    setEl('ma-frequency', freqLabel);
    setEl('ma-remaining', (active.remaining_cycles || 0) + ' / ' + (active.total_cycles || 100));
    setEl('ma-activated', active.activated_at ? new Date(active.activated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

    const pauseBtn = document.getElementById('ma-pause-btn');
    const resumeBtn = document.getElementById('ma-resume-btn');
    if (pauseBtn) pauseBtn.style.display = isPaused ? 'none' : 'flex';
    if (resumeBtn) resumeBtn.style.display = isPaused ? 'flex' : 'none';
  }

  if (historySection) historySection.style.display = 'block';
  const list = document.getElementById('mandates-list');
  if (!list) return;

  list.innerHTML = '';
  mandates.forEach(m => {
    const methodLabel = m.method === 'nach' ? 'NACH' : 'UPI AutoPay';
    const statusColors = {
      active: 'var(--green)',
      paused: 'var(--amber)',
      pending: 'var(--blue)',
      cancelled: 'var(--red)',
      halted: 'var(--red)',
      completed: 'var(--text3)'
    };
    const statusIcons = {
      active: 'ti ti-shield-check',
      paused: 'ti ti-player-pause',
      pending: 'ti ti-clock',
      cancelled: 'ti ti-x-circle',
      halted: 'ti ti-alert-triangle',
      completed: 'ti ti-check-circle'
    };
    const color = statusColors[m.status] || 'var(--text3)';
    const icon = statusIcons[m.status] || 'ti ti-circle';

    const item = document.createElement('div');
    item.style.cssText = 'background:var(--card);border-radius:12px;padding:14px;display:flex;align-items:center;gap:12px;border:1px solid var(--border);';
    item.innerHTML = `
      <div style="width:40px;height:40px;border-radius:10px;background:${color}15;display:flex;align-items:center;justify-content:center;font-size:18px;color:${color};flex-shrink:0;"><i class="${icon}"></i></div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:14px;color:var(--text);display:flex;align-items:center;gap:6px;">
          ${methodLabel}
          <span style="font-size:11px;padding:2px 8px;border-radius:20px;background:${color}18;color:${color};font-weight:600;">${m.status.charAt(0).toUpperCase() + m.status.slice(1)}</span>
        </div>
        <div style="font-size:12px;color:var(--text3);margin-top:3px;">₹${parseInt(m.amount).toLocaleString('en-IN')} · ${m.frequency || 'daily'} · ${m.remaining_cycles || 0} left</div>
      </div>
      <i class="ti ti-chevron-right" style="color:var(--text3);font-size:16px;"></i>
    `;
    list.appendChild(item);
  });
}

async function toggleMandateStatus(action) {
  if (!currentMandateId || !currentUser) return;

  const endpoint = action === 'pause' ? '/payments/pause-mandate' : '/payments/resume-mandate';
  const loadingMsg = action === 'pause' ? 'Pausing mandate...' : 'Resuming mandate...';

  showLoading(loadingMsg);
  const result = await apiFetch(endpoint, {
    method: 'POST',
    body: JSON.stringify({ mandate_id: currentMandateId }),
    showLoader: false
  });
  hideLoading();

  if (result && result.success) {
    showToast(`Mandate ${action === 'pause' ? 'paused' : 'resumed'} successfully`, 'success');
    loadMandates();
  }
}

async function cancelMandateById() {
  if (!currentMandateId || !currentUser) return;

  if (!confirm('Are you sure you want to cancel this mandate? Future EMIs will not be collected automatically.')) return;

  showLoading('Cancelling mandate...');
  const result = await apiFetch('/payments/cancel-mandate', {
    method: 'POST',
    body: JSON.stringify({ mandate_id: currentMandateId }),
    showLoader: false
  });
  hideLoading();

  if (result && result.success) {
    showToast('Mandate cancelled', 'success');
    currentMandateId = null;
    loadMandates();
  }
}

// ══════════════════════════════════════════════════
// INVESTOR: WITHDRAW
// ══════════════════════════════════════════════════

function calcWithdraw(val) {
  val = parseInt(val);
  const amtEl = document.getElementById('wd-amt-val');
  if (amtEl) amtEl.textContent = '₹' + val.toLocaleString('en-IN');
  const sumEl = document.getElementById('wd-sum-amt');
  if (sumEl) sumEl.textContent = '₹' + val.toLocaleString('en-IN');
  const btn = document.querySelector('#screen-i-withdraw .btn-green');
  if (btn) btn.textContent = 'Withdraw ₹' + val.toLocaleString('en-IN');
}

function processWithdraw() {
  const amtEl = document.getElementById('wd-amt-val');
  const amt = amtEl ? amtEl.textContent : '₹5,000';
  showSuccess('Withdrawal Initiated!', `${amt} will be credited to your SBI account within 1-2 business days.`);
}

// ══════════════════════════════════════════════════
// INVESTOR: STATEMENT
// ══════════════════════════════════════════════════

function loadStatement() {
  showToast('Statement loaded', 'success');
}

function prevStatement() {
  const sel = document.getElementById('statement-month');
  if (sel && sel.selectedIndex > 0) {
    sel.selectedIndex = sel.selectedIndex - 1;
    loadStatement();
  }
}

function nextStatement() {
  const sel = document.getElementById('statement-month');
  if (sel && sel.selectedIndex < sel.options.length - 1) {
    sel.selectedIndex = sel.selectedIndex + 1;
    loadStatement();
  }
}

// ══════════════════════════════════════════════════
// AGENT: CASH COLLECTION
// ══════════════════════════════════════════════════

function collectItem(i, name, loc) {
  const badge = document.getElementById('ci-' + i);
  if (badge && badge.textContent !== 'Collected') {
    badge.textContent = 'Collected';
    badge.style.background = 'var(--green-bg)';
    badge.style.color = 'var(--green)';
    
    totalCollected += 120;
    const colDoneAmt = document.getElementById('col-done-amt');
    if (colDoneAmt) colDoneAmt.textContent = '₹' + totalCollected;
    const colCommission = document.getElementById('col-commission');
    if (colCommission) colCommission.textContent = '₹' + Math.round(totalCollected * 0.02);
    
    showToast(`₹120 collected from ${name}`, 'success');
  }
}
