/**
 * scripts/test-sidebar-date.cjs
 * Test Suite asserting:
 * (a) The old string "Library Store Offline" is absent in src/, out/, and dist-desktop/
 * (b) The date formatter and branding bindings exist in the compiled bundle
 * (c) src/ and out/ are consistent in state, timer interval, and branding fallbacks
 * (d) The small logo next to the date is completely removed from src/, out/, and dist-desktop/
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

console.log('=== TEST SUITE: SIDEBAR DYNAMIC DATE & BRANDING HEADERS ===\n');

// 1. Verify absence of "Library Store Offline"
runTest('(a) "Library Store Offline" is absent in src/components/library/app.tsx', () => {
  const appSrc = fs.readFileSync(path.join(root, 'src/components/library/app.tsx'), 'utf8');
  assert(!appSrc.includes('Library Store Offline'), 'Old string found in app.tsx');
});

runTest('(a) "Library Store Offline" is absent in all out/ JS chunks', () => {
  const chunksDir = path.join(root, 'out/_next/static/chunks');
  for (const f of fs.readdirSync(chunksDir)) {
    if (!f.endsWith('.js')) continue;
    const content = fs.readFileSync(path.join(chunksDir, f), 'utf8');
    assert(!content.includes('Library Store Offline'), `Old string found in out/.../${f}`);
  }
});

runTest('(a) "Library Store Offline" is absent in dist-desktop/ resources/out and resources/client', () => {
  for (const sub of ['out', 'client']) {
    const dir = path.join(root, 'dist-desktop/win-unpacked/resources', sub, '_next/static/chunks');
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.js')) continue;
        const content = fs.readFileSync(path.join(dir, f), 'utf8');
        assert(!content.includes('Library Store Offline'), `Old string found in dist-desktop/.../${sub}/.../${f}`);
      }
    }
  }
});

// 2. Verify date formatter exists in bundle
const bundlePath = path.join(root, 'out/_next/static/chunks/18yoqc7d05wnq.js');
const bundleCode = fs.readFileSync(bundlePath, 'utf8');

runTest('(b) Date formatter helper (FDate) exists in compiled bundle', () => {
  assert(bundleCode.includes('function FDate('), 'FDate definition missing');
  assert(bundleCode.includes('ar-u-nu-latn'), 'Arabic locale missing in bundle');
  assert(bundleCode.includes('en-US'), 'English locale missing in bundle');
});

runTest('(b) Date refresh timer (60s interval) exists in compiled bundle', () => {
  assert(bundleCode.includes('setInterval(') && bundleCode.includes('6e4'), '60s interval missing');
  assert(bundleCode.includes('clearInterval('), 'clearInterval cleanup missing');
});

runTest('(b) Header branding bindings exist in compiled bundle', () => {
  assert(bundleCode.includes('a?.branding?.appName||"Library Store"'), 'Header appName binding missing');
  assert(bundleCode.includes('a?.branding?.tagline||"نظام إدارة المتاجر"'), 'Header tagline binding missing');
});

// 3. Consistency between src/ and out/
const appSrc = fs.readFileSync(path.join(root, 'src/components/library/app.tsx'), 'utf8');

runTest('(c) src/ formatSidebarDate logic matches bundle FDate logic', () => {
  assert(appSrc.includes('ar-u-nu-latn'), 'src/ missing ar-u-nu-latn');
  assert(appSrc.includes('en-US'), 'src/ missing en-US');
  assert(appSrc.includes('60000'), 'src/ missing 60s timer');
  assert(appSrc.includes('clearInterval(timer)'), 'src/ missing cleanup');
  assert(appSrc.includes("status?.branding?.appName || 'Library Store'"), 'src/ missing dynamic appName');
  assert(appSrc.includes("tagline || 'نظام إدارة المتاجر'"), 'src/ missing dynamic tagline');
});

// 4. Verify logo next to date is completely removed
runTest('(d) Date logo (width:18, height:18) is absent from src/components/library/app.tsx', () => {
  assert(!appSrc.includes('width={18} height={18}'), 'Logo next to date still found in app.tsx');
});

runTest('(d) Date logo (width:18, height:18) is absent from out/ chunks', () => {
  const chunksDir = path.join(root, 'out/_next/static/chunks');
  for (const f of fs.readdirSync(chunksDir)) {
    if (!f.endsWith('.js')) continue;
    const content = fs.readFileSync(path.join(chunksDir, f), 'utf8');
    assert(!content.includes('width:18,height:18'), `Date logo still found in out/.../${f}`);
  }
});

runTest('(d) Date logo (width:18, height:18) is absent from dist-desktop/ resources/client and resources/out', () => {
  for (const sub of ['out', 'client']) {
    const dir = path.join(root, 'dist-desktop/win-unpacked/resources', sub, '_next/static/chunks');
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.js')) continue;
        const content = fs.readFileSync(path.join(dir, f), 'utf8');
        assert(!content.includes('width:18,height:18'), `Date logo still found in dist-desktop/.../${sub}/.../${f}`);
      }
    }
  }
});

console.log(`\nRESULTS: ${passed} / ${total} checks passed.`);
if (passed === total) {
  console.log('[PASS] ALL SIDEBAR DYNAMIC DATE & BRANDING CHECKS PASSED CLEANLY!');
  process.exit(0);
} else {
  console.error('[FAIL] Some checks failed.');
  process.exit(1);
}
