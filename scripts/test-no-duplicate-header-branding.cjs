/**
 * scripts/test-no-duplicate-header-branding.cjs
 * Automated test asserting that the duplicate header branding on the left is removed,
 * while the right-hand sidebar branding remains fully functional and bound to settings.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== TEST SUITE: NO DUPLICATE HEADER BRANDING ===\n');

const root = path.resolve(__dirname, '..');
const appTsxPath = path.join(root, 'src/components/library/app.tsx');
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

// 1. Verify src/components/library/app.tsx
const appTsx = fs.readFileSync(appTsxPath, 'utf8');

runTest('(a) Duplicate header branding block is absent in app.tsx', () => {
  assert(!appTsx.includes('width={32} height={32}'), 'Header logo (width=32) still found in app.tsx');
  assert(!appTsx.includes('truncate text-[11px] text-muted-foreground">{appName}</p>'), 'Header appName text still found in app.tsx');
});

runTest('(b) Sidebar branding on the right remains intact in app.tsx', () => {
  assert(appTsx.includes('SidebarContent'), 'SidebarContent missing from app.tsx');
  assert(appTsx.includes('width={28} height={28}'), 'Sidebar logo (width=28) missing from app.tsx');
  assert(appTsx.includes('status?.business?.displayName || status?.branding?.appName'), 'Sidebar dynamic displayName missing from app.tsx');
  assert(appTsx.includes('status?.business?.businessName || (status?.branding as any)?.tagline'), 'Sidebar dynamic businessName/tagline missing from app.tsx');
});

// 2. Verify out/_next/static/chunks/18yoqc7d05wnq.js
const chunkCode = fs.readFileSync(chunkPath, 'utf8');

runTest('(c) Duplicate header branding is absent from out chunk', () => {
  assert(!chunkCode.includes('alt:"Library Store",width:32,height:32'), 'Duplicate header logo found in out chunk');
  assert(!chunkCode.includes('className:"truncate text-[11px] text-muted-foreground",children:j'), 'Duplicate header tagline found in out chunk');
});

runTest('(d) Right-hand sidebar branding remains intact in out chunk', () => {
  assert(chunkCode.includes('width:28,height:28'), 'Sidebar logo missing in out chunk');
  assert(chunkCode.includes('a?.business?.displayName||a?.branding?.appName||"Library Store"'), 'Sidebar displayName missing in out chunk');
  assert(chunkCode.includes('a?.business?.businessName||a?.branding?.tagline||"نظام إدارة المتاجر"'), 'Sidebar businessName/tagline missing in out chunk');
});

// 3. Verify dist-desktop targets
for (const p of [distChunkClient, distChunkOut]) {
  if (fs.existsSync(p)) {
    const c = fs.readFileSync(p, 'utf8');
    runTest(`(e) Duplicate header branding absent in ${path.relative(root, p)}`, () => {
      assert(!c.includes('alt:"Library Store",width:32,height:32'), `Duplicate header logo found in ${p}`);
      assert(c.includes('width:28,height:28'), `Sidebar logo missing in ${p}`);
    });
  }
}

console.log(`\nRESULTS: ${passed} / ${total} checks passed.`);
if (passed === total) {
  console.log('[PASS] ALL DUPLICATE HEADER BRANDING REMOVAL CHECKS PASSED CLEANLY!');
  process.exit(0);
} else {
  console.error('[FAIL] Some checks failed.');
  process.exit(1);
}
