const fs = require('fs');
const assert = require('assert');
const path = require('path');

console.log('=== TEST SETTINGS INVENTORY TAB REMOVAL ===');

const base = path.join(__dirname, '..');
const srcFile = path.join(base, 'src/components/library/screens/settings.tsx');
const clientFiles = [
  path.join(base, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(base, 'out/_next/static/chunks/18yoqc7d05wnq.js')
];

// 1. Verify source file
assert(fs.existsSync(srcFile), 'settings.tsx does not exist');
const src = fs.readFileSync(srcFile, 'utf8');
assert(!src.includes("{ key: 'inventory'"), 'settings.tsx still contains inventory section definition');
assert(!src.includes('<TabsContent value="inventory"'), 'settings.tsx still contains TabsContent value="inventory"');
assert(!src.includes('function InventorySection'), 'settings.tsx still contains InventorySection component');
assert(src.includes("{ key: 'business'"), 'settings.tsx should retain business tab');
assert(src.includes("{ key: 'branding'"), 'settings.tsx should retain branding tab');
assert(src.includes("{ key: 'pos'"), 'settings.tsx should retain pos tab');
assert(src.includes("{ key: 'hardware'"), 'settings.tsx should retain hardware tab');
assert(src.includes("{ key: 'backup'"), 'settings.tsx should retain backup tab');
assert(src.includes("{ key: 'localization'"), 'settings.tsx should retain localization tab');
console.log('✓ Source file settings.tsx verified: inventory tab completely removed, other tabs intact');

// 2. Verify compiled production chunks
for (const p of clientFiles) {
  assert(fs.existsSync(p), `Chunk file does not exist: ${p}`);
  const js = fs.readFileSync(p, 'utf8');
  assert(
    !js.includes('{key:"inventory",label:e("settings.inventory")'),
    `Chunk ${path.basename(p)} still contains inventory tab item in sections array`
  );
  assert(
    !js.includes('value:"inventory"'),
    `Chunk ${path.basename(p)} still contains value:"inventory" tab content`
  );
  assert(
    js.includes('{key:"pos",label:e("settings.pos")'),
    `Chunk ${path.basename(p)} missing pos tab`
  );
  assert(
    js.includes('{key:"hardware",label:e("settings.hardware")'),
    `Chunk ${path.basename(p)} missing hardware tab`
  );
  console.log(`✓ Production chunk ${path.basename(p)} verified: inventory tab eliminated!`);
}

console.log('[PASS] ALL SETTINGS INVENTORY TAB REMOVAL CHECKS PASSED CLEANLY (6/6)!');
