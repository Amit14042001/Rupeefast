/**
 * RupeeFast — Screen Navigation & Transitions
 *
 * Responsibilities:
 *   - Lazy screen rendering (injects HTML from window.SCREENS on first access)
 *   - Skeleton loading placeholders via createSkeleton()
 *   - Slide-in / slide-out transitions (forward, back, or fade for tabs)
 *   - Navigation stack tracking for direction detection
 *   - Tab switching (showBTab / showITab / showATab)
 *
 * Dependencies:
 *   shared.js must be loaded first (provides runCountUp, showToast).
 *   loans.js, payments.js must be loaded before any user interaction
 *   because finishScreenTransition() calls buildSchedule(), loadMandates(),
 *   and runAIScore() from those modules (all resolved at call time).
 *
 * Performance:
 *   Every screen render is logged to renderPerfLog and window.__renderPerf
 *   with timing breakdown (lookup, injection, click-to-paint).
 */

// ── Screen render cache ──
const renderedScreens = new Set();

// ── Performance log ──
const renderPerfLog = [];
const renderPerf = {};

// Expose for console / debugging
if (typeof window !== 'undefined') {
  window.__renderPerf = renderPerf;
  window.__renderPerfLog = renderPerfLog;
}

// ── Navigation stack for slide direction ──
const _navStack = [];
let _slideDirection = 'none'; // 'forward' | 'back' | 'none'

// ══════════════════════════════════════════════════
// NAVIGATION STACK HELPERS
// ══════════════════════════════════════════════════

/**
 * Check if a screen ID belongs to a bottom-nav tab.
 * Tab switches use fade transitions instead of slides.
 */
function _hasBottomNav(id) {
  return window.SCREENS && window.SCREENS[id] && window.SCREENS[id].includes('bottom-nav');
}

// ══════════════════════════════════════════════════
// SKELETON GENERATOR
// ══════════════════════════════════════════════════

/**
 * Generates a skeleton loading placeholder that matches the target screen layout.
 * Login/OTP: top nav + centered icon + form fields.
 * Dashboard: coloured top nav + hero card + metric grid + schedule items + bottom nav.
 * Generic: top nav + card block + list items + optional bottom nav.
 */
