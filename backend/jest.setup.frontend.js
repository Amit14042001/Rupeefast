/**
 * Global setup for frontend (jsdom) tests.
 * Provides helper to create full app DOM and loads app.js.
 */

const fs = require('fs');
const path = require('path');

/**
 * Builds the slim app shell DOM by reading the built index.html file.
 * Adds it to document.body so app.js functions can query elements.
 * The shell includes only: overlays, toast container, and home screen.
 * All other screens are loaded lazily via screens.js.
 */
global.setupAppDOM = function () {
  const indexPath = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'index.html');
  const html = fs.readFileSync(indexPath, 'utf-8');
  document.body.innerHTML = html;
};

/**
 * Loads screens.js to populate window.SCREENS with all screen HTML strings.
 * Must be called BEFORE loadAppJS() so SCREENS is available when app.js runs.
 */
global.setupScreensJS = function () {
  const screensPath = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'screens.js');
  let code = fs.readFileSync(screensPath, 'utf-8');

  // Clean previous SCREENS and scripts
  delete window.SCREENS;
  document.querySelectorAll('script[data-screens]').forEach(s => s.remove());

  const script = document.createElement('script');
  script.setAttribute('data-screens', '');
  script.textContent = code;
  document.body.appendChild(script);
};

/**
 * Loads app.js into the global scope so all its functions are available.
 * Must be called AFTER setupAppDOM() and setupScreensJS().
 *
 * Uses a <script> tag to simulate how the browser loads the file,
 * making all function declarations available on `window` (globalThis).
 *
 * Top-level `const` and `let` are converted to `var` so the script can
 * be re-injected across multiple tests without redeclaration errors.
 */
global.loadAppJS = function () {
  const appJsPath = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'app.js');
  let code = fs.readFileSync(appJsPath, 'utf-8');

  // Convert all const/let to var to allow re-execution across tests.
  // Safe for this codebase (no block-scoping relied upon); prevents future
  // breakage if new top-level declarations are added to app.js.
  code = code.replace(/\b(const|let)\b/g, 'var');

  // Remove previous app scripts before adding a new one
  document.querySelectorAll('script[data-app]').forEach(s => s.remove());

  const script = document.createElement('script');
  script.setAttribute('data-app', '');
  script.textContent = code;
  document.body.appendChild(script);
};

// Polyfill scrollTo for jsdom (used by showScreen)
if (typeof Element.prototype.scrollTo !== 'function') {
  Element.prototype.scrollTo = function () {};
}

/**
 * Sets up fetch mock with optional custom response.
 */
global.mockFetch = function (responseData) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(responseData || { success: true }),
    })
  );
};

/**
 * Sets up fetch mock to simulate network error.
 */
global.mockFetchNetworkError = function () {
  global.fetch = jest.fn(() =>
    Promise.reject(new TypeError('Failed to fetch'))
  );
};

/**
 * Mock localStorage (jsdom provides this already, but we clear it between tests).
 */
global.clearStorage = function () {
  localStorage.clear();
  sessionStorage.clear();
};
