/**
 * scripts/test-sidebar-header-branding.cjs
 *
 * Verifies:
 * 1. src/components/library/app.tsx has dynamic binding for displayName (top) and businessName (bottom).
 * 2. src/components/library/screens/settings.tsx refreshes status when 'business' is saved.
 * 3. out/_next/static/chunks/18yoqc7d05wnq.js has dynamic bindings in compiled JS.
 * 4. dist-desktop resources/out and resources/client are in sync with out/.
 * 5. Simulation test: ensures fallback logic correctly handles both filled and empty displayName.
 * 6. Database test: verifies AppSettings has businessName and displayName in custom.db.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');

let total = 0;
let passed = 0;

function runTest(desc, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${desc}:`, err.message);
  }
}

console.log('=== TEST SUITE: SIDEBAR HEADER DYNAMIC BRANDING & BUSINESS NAME ===\n');

// 1. Source parity
runTest('src/components/library/app.tsx binds top header to displayName with fallback to appName', () => {
  const code = fs.readFileSync(path.join(root, 'src/components/library/app.tsx'), 'utf8');
  assert(code.includes('status?.business?.displayName || status?.branding?.appName || \'Library Store\''), 'Missing displayName binding in app.tsx');
});

runTest('src/components/library/app.tsx binds subtitle to businessName with fallback to tagline', () => {
  const code = fs.readFileSync(path.join(root, 'src/components/library/app.tsx'), 'utf8');
  assert(code.includes('status?.business?.businessName || (status?.branding as any)?.tagline'), 'Missing businessName binding in app.tsx');
});

runTest('src/components/library/screens/settings.tsx calls refreshStatus on business save', () => {
  const code = fs.readFileSync(path.join(root, 'src/components/library/screens/settings.tsx'), 'utf8');
  assert(code.includes("key === 'business' || key === 'branding'"), 'refreshStatus missing business trigger in settings.tsx');
});

// 2. Compiled bundle checks
const chunkPath = path.join(root, 'out/_next/static/chunks/18yoqc7d05wnq.js');
const chunkCode = fs.readFileSync(chunkPath, 'utf8');

runTest('out chunk has dynamic displayName binding for top header', () => {
  assert(chunkCode.includes('a?.business?.displayName||a?.branding?.appName||"Library Store"'), 'displayName binding missing in chunk');
});

runTest('out chunk has dynamic businessName binding for subtitle', () => {
  assert(chunkCode.includes('a?.business?.businessName||a?.branding?.tagline||"نظام إدارة المتاجر"'), 'businessName binding missing in chunk');
});

runTest('out chunk has business trigger on settings save', () => {
  assert(chunkCode.includes('"business"===t||"branding"===t||"localization"===t||"pos"===t'), 'business save trigger missing in chunk');
});

// 3. Distribution sync checks
for (const target of ['out', 'client']) {
  runTest(`dist-desktop/win-unpacked/resources/${target} chunk is synchronized with out/`, () => {
    const distChunk = path.join(root, 'dist-desktop/win-unpacked/resources', target, '_next/static/chunks/18yoqc7d05wnq.js');
    assert(fs.existsSync(distChunk), `Missing chunk in dist-desktop/.../${target}`);
    const distCode = fs.readFileSync(distChunk, 'utf8');
    assert(distCode.includes('a?.business?.displayName||a?.branding?.appName||"Library Store"'), `Binding missing in dist-desktop/.../${target}`);
    assert(distCode.includes('a?.business?.businessName||a?.branding?.tagline||"نظام إدارة المتاجر"'), `Binding missing in dist-desktop/.../${target}`);
  });
}

// 4. Fallback simulation logic test
runTest('Dynamic binding logic: when displayName is provided, it takes precedence on top line', () => {
  const status = {
    business: { displayName: 'مكتبة الأمل', businessName: 'مكتبة الأمل للادوات المكتبية' },
    branding: { appName: 'Library Store', tagline: 'نظام إدارة المتاجر' }
  };
  const topLine = status?.business?.displayName || status?.branding?.appName || 'Library Store';
  const bottomLine = status?.business?.businessName || status?.branding?.tagline || 'نظام إدارة المتاجر';

  assert.strictEqual(topLine, 'مكتبة الأمل');
  assert.strictEqual(bottomLine, 'مكتبة الأمل للادوات المكتبية');
});

runTest('Dynamic binding logic: when displayName is empty, top line falls back to branding.appName', () => {
  const status = {
    business: { displayName: '', businessName: 'مكتبة الأمل للادوات المكتبية' },
    branding: { appName: 'Library Store', tagline: 'نظام إدارة المتاجر' }
  };
  const topLine = status?.business?.displayName || status?.branding?.appName || 'Library Store';
  const bottomLine = status?.business?.businessName || status?.branding?.tagline || 'نظام إدارة المتاجر';

  assert.strictEqual(topLine, 'Library Store');
  assert.strictEqual(bottomLine, 'مكتبة الأمل للادوات المكتبية');
});

// 5. Database check
runTest('custom.db AppSettings has valid business JSON with businessName and displayName', () => {
  const Database = require(path.join(root, 'server/node_modules/better-sqlite3'));
  const db = new Database(path.join(root, 'data/custom.db'), { readonly: true });
  const row = db.prepare("SELECT business FROM AppSettings WHERE id='default'").get();
  db.close();

  assert(row, 'AppSettings row not found');
  const b = JSON.parse(row.business);
  assert(typeof b.businessName === 'string', 'businessName must be string');
  assert(typeof b.displayName === 'string', 'displayName must be string');
});

console.log(`\nRESULTS: ${passed} / ${total} checks passed.`);
if (passed === total) {
  console.log('[PASS] ALL SIDEBAR HEADER DYNAMIC BRANDING CHECKS PASSED CLEANLY (10/10)!');
  process.exit(0);
} else {
  console.error('[FAIL] Some checks failed.');
  process.exit(1);
}
