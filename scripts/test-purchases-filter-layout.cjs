const fs = require('fs');
const assert = require('assert');
const path = require('path');

console.log('=== TEST PURCHASES FILTER LAYOUT ORGANIZATION ===\n');

const base = path.resolve(__dirname, '..');

// 1. Verify source file purchases.tsx
const srcPath = path.join(base, 'src/components/library/screens/purchases.tsx');
assert(fs.existsSync(srcPath), 'purchases.tsx does not exist');
const src = fs.readFileSync(srcPath, 'utf8');

assert(src.includes('حالة الفاتورة'), 'purchases.tsx must include explicit label for invoice status');
assert(src.includes('حالة السداد'), 'purchases.tsx must include explicit label for payment status');
assert(src.includes('من تاريخ'), 'purchases.tsx must include explicit label for from date');
assert(src.includes('إلى تاريخ'), 'purchases.tsx must include explicit label for to date');
assert(src.includes('grid grid-cols-1 gap-3 border-t border-border/40 pt-3 sm:grid-cols-2 lg:grid-cols-4'), 'purchases.tsx must use 4-column responsive grid');
assert(src.includes('className="flex flex-col gap-3 lg:flex-row lg:items-center"'), 'purchases.tsx must keep top toolbar flex layout');
assert(src.includes('className="relative min-w-0 flex-1"'), 'purchases.tsx must keep search input wrapper expanded');
console.log('✓ Source file purchases.tsx verified with organized 4-box filter layout');

// 2. Verify compiled chunks
const chunkFiles = [
  path.join(base, 'out/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(base, 'dist-desktop/win-unpacked/resources/out/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(base, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js')
];

for (const cf of chunkFiles) {
  assert(fs.existsSync(cf), `Chunk file does not exist: ${cf}`);
  const js = fs.readFileSync(cf, 'utf8');

  assert(js.includes('حالة الفاتورة'), `Chunk ${path.basename(cf)} must include "حالة الفاتورة" label`);
  assert(js.includes('حالة السداد'), `Chunk ${path.basename(cf)} must include "حالة السداد" label`);
  assert(js.includes('من تاريخ'), `Chunk ${path.basename(cf)} must include "من تاريخ" label`);
  assert(js.includes('إلى تاريخ'), `Chunk ${path.basename(cf)} must include "إلى تاريخ" label`);
  assert(js.includes('h-9 w-full bg-background'), `Chunk ${path.basename(cf)} must include bg-background on filter controls`);
  assert(js.includes('grid-cols-1 gap-3 border-t border-border/40 pt-3 sm:grid-cols-2 lg:grid-cols-4'), `Chunk ${path.basename(cf)} must maintain 4-column grid`);
  console.log(`✓ Production chunk verified: ${path.relative(base, cf)}`);
}

console.log('\n[PASS] ALL PURCHASES FILTER LAYOUT CHECKS PASSED CLEANLY (7/7)!');
