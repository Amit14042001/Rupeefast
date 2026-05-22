/**
 * RupeeFast — Application Initializer
 *
 * Runs once on page load:
 *   1. Builds the initial EMI schedule
 *   2. Registers the service worker (PWA support)
 *
 * Dependencies (script load order):
 *   shared.js → navigation.js → auth.js → loans.js → payments.js → init.js
 *
 * This file must be loaded LAST so that all function declarations
 * (buildSchedule, showScreen, etc.) are hoisted and available.
 */

window.addEventListener('load', () => {
  buildSchedule();

  // Register service worker for PWA support
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('SW registered, scope:', reg.scope);
    }).catch((err) => {
      console.log('SW registration failed:', err.message);
    });
  }
});
