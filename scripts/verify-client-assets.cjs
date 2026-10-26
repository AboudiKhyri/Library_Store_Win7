const fs = require('fs');
const assert = require('assert');
const path = require('path');

const base = path.join(__dirname, '..');
const clientDirs = [
  path.join(base, 'dist-desktop/win-unpacked/resources/client'),
  path.join(base, 'out')
];

for (const dir of clientDirs) {
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  assert(html.includes('class="cairo_dea65c78-module__X-Mbbq__variable dark"'), 'index.html missing dark class in ' + dir);
  assert(!html.includes('style="background-color:#0e141c;color:#e7eef7"'), 'index.html has hardcoded body style in ' + dir);
  assert(html.includes('library-theme'), 'index.html missing dynamic theme script in ' + dir);

  const css = fs.readFileSync(path.join(dir, '_next/static/chunks/3oa5e4nmj08il.css'), 'utf8');
  assert(css.includes('btn-barcode-generate'), 'CSS missing btn-barcode-generate in ' + dir);
  assert(css.includes('btn-barcode-scan'), 'CSS missing btn-barcode-scan in ' + dir);
  assert(css.includes('[data-slot="dialog-content"]'), 'CSS missing dialog-content in ' + dir);
  assert(css.includes('-webkit-font-smoothing:antialiased!important'), 'CSS missing font smoothing in ' + dir);

  const js = fs.readFileSync(path.join(dir, '_next/static/chunks/18yoqc7d05wnq.js'), 'utf8');
  assert(js.includes('btn-barcode-generate'), 'JS missing btn-barcode-generate in ' + dir);
  assert(js.includes('btn-barcode-scan'), 'JS missing btn-barcode-scan in ' + dir);
}

console.log('[PASS] ALL CLIENT PRODUCTION ASSETS FULLY VERIFIED IN BOTH OUT AND DIST-DESKTOP!');
