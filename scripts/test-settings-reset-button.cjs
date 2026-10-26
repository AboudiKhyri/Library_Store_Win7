/**
 * scripts/test-settings-reset-button.cjs
 * Automated test suite asserting that the "إعادة التعيين" (Reset) button
 * is present and wired to restore default settings across all Settings tabs.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== TEST SUITE: SETTINGS SCREEN RESET BUTTON ===\n');

const root = path.resolve(__dirname, '..');
const settingsTsxPath = path.join(root, 'src/components/library/screens/settings.tsx');
const chunkPath = path.join(root, 'out/_next/static/chunks/18yoqc7d05wnq.js');
const distChunkClient = path.join(root, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js');
const distChunkOut = path.join(root, 'dist-desktop/win-unpacked/resources/out/_next/static/chunks/18yoqc7d05wnq.js');

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

// 1. Verify src/components/library/screens/settings.tsx
const settingsTsx = fs.readFileSync(settingsTsxPath, 'utf8');

runTest('(a) settings.tsx imports RotateCcw and defines DEFAULT_SETTINGS for all sections', () => {
  assert(settingsTsx.includes('RotateCcw'), 'RotateCcw import missing in settings.tsx');
  assert(settingsTsx.includes('const DEFAULT_SETTINGS'), 'DEFAULT_SETTINGS definition missing');
  assert(settingsTsx.includes('business:'), 'DEFAULT_SETTINGS missing business');
  assert(settingsTsx.includes('branding:'), 'DEFAULT_SETTINGS missing branding');
  assert(settingsTsx.includes('pos:'), 'DEFAULT_SETTINGS missing pos');
  assert(settingsTsx.includes('hardware:'), 'DEFAULT_SETTINGS missing hardware');
  assert(settingsTsx.includes('backup:'), 'DEFAULT_SETTINGS missing backup');
  assert(settingsTsx.includes('localization:'), 'DEFAULT_SETTINGS missing localization');
});

runTest('(b) settings.tsx implements resetSection handler with toast notification', () => {
  assert(settingsTsx.includes('const resetSection = (key: SectionKey) =>'), 'resetSection handler missing');
  assert(settingsTsx.includes('DEFAULT_SETTINGS[key]'), 'resetSection must pull from DEFAULT_SETTINGS');
  assert(settingsTsx.includes("L('تمت استعادة الإعدادات الافتراضية'"), 'Toast confirmation missing');
});

runTest('(c) SaveRow accepts onReset prop and renders "إعادة التعيين" button', () => {
  assert(settingsTsx.includes('onReset?: () => void'), 'onReset prop missing from SaveRow');
  assert(settingsTsx.includes("L('إعادة التعيين', 'Reset')"), 'Reset button label missing in SaveRow');
  assert(settingsTsx.includes('<RotateCcw className="me-2 h-4 w-4" />'), 'RotateCcw icon missing in SaveRow');
});

runTest('(d) All 6 settings tabs pass onReset to SaveRow', () => {
  const tabs = ['business', 'branding', 'pos', 'hardware', 'backup', 'localization'];
  for (const t of tabs) {
    assert(
      settingsTsx.includes(`onReset={() => resetSection('${t}')}`),
      `SaveRow in tab "${t}" missing onReset binding`
    );
  }
});

// 2. Verify compiled chunk out/_next/static/chunks/18yoqc7d05wnq.js
const chunkCode = fs.readFileSync(chunkPath, 'utf8');

runTest('(e) Compiled chunk DS (SaveRow) renders reset button', () => {
  assert(chunkCode.includes('function DS({disabled:e,saving:t,onSave:r,onReset:_rst,hint:n,L:a}'), 'DS component missing onReset:_rst parameter');
  assert(chunkCode.includes('a("إعادة التعيين","Reset")'), 'DS component missing Reset text');
  assert(chunkCode.includes('variant:"outline",onClick:_rst'), 'DS component missing reset button outline');
});

runTest('(f) Compiled chunk implements _rst helper and binds all 6 tabs', () => {
  assert(chunkCode.includes('let _rst='), '_rst helper function missing in chunk');
  const tabs = ['business', 'branding', 'pos', 'hardware', 'backup', 'localization'];
  for (const t of tabs) {
    assert(
      chunkCode.includes(`onReset:_rst("${t}")`),
      `Chunk DS call for "${t}" missing onReset:_rst("${t}")`
    );
  }
});

// 3. Verify dist-desktop targets
for (const p of [distChunkClient, distChunkOut]) {
  if (fs.existsSync(p)) {
    const c = fs.readFileSync(p, 'utf8');
    runTest(`(g) ${path.relative(root, p)} includes reset button and bindings`, () => {
      assert(c.includes('onReset:_rst'), 'Missing onReset:_rst in ' + p);
      assert(c.includes('a("إعادة التعيين","Reset")'), 'Missing Reset text in ' + p);
      assert(c.includes('_rst("branding")'), 'Missing _rst binding for branding in ' + p);
    });
  }
}

console.log(`\n=== RESULT: ${passed}/${total} TESTS PASSED ===\n`);
if (passed !== total) {
  process.exit(1);
}
