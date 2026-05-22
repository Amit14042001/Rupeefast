/**
 * Unit tests for app.js (frontend client logic).
 *
 * These tests use jsdom to simulate a browser environment with the full
 * index.html DOM and all app.js functions loaded globally.
 *
 * Focus areas:
 * - Navigation (showScreen, tab switching) — affected by screen structure
 * - Form interactions (doLogin, sendChat, otpNext, copyCode) — affected by <form> wrappers
 * - Calculations (calcLoan, calcInvest) — pure logic
 * - UI utilities (showToast, showLoading, showSuccess) — DOM manipulation
 */

beforeEach(() => {
  // Reset DOM and storage before each test
  document.body.innerHTML = '';
  jest.restoreAllMocks();
  global.clearStorage();
  // Default mock fetch to succeed
  global.mockFetch({ success: true, user: { id: 1, name: 'Test' }, token: 'fake-jwt' });
});

/**
 * Helper: load shell DOM, screens.js, and app.js in the correct order.
 * Screens are lazily rendered on first showScreen() call.
 */
function setupFullApp() {
  global.setupAppDOM();
  global.setupScreensJS();
  global.loadAppJS();
}

/**
 * Helper: render all screens into the DOM (used by form structure regression tests).
 */
function renderAllScreens() {
  if (typeof window.SCREENS !== 'undefined') {
    Object.keys(window.SCREENS).forEach(id => {
      if (typeof renderScreen === 'function') renderScreen(id);
    });
  }
}

// ═══════════════════════════════════════════════════════
// LAZY RENDERING TESTS
// ═══════════════════════════════════════════════════════

