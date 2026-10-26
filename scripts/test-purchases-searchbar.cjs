const fs = require('fs');
const assert = require('assert');
const path = require('path');

console.log('=== TEST PURCHASES SEARCHBAR EXPANSION & RESPONSIVENESS ===');

const base = path.join(__dirname, '..');
const srcFile = path.join(base, 'src/components/library/screens/purchases.tsx');
const clientFiles = [
  path.join(base, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(base, 'out/_next/static/chunks/18yoqc7d05wnq.js')
];

// 1. Verify source file
assert(fs.existsSync(srcFile), 'purchases.tsx does not exist');
const src = fs.readFileSync(srcFile, 'utf8');
assert(
  src.includes('className="flex flex-col gap-3 lg:flex-row lg:items-center"'),
  'purchases.tsx should use flex layout for toolbar filters'
);
assert(
  src.includes('className="relative min-w-0 flex-1"'),
  'purchases.tsx search input wrapper should use min-w-0 flex-1 to occupy full available width'
);
console.log('✓ Source file purchases.tsx has flexible and wide searchbar container');

// 2. Verify compiled chunks
for (const p of clientFiles) {
  assert(fs.existsSync(p), `Chunk file does not exist: ${p}`);
  const js = fs.readFileSync(p, 'utf8');
  const searchIdx = js.indexOf('بحث برقم الفاتورة أو المورد...');
  assert(searchIdx !== -1, `Placeholder not found in ${p}`);
  
  const surroundingContext = js.substring(searchIdx - 350, searchIdx + 300);
  assert(
    surroundingContext.includes('className:"flex flex-col gap-3 lg:flex-row lg:items-center"'),
    `Purchases toolbar container missing flex layout in ${path.basename(p)}`
  );
  assert(
    surroundingContext.includes('className:"relative min-w-0 flex-1"'),
    `Purchases search wrapper missing min-w-0 flex-1 in ${path.basename(p)}`
  );
  assert(
    !surroundingContext.includes('grid-cols-5'),
    `Purchases searchbar still constrained by grid-cols-5 in ${path.basename(p)}`
  );
  console.log(`✓ Production chunk ${path.basename(p)} verified with expanded searchbar!`);
}

console.log('[PASS] ALL PURCHASES SEARCHBAR CHECKS PASSED CLEANLY (4/4)!');