function createSkeleton(id) {
  let innerHtml = '';

  if (id.startsWith('screen-login-') || id.startsWith('screen-otp-')) {
    const isOtp = id.startsWith('screen-otp-');
    innerHtml = `
      <div class="top-nav">
        <div class="skel-shimmer" style="width:32px;height:32px;border-radius:var(--radius-xs);"></div>
        <div class="skel-shimmer skel-block w-40 h-14 mb-0" style="margin-left:12px;"></div>
      </div>
      <div class="scroll-body" style="background:var(--surface);display:flex;flex-direction:column;align-items:center;padding:40px 24px 0;">
        <div class="skel-shimmer skel-icon md rounded mb-24"></div>
        <div class="skel-shimmer skel-block w-50 h-20 mb-4 mx-auto"></div>
        <div class="skel-shimmer skel-block w-70 h-14 mb-30 mx-auto"></div>
        ${isOtp ? `
          <div class="skel-otp-row mb-24">
            ${'<div class="skel-shimmer"></div>'.repeat(4)}
          </div>
        ` : `
          <div class="skel-card no-margin" style="width:100%;">
            <div class="skel-shimmer skel-block w-30 h-12 mb-8"></div>
            <div class="skel-shimmer skel-block w-90 h-20 mb-0"></div>
          </div>
        `}
        <div class="skel-shimmer skel-block w-100 h-48 mb-8 rounded-12" style="margin-top:24px;"></div>
      </div>`;
  } else if (id.endsWith('-home')) {
    const isInvestor = id.startsWith('screen-i-');
    const isAgent = id.startsWith('screen-a-');
    const theme = isInvestor ? 'var(--green)' : isAgent ? 'var(--amber)' : 'var(--primary)';
    const navBg = `background:${theme};border-bottom:none;`;
    innerHtml = `
      <div class="top-nav" style="${navBg}">
        <div style="flex:1;">
          <div class="skel-shimmer skel-block w-40 h-12 mb-4" style="background:rgba(255,255,255,0.15);"></div>
          <div class="skel-shimmer skel-block w-60 h-14 mb-0" style="background:rgba(255,255,255,0.2);"></div>
        </div>
        <div class="skel-shimmer" style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.2);"></div>
      </div>
      <div class="scroll-body">
        <div class="skel-hero">
          <div class="skel-shimmer skel-block w-50 h-12 mb-8"></div>
          <div class="skel-shimmer skel-block w-60 h-32 mb-0"></div>
          <div class="skel-shimmer skel-block w-100 h-6 rounded-full" style="margin-top:20px;"></div>
          <div class="skel-shimmer skel-block w-100 h-12 mb-0" style="margin-top:16px;"></div>
          <div class="skel-shimmer skel-block w-60 h-14 mb-0" style="margin-top:20px;border-radius:var(--radius-sm);height:44px;"></div>
        </div>
        <div class="metric-grid" style="margin-top:8px;">
          <div class="skel-card"><div class="skel-shimmer skel-block w-50 h-12 mb-8"></div><div class="skel-shimmer skel-block w-40 h-20 mb-6"></div><div class="skel-shimmer skel-block w-60 h-12 mb-0"></div></div>
          <div class="skel-card"><div class="skel-shimmer skel-block w-50 h-12 mb-8"></div><div class="skel-shimmer skel-block w-40 h-20 mb-6"></div><div class="skel-shimmer skel-block w-60 h-12 mb-0"></div></div>
        </div>
        <div class="section-hdr"><div class="skel-shimmer skel-block w-30 h-12 mb-0"></div></div>
        <div class="skel-card">
          ${'<div class="skel-list-item" style="padding:14px 0;"><div class="skel-shimmer skel-icon sm rounded-12"></div><div style="flex:1;"><div class="skel-shimmer skel-block w-50 h-14 mb-4"></div><div class="skel-shimmer skel-block w-70 h-12 mb-0"></div></div></div>'.repeat(3)}
        </div>
        <div class="section-hdr"><div class="skel-shimmer skel-block w-40 h-12 mb-0"></div></div>
        ${'<div class="skel-list-item"><div class="skel-shimmer skel-icon sm rounded-12"></div><div style="flex:1;"><div class="skel-shimmer skel-block w-60 h-14 mb-4"></div><div class="skel-shimmer skel-block w-40 h-12 mb-0"></div></div><div class="skel-shimmer skel-block w-20 h-12 mb-0"></div></div>'.repeat(3)}
      </div>
      <div class="bottom-nav g${isAgent ? '3' : '4'}">
        ${'<div style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 0;"><div class="skel-shimmer" style="width:22px;height:22px;border-radius:6px;"></div><div class="skel-shimmer skel-block w-40 h-8 mb-0"></div></div>'.repeat(isAgent ? 3 : 4)}
      </div>`;
  } else {
    const hasBottomNav = window.SCREENS && window.SCREENS[id] && window.SCREENS[id].includes('bottom-nav');
    const cols = hasBottomNav ? (id.startsWith('screen-a-') ? '3' : '4') : null;
    innerHtml = `
      <div class="top-nav">
        <div class="skel-shimmer" style="width:32px;height:32px;border-radius:var(--radius-xs);"></div>
        <div class="skel-shimmer skel-block w-40 h-14 mb-0" style="margin-left:12px;"></div>
      </div>
      <div class="scroll-body">
        <div class="skel-card" style="margin-top:12px;">
          <div class="skel-shimmer skel-block w-80 h-14 mb-8"></div>
          <div class="skel-shimmer skel-block w-60 h-20 mb-12"></div>
          <div class="skel-shimmer skel-block w-100 h-12 mb-4"></div>
          <div class="skel-shimmer skel-block w-90 h-12 mb-4"></div>
          <div class="skel-shimmer skel-block w-70 h-12 mb-0"></div>
        </div>
        <div class="skel-card">
          <div class="skel-shimmer skel-block w-50 h-12 mb-8"></div>
          <div class="skel-shimmer skel-block w-80 h-14 mb-6"></div>
          <div class="skel-shimmer skel-block w-60 h-12 mb-0"></div>
        </div>
        <div class="section-hdr"><div class="skel-shimmer skel-block w-40 h-12 mb-0"></div></div>
        ${'<div class="skel-list-item"><div class="skel-shimmer skel-icon sm rounded"></div><div style="flex:1;"><div class="skel-shimmer skel-block w-60 h-14 mb-4"></div><div class="skel-shimmer skel-block w-40 h-12 mb-0"></div></div><div class="skel-shimmer skel-block w-20 h-12 mb-0"></div></div>'.repeat(5)}
      </div>${hasBottomNav ? `\n      <div class="bottom-nav g${cols}">\n        ${'<div style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 0;"><div class="skel-shimmer" style="width:22px;height:22px;border-radius:6px;"></div><div class="skel-shimmer skel-block w-40 h-8 mb-0"></div></div>'.repeat(parseInt(cols))}\n      </div>` : ''}`;
  }

  return `<div class="screen skeleton-screen" id="skel-${id}">${innerHtml}</div>`;
}

