const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('=== TEST SUITE: THEME PERSISTENCE ACROSS APPLICATION REBOOT ===');

let passed = 0;
let failed = 0;

function check(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// 1. Verify window-manager.js does NOT clear localStorage on launch
check('window-manager.js does not clear localstorage in clearStorageData', () => {
  const wmPath = path.resolve(__dirname, '../desktop/engine/main/window-manager.js');
  const code = fs.readFileSync(wmPath, 'utf8');
  assert.ok(!code.includes("storages: ['cookies', 'localstorage'"), 'window-manager must not wipe localstorage');
  assert.ok(code.includes("storages: ['cookies', 'sessionstorage']"), 'window-manager must clear only cookies & sessionstorage');
});

// 2. Verify store.ts initializes theme from localStorage and persists on setTheme
check('store.ts initializes theme from localStorage and saves to server', () => {
  const storePath = path.resolve(__dirname, '../src/components/library/store.ts');
  const code = fs.readFileSync(storePath, 'utf8');
  assert.ok(code.includes("localStorage.getItem('library-theme')"), 'store.ts must read library-theme');
  assert.ok(code.includes("defaultTheme: theme"), 'setTheme in store.ts must persist defaultTheme to server');
});

// 3. Verify index.html in out and dist-desktop checks localStorage and toggles .dark
check('index.html inline script properly restores saved theme before paint', () => {
  const h1 = fs.readFileSync(path.resolve(__dirname, '../out/index.html'), 'utf8');
  const h2 = fs.readFileSync(path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/client/index.html'), 'utf8');
  for (const h of [h1, h2]) {
    assert.ok(h.includes("var t=localStorage.getItem('library-theme')"), 'index.html must check library-theme');
    assert.ok(h.includes("if(t){document.documentElement.classList.toggle('dark',t==='dark');}"), 'index.html must toggle dark class based on t');
  }
});

// 4. Verify client chunks have setTheme persistence
check('client production chunks contain server persistence in setTheme', () => {
  const c1 = fs.readFileSync(path.resolve(__dirname, '../out/_next/static/chunks/18yoqc7d05wnq.js'), 'utf8');
  const c2 = fs.readFileSync(path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js'), 'utf8');
  for (const c of [c1, c2]) {
    assert.ok(c.includes('defaultTheme:r};T("/system/settings/branding"'), 'chunk must persist theme to server settings');
  }
});

// 5. Verify AppSettings in database allows saving defaultTheme
check('AppSettings branding in custom.db stores and updates defaultTheme', () => {
  const Database = require(path.resolve(__dirname, '../server/node_modules/better-sqlite3'));
  const db = new Database(path.resolve(__dirname, '../data/custom.db'));
  const row = db.prepare("SELECT branding FROM AppSettings WHERE id = 'default'").get();
  assert.ok(row, 'AppSettings must exist');
  const branding = JSON.parse(row.branding);
  assert.ok('defaultTheme' in branding, 'defaultTheme must exist in branding');
});

console.log(`\nRESULTS: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('[PASS] ALL THEME PERSISTENCE REBOOT TESTS PASSED CLEANLY!');
}
