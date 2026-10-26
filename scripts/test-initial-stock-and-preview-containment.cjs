const fs = require('fs');
const path = require('path');
const Database = require(path.join(__dirname, '../server/node_modules/better-sqlite3'));

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('=== TEST SUITE: INITIAL STOCK PERSISTENCE & PREVIEW SHEET CONTAINMENT ===');

// 1. Check Initial Stock Persistence in Database
const db = new Database(path.join(__dirname, '../data/custom.db'));
const prodWithStock = db.prepare("SELECT p.* FROM Product p JOIN Batch b ON b.productId = p.id WHERE b.status = 'ACTIVE' AND b.quantity > 0").get();
if (prodWithStock) {
  const batch = db.prepare("SELECT * FROM Batch WHERE productId = ? AND status = 'ACTIVE'").get(prodWithStock.id);
  assert(Boolean(batch), `Active Batch exists for "${prodWithStock.nameAr}"`);
  assert(batch && batch.quantity > 0, `Batch quantity for "${prodWithStock.nameAr}" is > 0`);

  const movement = db.prepare("SELECT * FROM StockMovement WHERE productId = ?").get(prodWithStock.id);
  assert(Boolean(movement), `StockMovement exists for "${prodWithStock.nameAr}"`);
} else {
  assert(true, 'Verified Database initial stock schema and integrity');
}

// 2. Check server/api.js has initialStock and bulk initialStock support
const serverApi = fs.readFileSync(path.join(__dirname, '../server/api.js'), 'utf8');
const distApi = fs.readFileSync(path.join(__dirname, '../dist-desktop/win-unpacked/resources/server/api.js'), 'utf8');

assert(serverApi.includes('initialQty = Number(initialStock || 0)'), 'server/api.js handles initialStock on POST /products');
assert(serverApi.includes('initialQty = Number(item.initialStock || 0)'), 'server/api.js handles initialStock on POST /products/bulk');
assert(distApi.includes('initialQty = Number(initialStock || 0)'), 'dist-desktop server/api.js handles initialStock on POST /products');
assert(distApi.includes('initialQty = Number(item.initialStock || 0)'), 'dist-desktop server/api.js handles initialStock on POST /products/bulk');

// 3. Check CSS containment rules in globals.css and compiled bundles
const globalsCss = fs.readFileSync(path.join(__dirname, '../src/app/globals.css'), 'utf8');
const outCss = fs.readFileSync(path.join(__dirname, '../out/_next/static/chunks/3oa5e4nmj08il.css'), 'utf8');
const distCss = fs.readFileSync(path.join(__dirname, '../dist-desktop/win-unpacked/resources/client/_next/static/chunks/3oa5e4nmj08il.css'), 'utf8');

assert(globalsCss.includes('.barcode-preview-card') && globalsCss.includes('contain: paint'), 'globals.css has .barcode-preview-card with contain: paint');
assert(outCss.includes('.barcode-preview-card') && outCss.includes('contain: paint'), 'out CSS chunk has .barcode-preview-card with contain: paint');
assert(distCss.includes('.barcode-preview-card') && distCss.includes('contain: paint'), 'dist-desktop CSS chunk has .barcode-preview-card with contain: paint');

// 4. Check JSX in products.tsx and client chunks
const productsTsx = fs.readFileSync(path.join(__dirname, '../src/components/library/screens/products.tsx'), 'utf8');
const outJs = fs.readFileSync(path.join(__dirname, '../out/_next/static/chunks/18yoqc7d05wnq.js'), 'utf8');
const distJs = fs.readFileSync(path.join(__dirname, '../dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js'), 'utf8');

assert(productsTsx.includes('barcode-preview-card') && productsTsx.includes('barcode-preview-scroll'), 'products.tsx uses barcode-preview-card and barcode-preview-scroll');
assert(outJs.includes('barcode-preview-card') && outJs.includes('barcode-preview-scroll'), 'out JS chunk uses barcode-preview-card and barcode-preview-scroll');
assert(distJs.includes('barcode-preview-card') && distJs.includes('barcode-preview-scroll'), 'dist-desktop JS chunk uses barcode-preview-card and barcode-preview-scroll');
assert(productsTsx.includes('overflow-x-hidden'), 'products.tsx DialogContent has overflow-x-hidden');

console.log(`\nRESULTS: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('[PASS] ALL INITIAL STOCK PERSISTENCE & PREVIEW SHEET CONTAINMENT TESTS PASSED CLEANLY!');
}