// ══════════════════════════════════════════════════
// SCREEN RENDERER (lazy)
// ══════════════════════════════════════════════════

/**
 * Injects a screen's HTML into the DOM on first access.
 * Screens are stored as strings in window.SCREENS (generated by build-html.js).
 * Each render is timed and logged to the perf log.
 */
function renderScreen(id) {
  if (renderedScreens.has(id) || document.getElementById(id)) return;

  const t0 = performance.now();

  const html = window.SCREENS && window.SCREENS[id];
  if (!html) {
    console.warn('Screen HTML not found in SCREENS map:', id);
    return;
  }
  const t1 = performance.now();

  const mainApp = document.getElementById('mainApp');
  if (mainApp) {
    mainApp.insertAdjacentHTML('beforeend', html);
    const t2 = performance.now();

    renderedScreens.add(id);

    const lookupMs = t1 - t0;
    const injectMs = t2 - t1;
    const totalMs = t2 - t0;
    const sizeKB = (html.length / 1024).toFixed(1);

    const entry = { id, lookupMs: +lookupMs.toFixed(3), injectMs: +injectMs.toFixed(3), totalMs: +totalMs.toFixed(3), htmlSizeKB: +sizeKB };
    renderPerfLog.push(entry);
    renderPerf[id] = entry;

    console.log(
      `%c[Perf] %c${id} %crendered in ${totalMs.toFixed(2)}ms ` +
      `(lookup: ${lookupMs.toFixed(2)}ms, inject: ${injectMs.toFixed(2)}ms, ${sizeKB}KB)`,
      'color:#8b5cf6;font-weight:700',
      'color:#f59e0b;font-weight:600',
      'color:#6b7280'
    );
  }
}

// ══════════════════════════════════════════════════
// SCREEN TRANSITION (slide / fade)
// ══════════════════════════════════════════════════

/**
 * Completes the screen transition after lazy-render:
 *   1. Removes skeleton placeholder if present
 *   2. Applies slide (forward/back) or fade animation
 *   3. Scrolls to top
 *   4. Fires screen-specific callbacks
 *   5. Logs click-to-paint time for first renders
 */