describe('Lazy Rendering — renderScreen()', () => {
  test('renders a screen into the DOM on first access', () => {
    setupFullApp();

    // Screen should NOT exist initially
    expect(document.getElementById('screen-login-borrower')).toBeNull();

    // renderScreen should inject it
    renderScreen('screen-login-borrower');
    expect(document.getElementById('screen-login-borrower')).not.toBeNull();
  });

  test('does not re-render an already-present screen', () => {
    setupFullApp();

    // screen-home is in the shell HTML
    const homeCountBefore = document.querySelectorAll('.screen').length;
    renderScreen('screen-home');
    const homeCountAfter = document.querySelectorAll('.screen').length;

    expect(homeCountAfter).toBe(homeCountBefore);
  });

  test('does not re-render an already-rendered screen', () => {
    setupFullApp();

    renderScreen('screen-b-home');
    const countAfterFirst = document.querySelectorAll('.screen').length;

    renderScreen('screen-b-home');
    const countAfterSecond = document.querySelectorAll('.screen').length;

    expect(countAfterSecond).toBe(countAfterFirst);
  });

  test('warns if the screen ID is not in SCREENS map', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    setupFullApp();

    renderScreen('non-existent-screen');

    expect(warnSpy).toHaveBeenCalledWith(
      'Screen HTML not found in SCREENS map:',
      'non-existent-screen'
    );
    warnSpy.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════
// RENDER PERFORMANCE TRACKING TESTS
// ═══════════════════════════════════════════════════════

describe('Render Performance — renderPerfLog & renderPerf', () => {
  test('renderScreen logs timing entry to renderPerfLog on first render', () => {
    setupFullApp();

    // Should not exist in DOM yet
    expect(document.getElementById('screen-b-apply')).toBeNull();
    const logLenBefore = window.__renderPerfLog.length;

    renderScreen('screen-b-apply');

    // Should have one new entry
    expect(window.__renderPerfLog.length).toBe(logLenBefore + 1);

    const entry = window.__renderPerfLog[logLenBefore];
    expect(entry.id).toBe('screen-b-apply');
    expect(entry.lookupMs).toBeGreaterThanOrEqual(0);
    expect(entry.injectMs).toBeGreaterThanOrEqual(0);
    expect(entry.totalMs).toBeGreaterThanOrEqual(0);
    expect(entry.htmlSizeKB).toBeGreaterThan(0);
    expect(typeof entry.htmlSizeKB).toBe('number');
  });

  test('renderPerf stores the latest entry keyed by screen id', () => {
    setupFullApp();

    renderScreen('screen-b-apply');

    expect(window.__renderPerf['screen-b-apply']).toBeDefined();
    expect(window.__renderPerf['screen-b-apply'].id).toBe('screen-b-apply');
    expect(window.__renderPerf['screen-b-apply'].totalMs).toBeGreaterThanOrEqual(0);
  });

  test('renderPerfLog accumulates multiple entries across different screens', () => {
    setupFullApp();

    renderScreen('screen-b-apply');
    renderScreen('screen-b-home');
    renderScreen('screen-b-schedule');

    // screen-b-home was already in shell HTML, so it should NOT add an entry
    const logEntryIds = window.__renderPerfLog.map(e => e.id);
    expect(logEntryIds).toContain('screen-b-apply');
    expect(logEntryIds).toContain('screen-b-schedule');
    // screen-b-home was already in DOM, skip
    expect(logEntryIds).not.toContain('screen-home');
  });

  test('no duplicate renderPerfLog entries for same screen rendered twice', () => {
    setupFullApp();

    renderScreen('screen-b-apply');
    const countAfterFirst = window.__renderPerfLog.length;

    renderScreen('screen-b-apply');
    const countAfterSecond = window.__renderPerfLog.length;

    // Second call should not add another entry (already rendered)
    expect(countAfterSecond).toBe(countAfterFirst);
  });

  test('non-existent screen does not add perf log entry', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    setupFullApp();

    const logLenBefore = window.__renderPerfLog.length;
    renderScreen('does-not-exist');

    expect(window.__renderPerfLog.length).toBe(logLenBefore);
    warnSpy.mockRestore();
  });

  test('window.__renderPerf and window.__renderPerfLog are accessible from console', () => {
    setupFullApp();

    expect(window.__renderPerf).toBeDefined();
    expect(window.__renderPerfLog).toBeDefined();
    expect(Array.isArray(window.__renderPerfLog)).toBe(true);
    expect(typeof window.__renderPerf).toBe('object');
  });

  test('showScreen triggers click-to-paint log for first-time rendered screens', () => {
    // requestAnimationFrame polyfill in jsdom may not fire in tests,
    // so we verify the path exists by checking window.__renderPerfLog is updated
    jest.useFakeTimers();
    setupFullApp();

    // screen-b-apply is not yet rendered
    expect(document.getElementById('screen-b-apply')).toBeNull();

    showScreen('screen-b-apply');

    // After showScreen, the screen should be in DOM and renderPerfLog should have it
    expect(document.getElementById('screen-b-apply')).not.toBeNull();
    expect(window.__renderPerf['screen-b-apply']).toBeDefined();
    expect(window.__renderPerf['screen-b-apply'].id).toBe('screen-b-apply');
  });
});

// ═══════════════════════════════════════════════════════
// NAVIGATION TESTS
// ═══════════════════════════════════════════════════════

describe('Navigation — showScreen()', () => {
  test('shows the target screen and hides others', () => {
    setupFullApp();

    const screen1 = document.getElementById('screen-home');
    // screen-login-borrower is NOT in DOM yet (lazy rendering)
    expect(document.getElementById('screen-login-borrower')).toBeNull();

    // Initially screen-home is active
    expect(screen1.classList.contains('active')).toBe(true);

    // Navigate to borrower login (this lazily renders the screen)
    showScreen('screen-login-borrower');

    const screen2 = document.getElementById('screen-login-borrower');
    expect(screen2).not.toBeNull();
    expect(screen1.classList.contains('active')).toBe(false);
    expect(screen2.classList.contains('active')).toBe(true);
  });

  test('does nothing if screen id does not exist', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    setupFullApp();

    showScreen('non-existent-screen');

    expect(warnSpy).toHaveBeenCalledWith('Screen not found:', 'non-existent-screen');
    warnSpy.mockRestore();
  });

  test('navigates between all borrower screens without error', () => {
    setupFullApp();

    const screens = [
      'screen-home',
      'screen-login-borrower',
      'screen-otp-borrower',
      'screen-b-home',
      'screen-b-apply',
      'screen-b-schedule',
      'screen-b-profile',
      'screen-b-settings',
      'screen-b-help',
      'screen-b-kyc',
    ];

    screens.forEach(id => {
      expect(() => showScreen(id)).not.toThrow();
      const el = document.getElementById(id);
      expect(el.classList.contains('active')).toBe(true);
    });
  });

  test('navigates between all investor screens without error', () => {
    setupFullApp();

    const screens = [
      'screen-login-investor',
      'screen-otp-investor',
      'screen-i-home',
      'screen-i-invest',
      'screen-i-loans',
      'screen-i-profile',
    ];

    screens.forEach(id => {
      expect(() => showScreen(id)).not.toThrow();
      const el = document.getElementById(id);
      expect(el.classList.contains('active')).toBe(true);
    });
  });

  test('navigates between all agent screens without error', () => {
    setupFullApp();

    const screens = [
      'screen-login-agent',
      'screen-otp-agent',
      'screen-a-home',
      'screen-a-tasks',
      'screen-a-verify',
      'screen-a-verify-detail',
      'screen-a-acquire',
      'screen-a-profile',
      'screen-a-earnings',
    ];

    screens.forEach(id => {
      expect(() => showScreen(id)).not.toThrow();
      const el = document.getElementById(id);
      expect(el.classList.contains('active')).toBe(true);
    });
  });
});

describe('Navigation — Tab switching (showBTab / showITab / showATab)', () => {
  test('showBTab switches screen and highlights active tab', () => {
    setupFullApp();
    showScreen('screen-b-home');

    const tabBtn = document.querySelector('#screen-b-home .bottom-nav .nav-item');
    showBTab('screen-b-apply', tabBtn);

    const applyScreen = document.getElementById('screen-b-apply');
    expect(applyScreen.classList.contains('active')).toBe(true);
  });

  test('showITab is an alias for showBTab', () => {
    setupFullApp();
    showScreen('screen-i-home');

    expect(showITab).toBe(showBTab);
  });

  test('showATab is an alias for showBTab', () => {
    setupFullApp();
    showScreen('screen-a-home');

    expect(showATab).toBe(showBTab);
  });
});

describe('Navigation — Success overlay', () => {
  test('showSuccess displays the overlay with title and message', () => {
    setupFullApp();

    showSuccess('Test Title', 'Test Message');

    const overlay = document.getElementById('success-overlay');
    expect(overlay.style.display).toBe('flex');
    expect(document.getElementById('so-title').textContent).toBe('Test Title');
    expect(document.getElementById('so-msg').textContent).toBe('Test Message');
  });

  test('closeSuccess hides the overlay', () => {
    setupFullApp();
    showSuccess('Title', 'Msg');
    closeSuccess();

    const overlay = document.getElementById('success-overlay');
    expect(overlay.style.display).toBe('none');
  });
});

// ═══════════════════════════════════════════════════════
// CALCULATION TESTS
// ═══════════════════════════════════════════════════════

describe('Calculations — calcLoan()', () => {
  beforeEach(() => {
    setupFullApp();
    // Navigate to apply screen first to ensure plan cards render
    showScreen('screen-b-apply');
  });

  test('correctly calculates values for 8000 loan', () => {
    calcLoan(8000);

    expect(document.getElementById('amt-val').textContent).toBe('₹8,000');
    expect(document.getElementById('sum-loan').textContent).toBe('₹8,000');
    // Fee = 5% of 8000 = 400
    expect(document.getElementById('sum-fee').textContent).toBe('-₹400');
    // Receive = 8000 - 400 - 400 (fee + reserve) = 7200
    expect(document.getElementById('sum-recv').textContent).toBe('₹7,200');
    // Daily = 8000 * 1.2 / 100 = 96
    expect(document.getElementById('p0-amt').textContent).toContain('96');
  });

  test('correctly calculates values for 12000 loan (max)', () => {
    calcLoan(12000);

    expect(document.getElementById('amt-val').textContent).toBe('₹12,000');
    expect(document.getElementById('sum-loan').textContent).toBe('₹12,000');
    // Fee = 5% of 12000 = 600
    expect(document.getElementById('sum-fee').textContent).toBe('-₹600');
    // Receive = 12000 - 600 - 600 = 10800
    expect(document.getElementById('sum-recv').textContent).toBe('₹10,800');
  });

  test('correctly calculates values for 2000 loan (min)', () => {
    calcLoan(2000);

    expect(document.getElementById('amt-val').textContent).toBe('₹2,000');
    expect(document.getElementById('sum-loan').textContent).toBe('₹2,000');
    expect(document.getElementById('sum-fee').textContent).toBe('-₹100');
    expect(document.getElementById('sum-recv').textContent).toBe('₹1,800');
  });

  test('handles zero value without errors', () => {
    // calcLoan reads from elements already rendered by showScreen('screen-b-apply') in beforeEach
    calcLoan(0);
    expect(document.getElementById('amt-val').textContent).toBe('₹0');
  });
});

describe('Calculations — calcInvest()', () => {
  beforeEach(() => {
    setupFullApp();
    showScreen('screen-i-invest');
  });

  test('correctly calculates values for 10000 investment', () => {
    calcInvest(10000);

    expect(document.getElementById('inv-amt-val').textContent).toBe('₹10,000');
    expect(document.getElementById('inv-total').textContent).toBe('₹10,000');
    // 20 borrowers × ₹500
    expect(document.getElementById('inv-borrowers').textContent).toBe('20 borrowers × ₹500');
    // Monthly return = 3% of 10000 = 300
    expect(document.getElementById('inv-monthly').textContent).toBe('₹300');
    // Max risk = 500 / 10000 = 5%
    expect(document.getElementById('inv-risk').textContent).toContain('5%)');
  });

  test('correctly calculates values for 50000 investment', () => {
    calcInvest(50000);

    expect(document.getElementById('inv-amt-val').textContent).toBe('₹50,000');
    expect(document.getElementById('inv-total').textContent).toBe('₹50,000');
    expect(document.getElementById('inv-borrowers').textContent).toBe('100 borrowers × ₹500');
    expect(document.getElementById('inv-monthly').textContent).toBe('₹1,500');
  });

  test('handles minimum investment of 5000', () => {
    calcInvest(5000);

    expect(document.getElementById('inv-amt-val').textContent).toBe('₹5,000');
    expect(document.getElementById('inv-borrowers').textContent).toBe('10 borrowers × ₹500');
  });
});

describe('Calculations — selPlan()', () => {
  beforeEach(() => {
    setupFullApp();
    showScreen('screen-b-apply');
  });

  test('selects the first plan by default', () => {
    calcLoan(8000);
    selPlan(0);

    const planCards = document.querySelectorAll('.plan-card');
    expect(planCards[0].classList.contains('selected')).toBe(true);
    expect(planCards[1].classList.contains('selected')).toBe(false);
    expect(planCards[2].classList.contains('selected')).toBe(false);
  });

  test('selects each plan correctly and deselects others', () => {
    calcLoan(8000);

    // Select plan 1 (Weekly)
    selPlan(1);
    const planCards = document.querySelectorAll('.plan-card');
    expect(planCards[0].classList.contains('selected')).toBe(false);
    expect(planCards[1].classList.contains('selected')).toBe(true);
    expect(planCards[2].classList.contains('selected')).toBe(false);

    // Select plan 2 (Monthly)
    selPlan(2);
    expect(planCards[0].classList.contains('selected')).toBe(false);
    expect(planCards[1].classList.contains('selected')).toBe(false);
    expect(planCards[2].classList.contains('selected')).toBe(true);
  });

  test('updates the payment label when plan changes', () => {
    calcLoan(8000);

    selPlan(0);
    expect(document.getElementById('sum-pmt-label').textContent).toBe('Daily Payment');

    selPlan(1);
    expect(document.getElementById('sum-pmt-label').textContent).toBe('Weekly Payment');

    selPlan(2);
    expect(document.getElementById('sum-pmt-label').textContent).toBe('Monthly Payment');
  });
});

describe('Calculations — selPurpose()', () => {
  beforeEach(() => {
    setupFullApp();
    showScreen('screen-b-apply');
  });

  test('highlights the selected purpose button', () => {
    selPurpose(0);
    const buttons = document.querySelectorAll('.purpose-btn');
    // jsdom returns empty string for CSS variable border colors;
    // we check the border style string instead
    expect(buttons[0].style.border).toContain('var(--primary)');

    selPurpose(1);
    expect(buttons[0].style.border).toContain('var(--border)');
    expect(buttons[1].style.border).toContain('var(--primary)');
  });
});

describe('Calculations — selRisk()', () => {
  beforeEach(() => {
    setupFullApp();
    showScreen('screen-i-invest');
  });

  test('selects SAFE risk bucket', () => {
    selRisk('safe');

    expect(document.getElementById('rb-safe').classList.contains('selected')).toBe(true);
    expect(document.getElementById('rb-mod').classList.contains('selected')).toBe(false);
  });

  test('selects MODERATE risk bucket', () => {
    selRisk('mod');

    expect(document.getElementById('rb-safe').classList.contains('selected')).toBe(false);
    expect(document.getElementById('rb-mod').classList.contains('selected')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// FORM INTERACTION TESTS
// ═══════════════════════════════════════════════════════

describe('Form Interactions — doLogin()', () => {
  beforeEach(() => {
    setupFullApp();
    // Toast spy to avoid test noise
    jest.spyOn(window, 'showToast').mockImplementation(() => {});
  });

  test('reads mobile number from borrower login input (inside <form>)', async () => {
    showScreen('screen-login-borrower');
    const input = document.getElementById('mobile-borrower');
    input.value = '9876543210';

    await doLogin('borrower');

    // Should have called API with the mobile number
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/login'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('9876543210'),
      })
    );
  });

  test('reads mobile number from investor login input (inside <form>)', async () => {
    showScreen('screen-login-investor');
    const input = document.getElementById('mobile-investor');
    input.value = '9988776655';

    await doLogin('investor');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/login'),
      expect.objectContaining({
        body: expect.stringContaining('9988776655'),
      })
    );
  });

  test('reads mobile number from agent login input (inside <form>)', async () => {
    showScreen('screen-login-agent');
    const input = document.getElementById('mobile-agent');
    input.value = '9123456789';

    await doLogin('agent');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/login'),
      expect.objectContaining({
        body: expect.stringContaining('9123456789'),
      })
    );
  });

  test('shows error toast if mobile number is less than 10 digits', async () => {
    showScreen('screen-login-borrower');
    const input = document.getElementById('mobile-borrower');
    input.value = '12345';

    await doLogin('borrower');

    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('valid 10-digit'),
      'error'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('shows error toast if mobile number is empty', async () => {
    showScreen('screen-login-borrower');
    const input = document.getElementById('mobile-borrower');
    input.value = '';

    await doLogin('borrower');

    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('valid 10-digit'),
      'error'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('navigates to OTP screen on successful login', async () => {
    showScreen('screen-login-borrower');
    const input = document.getElementById('mobile-borrower');
    input.value = '9876543210';

    await doLogin('borrower');

    const otpScreen = document.getElementById('screen-otp-borrower');
    expect(otpScreen.classList.contains('active')).toBe(true);
  });
});

describe('Form Interactions — otpNext()', () => {
  beforeEach(() => {
    setupFullApp();
  });

  test('focuses the next OTP input when current input has a value', () => {
    showScreen('screen-otp-borrower');
    const el = document.getElementById('otp1');
    const next = document.getElementById('otp2');
    const focusSpy = jest.spyOn(next, 'focus');

    el.value = '1';
    otpNext(el, 'otp2');

    expect(focusSpy).toHaveBeenCalled();
  });

  test('does not focus next if current input is empty', () => {
    showScreen('screen-otp-borrower');
    const el = document.getElementById('otp1');
    const next = document.getElementById('otp2');
    const focusSpy = jest.spyOn(next, 'focus');

    el.value = '';
    otpNext(el, 'otp2');

    expect(focusSpy).not.toHaveBeenCalled();
  });

  test('works for all three roles OTP inputs', () => {
    showScreen('screen-otp-borrower');
    const bNext = document.getElementById('otp2');
    const bFocusSpy = jest.spyOn(bNext, 'focus');
    otpNext(document.getElementById('otp1'), 'otp2');
    // otp1 is empty so it shouldn't focus
    expect(bFocusSpy).not.toHaveBeenCalled();

    // Fill otp1 and test
    document.getElementById('otp1').value = '1';
    otpNext(document.getElementById('otp1'), 'otp2');
    expect(bFocusSpy).toHaveBeenCalled();
  });

  test('borrower OTP inputs are inside <form> — form does not break navigation', () => {
    showScreen('screen-otp-borrower');
    const form = document.querySelector('#screen-otp-borrower form');
    expect(form).not.toBeNull();

    const inputs = form.querySelectorAll('.otp-input');
    expect(inputs.length).toBe(4);
    // Verify OTP flow still works
    inputs[0].value = '1';
    otpNext(inputs[0], 'otp2');
    expect(document.getElementById('otp2')).toBe(document.activeElement);
  });
});

describe('Form Interactions — sendChat()', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setupFullApp();
    showScreen('screen-b-help');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('adds user message to chat and clears input', () => {
    const input = document.getElementById('chat-input');
    input.value = 'Hello, I need help';

    sendChat();

    expect(input.value).toBe('');
    const chatWrap = document.getElementById('chat-wrap');
    expect(chatWrap.textContent).toContain('Hello, I need help');
  });

  test('does not send empty messages', () => {
    const input = document.getElementById('chat-input');
    input.value = '   ';
    const chatWrap = document.getElementById('chat-wrap');
    const initialContent = chatWrap.innerHTML;

    sendChat();

    expect(chatWrap.innerHTML).toBe(initialContent);
  });

  test('auto-replies with a bot message after timeout', () => {
    const input = document.getElementById('chat-input');
    input.value = 'What is my balance?';

    sendChat();

    // Fast-forward past the bot reply timeout
    jest.advanceTimersByTime(600);

    const chatWrap = document.getElementById('chat-wrap');
    const botMessages = chatWrap.querySelectorAll('.chat-msg.bot');
    // Should have initial 2 bot messages + 1 new reply = 3
    expect(botMessages.length).toBe(3);
  });
});

describe('Form Interactions — copyCode()', () => {
  beforeEach(() => {
    setupFullApp();
    jest.spyOn(window, 'showToast').mockImplementation(() => {});
    showScreen('screen-a-acquire');
  });

  test('shows success toast when copyCode is called', () => {
    copyCode();

    expect(showToast).toHaveBeenCalledWith(
      'Referral code copied to clipboard!',
      'success'
    );
  });

  test('referral link input has id="agent-referral-link"', () => {
    const input = document.getElementById('agent-referral-link');
    expect(input).not.toBeNull();
    expect(input.value).toContain('rupeefast.in/agent/');
  });

  test('referral link input is inside a <form> element', () => {
    const input = document.getElementById('agent-referral-link');
    const form = input.closest('form');
    expect(form).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════
// UI UTILITY TESTS
// ═══════════════════════════════════════════════════════

describe('UI Utilities — showToast()', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setupFullApp();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('creates a toast with the given message', () => {
    showToast('Test message', 'success');

    const container = document.getElementById('toast-container');
    expect(container.children.length).toBe(1);
    expect(container.textContent).toContain('Test message');
  });

  test('toast is removed after duration', () => {
    showToast('Temporary toast', 'info', 1000);

    const container = document.getElementById('toast-container');
    expect(container.children.length).toBe(1);

    // Advance past duration + removal timeout
    jest.advanceTimersByTime(1400);

    expect(container.children.length).toBe(0);
  });

  test('supports different toast types (success, error, info)', () => {
    showToast('Success', 'success');
    showToast('Error', 'error');
    showToast('Info', 'info');

    const container = document.getElementById('toast-container');
    expect(container.children.length).toBe(3);
    expect(container.children[0].classList.contains('success')).toBe(true);
    expect(container.children[1].classList.contains('error')).toBe(true);
    expect(container.children[2].classList.contains('info')).toBe(true);
  });

  test('uses info icon for unknown type but keeps the type as class', () => {
    showToast('Default type', 'unknown-type');

    const container = document.getElementById('toast-container');
    // The class name uses the provided type literally; the icon falls back to info
    expect(container.children[0].classList.contains('unknown-type')).toBe(true);
    // Icon should be the info icon
    expect(container.children[0].querySelector('i').classList.contains('ti-info-circle')).toBe(true);
  });
});

describe('UI Utilities — Loading overlay', () => {
  beforeEach(() => {
    setupFullApp();
  });

  test('showLoading displays the overlay with custom message', () => {
    showLoading('Processing...');

    const overlay = document.getElementById('loading-overlay');
    expect(overlay.classList.contains('active')).toBe(true);
    expect(document.getElementById('loading-text').textContent).toBe('Processing...');
  });

  test('hideLoading hides the overlay', () => {
    showLoading('Test');
    hideLoading();

    const overlay = document.getElementById('loading-overlay');
    expect(overlay.classList.contains('active')).toBe(false);
  });
});

describe('UI Utilities — shareRef()', () => {
  beforeEach(() => {
    setupFullApp();
    jest.spyOn(window, 'showToast').mockImplementation(() => {});
  });

  test('shows a success toast with the platform name', () => {
    shareRef('WhatsApp');

    expect(showToast).toHaveBeenCalledWith(
      'Referral link shared via WhatsApp',
      'success'
    );
  });
});

// ═══════════════════════════════════════════════════════
// AGENT DOMAIN TESTS
// ═══════════════════════════════════════════════════════

describe('Agent Domain — collectItem()', () => {
  beforeEach(() => {
    setupFullApp();
    jest.spyOn(window, 'showToast').mockImplementation(() => {});
    showScreen('screen-a-home');
  });

  test('marks a collection item as Collected', () => {
    const badge = document.getElementById('ci-0');
    expect(badge.textContent).toBe('Pending');

    collectItem(0, 'Rahul S.', 'M.G. Road');

    expect(badge.textContent).toBe('Collected');
    expect(badge.style.background).toBe('var(--green-bg)');
    expect(badge.style.color).toBe('var(--green)');
  });

  test('shows toast when collecting', () => {
    collectItem(0, 'Rahul S.', 'M.G. Road');

    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('₹120 collected'),
      'success'
    );
  });

  test('does not double-count when collecting same item twice', () => {
    collectItem(0, 'Rahul', 'Loc');
    collectItem(0, 'Rahul', 'Loc');

    // Should only show one toast for the first collection
    expect(showToast).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════
// AI SCORE TESTS
// ═══════════════════════════════════════════════════════

describe('AI Score — runAIScore()', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setupFullApp();
    // Lazy-render the AI score screen so elements exist
    renderScreen('screen-b-ai-score');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('progress starts at 0%', () => {
    runAIScore();

    expect(document.getElementById('ai-prog').style.width).toBe('0%');
    expect(document.getElementById('ai-pct').textContent).toBe('0%');
  });

  test('completes all 8 analysis steps', () => {
    runAIScore();

    // The setInterval runs every 700ms. On the 8th fire (i=7) the last step
    // is shown and i increments to 8. The 9th fire triggers completion.
    // 9 × 700 = 6300ms needed; advance to 7000ms for margin.
    jest.advanceTimersByTime(7000);

    const checks = document.getElementById('ai-checks');
    expect(checks.children.length).toBe(8);
  });

  test('shows the done button after completion', () => {
    runAIScore();
    jest.advanceTimersByTime(7000);

    const doneBtn = document.getElementById('ai-score-done');
    expect(doneBtn.style.display).toBe('block');
    expect(document.getElementById('ai-step-lbl').textContent).toBe('Analysis complete!');
  });
});

// ═══════════════════════════════════════════════════════
// FORM STRUCTURE REGRESSION TESTS
// ═══════════════════════════════════════════════════════

describe('Form Structure Regression Tests', () => {
  beforeEach(() => {
    setupFullApp();
    // Render all screens since these tests check the full DOM structure
    renderAllScreens();
  });

  test('all 27 input elements have either id or name attributes', () => {
    const inputs = document.querySelectorAll('input');
    expect(inputs.length).toBe(27);

    inputs.forEach((input, i) => {
      const hasId = input.hasAttribute('id');
      const hasName = input.hasAttribute('name');
      if (!hasId && !hasName) {
        throw new Error(
          `Input #${i} (type="${input.type}") is missing both id and name: ${input.outerHTML.slice(0, 100)}`
        );
      }
    });
  });

  test('all 27 input elements are inside a <form> element', () => {
    const inputs = document.querySelectorAll('input');

    inputs.forEach((input, i) => {
      const form = input.closest('form');
      if (!form) {
        throw new Error(
          `Input #${i} (id="${input.id}") is not inside a <form> element`
        );
      }
    });
  });

  test('no <form> elements are nested inside other <form> elements', () => {
    const forms = document.querySelectorAll('form');

    forms.forEach((form, i) => {
      const parentForm = form.parentElement?.closest('form');
      if (parentForm) {
        throw new Error(
          `Form #${i} is nested inside another <form>`
        );
      }
    });
  });

  test('all screen IDs are unique and no duplicates exist', () => {
    const screens = document.querySelectorAll('.screen');
    const ids = Array.from(screens).map(s => s.id);
    const uniqueIds = new Set(ids);

    expect(ids.length).toBe(uniqueIds.size);
  });

  test('each screen with inputs has a corresponding <form>', () => {
    const screens = document.querySelectorAll('.screen');

    screens.forEach(screen => {
      const inputs = screen.querySelectorAll('input');
      if (inputs.length === 0) return; // Skip screens with no inputs

      const forms = screen.querySelectorAll('form');
      if (forms.length < 1) {
        throw new Error(
          `Screen "${screen.id}" has ${inputs.length} input(s) but ${forms.length} <form> element(s)`
        );
      }
    });
  });
});

// ═══════════════════════════════════════════════════════
// AUTHENTICATION & SESSION TESTS
// ═══════════════════════════════════════════════════════

describe('Authentication — logoutUser()', () => {
  beforeEach(() => {
    setupFullApp();
    jest.spyOn(window, 'showToast').mockImplementation(() => {});
  });

  test('clears auth token and navigates to home', () => {
    localStorage.setItem('rupeefast_token', 'test-token');

    logoutUser();

    expect(localStorage.getItem('rupeefast_token')).toBeNull();
    expect(document.getElementById('screen-home').classList.contains('active')).toBe(true);
    expect(showToast).toHaveBeenCalledWith('Logged out successfully', 'info');
  });

  test('navigates to home screen after logout', () => {
    logoutUser();

    const home = document.getElementById('screen-home');
    expect(home.classList.contains('active')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// SCHEDULE TESTS
// ═══════════════════════════════════════════════════════

describe('Schedule — buildSchedule()', () => {
  beforeEach(() => {
    setupFullApp();
    // Render the borrower home & schedule screens so elements exist
    renderScreen('screen-b-home');
    renderScreen('screen-b-schedule');
  });

  test('populates schedule list with payment items', () => {
    // buildSchedule is called during window load, but we can call it directly
    buildSchedule();

    const scheduleList = document.getElementById('schedule-list');
    expect(scheduleList.children.length).toBe(20);

    const homeList = document.getElementById('home-schedule-list');
    expect(homeList.children.length).toBe(5);
  });

  test('marks first 5 payments as paid', () => {
    buildSchedule();

    const list = document.getElementById('schedule-list');
    const firstItem = list.children[0];
    const sixthItem = list.children[5];

    expect(firstItem.textContent).toContain('Paid');
    expect(sixthItem.textContent).toContain('Upcoming');
  });
});
