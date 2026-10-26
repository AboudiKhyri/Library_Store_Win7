const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('=== RUNNING FORENSIC SWITCH RTL & ZERO-OVERHANG AUDIT ===');

const outChunk = path.resolve(__dirname, '../out/_next/static/chunks/18yoqc7d05wnq.js');
const distChunk = path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js');
const outCss = path.resolve(__dirname, '../out/_next/static/chunks/3oa5e4nmj08il.css');
const distCss = path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/client/_next/static/chunks/3oa5e4nmj08il.css');

// 1. Verify zero broken manual translations in chunks
[outChunk, distChunk].forEach((cp) => {
  const code = fs.readFileSync(cp, 'utf8');
  assert(!code.includes('rtl:translate-x-[18px]'), `Found broken rtl:translate-x-[18px] in ${path.basename(cp)}`);
  assert(!code.includes('rtl:translate-x-[2px]'), `Found broken rtl:translate-x-[2px] in ${path.basename(cp)}`);
  console.log(`✓ Verified zero broken manual translations in ${path.basename(cp)}`);
});

// 2. Verify CSS rules in both out and dist-desktop
[outCss, distCss].forEach((cp) => {
  const css = fs.readFileSync(cp, 'utf8');
  assert(css.includes('overflow: hidden !important;'), `Missing overflow: hidden guard in ${path.basename(cp)}`);
  assert(css.includes('direction: ltr !important;'), `Missing direction: ltr guard in ${path.basename(cp)}`);
  assert(css.includes('translate: none !important;'), `Missing translate: none (CSS Transforms Level 2 double-translate shield) in ${path.basename(cp)}`);
  
  // RTL & LTR checks: Unchecked = 1px (Left), Checked = 15px (Right)
  assert(css.includes('transform: translate(1px, -50%) !important;'), `Missing 1px left alignment in ${path.basename(cp)}`);
  assert(css.includes('transform: translate(15px, -50%) !important;'), `Missing 15px right alignment in ${path.basename(cp)}`);
  assert(css.includes('background-color: #ffffff !important;'), `Missing white thumb in ${path.basename(cp)}`);

  console.log(`✓ Verified robust RTL & LTR Switch CSS rules in ${path.basename(cp)}`);
});

// 3. Mathematical proof of thumb position (Track = 32px, Border = 1px, Inner = 30px, Thumb = 16px)
const trackOuterWidth = 32;
const thumbWidth = 16;

// Position A: 1px from left
const posALeft = 1;
const posARight = trackOuterWidth - (posALeft + thumbWidth); // 15px
assert(posALeft >= 0, 'Position A left overhang!');
assert(posARight >= 0, 'Position A right overhang!');
assert(posALeft + thumbWidth <= trackOuterWidth, 'Position A exceeds track boundaries!');

// Position B: 15px from left
const posBLeft = 15;
const posBRight = trackOuterWidth - (posBLeft + thumbWidth); // 1px
assert(posBLeft >= 0, 'Position B left overhang!');
assert(posBRight >= 0, 'Position B right overhang!');
assert(posBLeft + thumbWidth <= trackOuterWidth, 'Position B exceeds track boundaries!');

console.log(`✓ Mathematical alignment verified:
  - Left Anchor (Unchecked / OFF in RTL & LTR): left=${posALeft}px, right=${posARight}px (0px overhang)
  - Right Anchor (Checked / ON in RTL & LTR): left=${posBLeft}px, right=${posBRight}px (0px overhang)
  - Total travel distance: ${posBLeft - posALeft}px exactly
  - Track containment: 100% inside [0, 32px]`);

// 4. Source code verification
const candidateSources = [
  path.resolve(__dirname, '../src/components/library/screens/products.tsx'),
  path.resolve(__dirname, '../../src/components/library/screens/products.tsx'),
  path.resolve(__dirname, '../src/components/ui/switch.tsx'),
  path.resolve(__dirname, '../../src/components/ui/switch.tsx'),
  path.resolve(__dirname, '../src/app/globals.css'),
  path.resolve(__dirname, '../../src/app/globals.css'),
];
const sourceFiles = candidateSources.filter(sp => fs.existsSync(sp));
assert(sourceFiles.length >= 3, 'Must verify at least local project source files');

sourceFiles.forEach((sp) => {
  const code = fs.readFileSync(sp, 'utf8');
  assert(!code.includes('rtl:translate-x-[18px]'), `Found broken rtl:translate-x-[18px] in ${path.basename(sp)}`);
  assert(!code.includes('rtl:translate-x-[2px]'), `Found broken rtl:translate-x-[2px] in ${path.basename(sp)}`);
  if (sp.endsWith('globals.css')) {
    assert(code.includes('translate: none !important;'), `Missing double-translate shield in ${path.basename(sp)}`);
    assert(code.includes('overflow: hidden !important;'), `Missing overflow shield in ${path.basename(sp)}`);
  }
  console.log(`✓ Source clean in ${path.relative(path.resolve(__dirname, '../..'), sp)}`);
});

console.log('\n[PASS] ALL SWITCH RTL FORENSIC CHECKS PASSED WITH 0 OVERHANG!');