function finishScreenTransition(id, navT0, isFirstRender) {
  // Remove skeleton placeholder if present
  const skeleton = document.getElementById('skel-' + id);
  if (skeleton) {
    skeleton.classList.remove('active');
    setTimeout(() => {
      if (skeleton.parentNode) skeleton.remove();
    }, 300);
  }

  const currentActive = document.querySelector('.screen.active');
  const nextScreen = document.getElementById(id);

  if (!nextScreen) {
    console.warn('Screen not found:', id);
    return;
  }

  const animDuration = 0.3;
  const dur = animDuration + 's';

  if (_slideDirection === 'forward' && currentActive && currentActive !== nextScreen && !currentActive.id.startsWith('skel-')) {
    currentActive.classList.remove('active');
    currentActive.classList.add('slide-out');
    currentActive.style.animation = 'slideOutLeft ' + dur + ' ease forwards';

    nextScreen.classList.add('active');
    nextScreen.style.animation = 'none';
    void nextScreen.offsetWidth;
    nextScreen.style.animation = 'slideInRight ' + dur + ' ease';

    setTimeout(() => {
      currentActive.classList.remove('slide-out');
      currentActive.style.animation = '';
    }, animDuration * 1000);

  } else if (_slideDirection === 'back' && currentActive && currentActive !== nextScreen && !currentActive.id.startsWith('skel-')) {
    currentActive.classList.remove('active');
    currentActive.classList.add('slide-out');
    currentActive.style.animation = 'slideOutRight ' + dur + ' ease forwards';

    nextScreen.classList.add('active');
    nextScreen.style.animation = 'none';
    void nextScreen.offsetWidth;
    nextScreen.style.animation = 'slideInLeft ' + dur + ' ease';

    setTimeout(() => {
      currentActive.classList.remove('slide-out');
      currentActive.style.animation = '';
    }, animDuration * 1000);

  } else {
    if (currentActive && currentActive !== nextScreen && !currentActive.id.startsWith('skel-')) {
      currentActive.style.animation = 'none';
      currentActive.classList.remove('active');
    }

    nextScreen.classList.add('active');
    nextScreen.style.animation = 'none';
    void nextScreen.offsetWidth;
    nextScreen.style.animation = 'screenFadeIn ' + dur + ' ease';
  }

  // Scroll to top
  nextScreen.querySelector('.scroll-body')?.scrollTo(0, 0);

  _slideDirection = 'none';

  // Click-to-paint timing
  if (isFirstRender) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const paintMs = performance.now() - navT0;
        console.log(
          `%c[Perf] %c${id} %cvisible in ${paintMs.toFixed(1)}ms (click-to-paint)`,
          'color:#8b5cf6;font-weight:700',
          'color:#22c55e;font-weight:600',
          'color:#6b7280'
        );
      });
    });
  }

  // ── Screen-specific callbacks ──
  // (buildSchedule is in payments.js, loadMandates is in payments.js,
  //  runAIScore is in loans.js, runCountUp is in shared.js)
  if (id === 'screen-b-ai-score') setTimeout(runAIScore, 200);
  if (id === 'screen-b-home' || id === 'screen-b-schedule') { buildSchedule(); setTimeout(runCountUp, 200); }
  if (id === 'screen-i-home') setTimeout(runCountUp, 200);
  if (id === 'screen-a-home') setTimeout(runCountUp, 200);
  if (id === 'screen-b-mandates') loadMandates();
}

// ══════════════════════════════════════════════════
// SHOW SCREEN (main entry point)
// ══════════════════════════════════════════════════

/**
 * Switch between screens with smooth slide transition.
 *
 * Lazy-renders the target screen if not already in the DOM.
 * On first visit, shows a skeleton placeholder first, then injects real HTML
 * on the next animation frame for instant visual feedback.
 *
 * Navigation direction is determined from a stack:
 *   - Forward: screen not in stack → push + slideInRight / slideOutLeft
 *   - Back:    screen found deeper in stack → splice + slideInLeft / slideOutRight
 *   - Tab:     both have bottom-nav → fade + replace top of stack
 */
function showScreen(id) {
  const navT0 = performance.now();
  const isFirstRender = !renderedScreens.has(id) && !document.getElementById(id);

  // ── Determine slide direction ──
  const prevId = _navStack.length > 0 ? _navStack[_navStack.length - 1] : null;

  if (prevId && id !== prevId) {
    if (_hasBottomNav(prevId) && _hasBottomNav(id)) {
      _slideDirection = 'none';
      _navStack[_navStack.length - 1] = id;
    } else {
      const backIndex = _navStack.indexOf(id);
      if (backIndex !== -1 && backIndex < _navStack.length - 1) {
        _slideDirection = 'back';
        _navStack.splice(backIndex + 1);
      } else {
        _slideDirection = 'forward';
        _navStack.push(id);
      }
    }
  } else if (!prevId) {
    _slideDirection = 'none';
    _navStack.push(id);
  } else {
    _slideDirection = 'none';
  }

  if (isFirstRender) {
    const mainApp = document.getElementById('mainApp');
    if (mainApp) {
      mainApp.insertAdjacentHTML('beforeend', createSkeleton(id));
      const skeleton = document.getElementById('skel-' + id);
      if (skeleton) skeleton.classList.add('active');
    }

    requestAnimationFrame(() => {
      renderScreen(id);
      finishScreenTransition(id, navT0, true);
    });
    return;
  }

  finishScreenTransition(id, navT0, false);
}

// ══════════════════════════════════════════════════
// TAB NAVIGATION
// ══════════════════════════════════════════════════

function showBTab(id, btn) {
  showScreen(id);
  const nav = btn?.closest('.bottom-nav');
  if (nav) {
    nav.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
}

const showITab = showBTab;
const showATab = showBTab;
