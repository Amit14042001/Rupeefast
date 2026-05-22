#!/usr/bin/env node

/**
 * RupeeFast HTML Build Script
 * Generates a slim index.html (shell only) + screens.js (lazy-loaded screen html).
 *
 * Usage: node build-html.js
 */

const fs = require('fs');
const path = require('path');

const HTML_DIR = path.join(__dirname, 'html');
const INDEX_OUTPUT = path.join(__dirname, 'index.html');
const SCREENS_OUTPUT = path.join(__dirname, 'screens.js');

const ROLES = ['borrower', 'investor', 'agent'];
const PREFIX_LEN = 3; // Skip "XX-" prefix when sorting by name

function getPartialFiles(dirPath) {
  try {
    return fs.readdirSync(dirPath)
      .filter(f => f.endsWith('.html') && !f.startsWith('_'))
      .sort((a, b) => {
        const nameA = /^\d{2}-(.+)$/.test(a) ? a.slice(PREFIX_LEN) : a;
        const nameB = /^\d{2}-(.+)$/.test(b) ? b.slice(PREFIX_LEN) : b;
        return nameA.localeCompare(nameB);
      });
  } catch {
    return [];
  }
}

function build() {
  console.log('Building index.html (shell) + screens.js...');

  // 1. Read base template (opening tags, overlays, home screen)
  const basePath = path.join(HTML_DIR, '_base.html');
  if (!fs.existsSync(basePath)) {
    console.error('Error: _base.html not found in', HTML_DIR);
    process.exit(1);
  }

  // 2. Collect all screen HTMLs by screen ID
  const screens = {};
  for (const role of ROLES) {
    const roleDir = path.join(HTML_DIR, role);
    const files = getPartialFiles(roleDir);
    for (const file of files) {
      const content = fs.readFileSync(path.join(roleDir, file), 'utf8');
      const idMatch = content.match(/id="([^"]+)"/);
      if (idMatch) {
        screens[idMatch[1]] = content.trim();
      }
    }
  }

  // 3. Generate screens.js
  const screensJs = 'window.SCREENS = ' + JSON.stringify(screens, null, 2) + ';\n';
  fs.writeFileSync(SCREENS_OUTPUT, screensJs, 'utf8');
  console.log(`✅ Built screens.js (${screensJs.length} bytes, ${Object.keys(screens).length} screens)`);

  // 4. Build shell index.html (only base + end, no screen partials)
  let output = fs.readFileSync(basePath, 'utf8');
  output += '\n';

  const endPath = path.join(HTML_DIR, '_end.html');
  if (fs.existsSync(endPath)) {
    output += fs.readFileSync(endPath, 'utf8');
  }

  // 5. Write shell index.html
  fs.writeFileSync(INDEX_OUTPUT, output, 'utf8');
  console.log(`✅ Built index.html (${(output.length / 1024).toFixed(1)} KB — shell only)`);
}

build();
