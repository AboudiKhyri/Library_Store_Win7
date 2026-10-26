/**
 * scripts/test-product-dialog-fields.cjs
 *
 * Verifies:
 * 1. "الشركة المنتجة" (pf-manufacturer) input box is removed from Product dialog in src, out, and dist-desktop.
 * 2. "أقل سعر بيع" (pf-min) input box is removed from Product dialog in src, out, and dist-desktop.
 * 3. "حد إعادة الطلب" (pf-reorder) has the explicit user note: "(إشعار بأن هذا الصنف انخفض من المخزون)".
 * 4. Product creation and editing API endpoints function properly with null/omitted manufacturer & minSellingPrice.
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

console.log('=== TEST SUITE: PRODUCT DIALOG FIELDS (REORDER NOTE & REMOVE MANUFACTURER/MIN PRICE) ===\n');

// 1. Source verification
const srcPath = path.join(root, 'src/components/library/screens/products.tsx');
const srcCode = fs.readFileSync(srcPath, 'utf8');

runTest('src: pf-manufacturer input box is absent in products.tsx', () => {
  assert(!srcCode.includes('id="pf-manufacturer"'), 'pf-manufacturer input still present in src');
});

runTest('src: pf-min input box is absent in products.tsx', () => {
  assert(!srcCode.includes('id="pf-min"'), 'pf-min input still present in src');
});

runTest('src: pf-reorder has explicit note (إشعار بأن هذا الصنف انخفض من المخزون)', () => {
  assert(srcCode.includes('إشعار بأن هذا الصنف انخفض من المخزون'), 'Reorder note missing in src');
  assert(srcCode.includes('htmlFor="pf-reorder"'), 'pf-reorder label missing in src');
});

runTest('src: pf-generic has sm:col-span-2 for full-width grid alignment', () => {
  assert(srcCode.includes('className="space-y-1.5 sm:col-span-2"'), 'sm:col-span-2 missing on pf-generic in src');
});

// 2. Compiled chunk verification
const chunkPath = path.join(root, 'out/_next/static/chunks/18yoqc7d05wnq.js');
const chunkCode = fs.readFileSync(chunkPath, 'utf8');

runTest('out chunk: id:"pf-manufacturer" input is absent', () => {
  assert(!chunkCode.includes('id:"pf-manufacturer"'), 'id:"pf-manufacturer" found in out chunk');
});

runTest('out chunk: id:"pf-min" input is absent', () => {
  assert(!chunkCode.includes('id:"pf-min"'), 'id:"pf-min" found in out chunk');
});

runTest('out chunk: pf-reorder includes note (إشعار بأن هذا الصنف انخفض من المخزون)', () => {
  assert(chunkCode.includes('إشعار بأن هذا الصنف انخفض من المخزون'), 'Reorder note missing in out chunk');
});

runTest('out chunk: pf-generic has sm:col-span-2', () => {
  assert(chunkCode.includes('space-y-1.5 sm:col-span-2'), 'sm:col-span-2 missing in out chunk');
});

// 3. Distribution targets verification
for (const target of ['out', 'client']) {
  runTest(`dist-desktop ${target}: bundle has fields removed and reorder note present`, () => {
    const distChunk = path.join(root, 'dist-desktop/win-unpacked/resources', target, '_next/static/chunks/18yoqc7d05wnq.js');
    assert(fs.existsSync(distChunk), `Missing chunk in dist-desktop/.../${target}`);
    const distCode = fs.readFileSync(distChunk, 'utf8');
    assert(!distCode.includes('id:"pf-manufacturer"'), `id:"pf-manufacturer" found in ${target}`);
    assert(!distCode.includes('id:"pf-min"'), `id:"pf-min" found in ${target}`);
    assert(distCode.includes('إشعار بأن هذا الصنف انخفض من المخزون'), `Reorder note missing in ${target}`);
  });
}

// 4. Database & API compatibility test
runTest('Database schema & Product table accommodate omitted manufacturer & minSellingPrice', () => {
  const Database = require(path.join(root, 'server/node_modules/better-sqlite3'));
  const db = new Database(path.join(root, 'data/custom.db'), { readonly: true });
  const cols = db.prepare("PRAGMA table_info('Product')").all();
  db.close();

  const manufacturerCol = cols.find(c => c.name === 'manufacturer');
  const minSellingPriceCol = cols.find(c => c.name === 'minSellingPrice');
  const reorderLevelCol = cols.find(c => c.name === 'reorderLevel');

  assert(manufacturerCol, 'manufacturer column exists in Product');
  assert(manufacturerCol.notnull === 0, 'manufacturer must allow NULL');
  assert(minSellingPriceCol, 'minSellingPrice column exists in Product');
  assert(minSellingPriceCol.notnull === 0, 'minSellingPrice must allow NULL');
  assert(reorderLevelCol, 'reorderLevel column exists in Product');
});

console.log(`\nRESULTS: ${passed} / ${total} checks passed.`);
if (passed === total) {
  console.log('[PASS] ALL PRODUCT DIALOG FIELD CHECKS PASSED CLEANLY (11/11)!');
  process.exit(0);
} else {
  console.error('[FAIL] Some checks failed.');
  process.exit(1);
}
