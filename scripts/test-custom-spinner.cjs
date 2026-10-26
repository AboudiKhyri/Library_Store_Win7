const fs = require('fs');
const assert = require('assert');
const path = require('path');
const vm = require('vm');

console.log('=== TEST SIMPLE PROGRESS BAR & LOADING INDICATORS ===');

const base = path.join(__dirname, '..');
const spinnerSrc = path.join(base, 'src/components/ui/spinner.tsx');
const globalsCss = path.join(base, 'src/app/globals.css');
const wmPath = path.join(base, 'desktop/engine/main/window-manager.js');
const kitPath = path.join(base, 'src/components/library/parts/kit.tsx');
const clientChunks = [
  path.join(base, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(base, 'out/_next/static/chunks/18yoqc7d05wnq.js')
];
const clientCss = [
  path.join(base, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/3oa5e4nmj08il.css'),
  path.join(base, 'out/_next/static/chunks/3oa5e4nmj08il.css')
];

// 1. Verify spinner / progress bar component source
assert(fs.existsSync(spinnerSrc), 'src/components/ui/spinner.tsx must exist');
const src = fs.readFileSync(spinnerSrc, 'utf8');
assert(src.includes('export function Spinner'), 'Must export Spinner function');
assert(src.includes('export function ProgressBar'), 'Must export ProgressBar function');
assert(src.includes('animate-simple-progress'), 'Must use simple progress animation');
assert(src.includes('w-[246px]'), 'Must have 246px width matching reference image');
assert(src.includes('role="status"'), 'Must have accessible role status');
console.log('✓ src/components/ui/spinner.tsx verified with ProgressBar, Spinner and distortion-free structure');

// 2. Verify globals.css keyframes and animation
assert(fs.existsSync(globalsCss), 'src/app/globals.css must exist');
const css = fs.readFileSync(globalsCss, 'utf8');
assert(css.includes('@keyframes simple-progress-sweep'), 'Missing simple-progress-sweep in globals.css');
assert(css.includes('.animate-simple-progress'), 'Missing .animate-simple-progress in globals.css');
console.log('✓ globals.css verified with simple progress keyframes and classes');

// 3. Verify Electron splash screen in window-manager.js
assert(fs.existsSync(wmPath), 'window-manager.js must exist');
const wm = fs.readFileSync(wmPath, 'utf8');
assert(wm.includes('progress-bar-track'), 'window-manager.js must use progress-bar-track class');
assert(wm.includes('progress-bar-fill'), 'window-manager.js must use progress-bar-fill class');
assert(wm.includes('جاري التحميل'), 'window-manager.js must include Arabic loading label');
assert(!wm.includes('custom-spinner'), 'window-manager.js must NOT use old distorted custom-spinner SVG');
console.log('✓ Electron native splash screen verified with distortion-free horizontal progress bar');

// 4. Verify kit.tsx LoadingBlock
assert(fs.existsSync(kitPath), 'kit.tsx must exist');
const kit = fs.readFileSync(kitPath, 'utf8');
assert(kit.includes('<ProgressBar label='), 'kit.tsx LoadingBlock must render ProgressBar');
assert(kit.includes('export { Spinner'), 'kit.tsx must export Spinner');
assert(kit.includes('ProgressBar'), 'kit.tsx must export ProgressBar');
console.log('✓ kit.tsx LoadingBlock verified with ProgressBar');

// 5. Verify production CSS bundles
for (const p of clientCss) {
  assert(fs.existsSync(p), `CSS bundle missing: ${p}`);
  const c = fs.readFileSync(p, 'utf8');
  assert(c.includes('animate-simple-progress'), `CSS bundle ${path.basename(p)} missing animate-simple-progress`);
  console.log(`✓ Production CSS bundle ${path.basename(p)} verified with simple progress animation`);
}

// 6. Verify production JS chunks
for (const p of clientChunks) {
  assert(fs.existsSync(p), `JS chunk missing: ${p}`);
  const js = fs.readFileSync(p, 'utf8');
  assert(js.includes('animate-simple-progress'), `JS chunk ${path.basename(p)} missing animate-simple-progress`);
  assert(js.includes('w-[246px]'), `JS chunk ${path.basename(p)} missing 246px container`);
  assert(js.includes('جاري التحميل'), `JS chunk ${path.basename(p)} missing loading label`);
  assert(!js.includes('library-loadingblock-grad'), `JS chunk ${path.basename(p)} should not have old distorted SVG gradient`);
  // Validate syntax
  new vm.Script(js);
  console.log(`✓ Production JS chunk ${path.basename(p)} verified with valid syntax`);
}

console.log('[PASS] ALL SIMPLE PROGRESS BAR CHECKS PASSED CLEANLY (10/10)!');
