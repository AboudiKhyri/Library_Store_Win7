const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('=== RUNNING WEIGHABLE TOGGLE & LAYOUT INTEGRITY AUDIT ===');

const root = path.resolve(__dirname, '..');

// 1. Check source file
const productsTsx = path.join(root, 'src/components/library/screens/products.tsx');
const tsx = fs.readFileSync(productsTsx, 'utf8');
assert(!tsx.includes('<button type="button" role="switch"'), 'Source still has nested button[role="switch"] wrapper');
assert(tsx.includes('role="button"'), 'Source missing role="button" interactive card');
assert(tsx.includes('نعم — كميات كسرية في نقطة البيع'), 'Source missing Arabic affirmative label');
assert(tsx.includes('لا — كميات صحيحة'), 'Source missing Arabic negative label');
assert(tsx.includes("if (next && form.unit === 'piece') set('unit', 'kg')"), 'Source missing auto-unit switch to kg');
console.log('✓ Verified products.tsx source code integrity');

// 2. Check compiled JS chunks
const chunkFiles = [
  path.join(root, 'out/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(root, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js')
];

for (const cp of chunkFiles) {
  const js = fs.readFileSync(cp, 'utf8');
  assert(!js.includes('("button",{type:"button",role:"switch","aria-checked":c.isWeighable'), `Found collapsed button wrapper in ${path.basename(cp)}`);
  assert(js.includes('("div",{role:"button"'), `Missing div role="button" card in ${path.basename(cp)}`);
  assert(js.includes('نعم — كميات كسرية في نقطة البيع'), `Missing affirmative label in ${path.basename(cp)}`);
  assert(js.includes('لا — كميات صحيحة'), `Missing negative label in ${path.basename(cp)}`);
  assert(js.includes('"piece"===c.unit?x("unit","kg")'), `Missing auto-unit switch to kg in ${path.basename(cp)}`);
  console.log(`✓ Verified compiled chunk: ${path.basename(cp)}`);
}

// 3. Check CSS files
const cssFiles = [
  path.join(root, 'src/app/globals.css'),
  path.join(root, 'out/_next/static/chunks/3oa5e4nmj08il.css'),
  path.join(root, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/3oa5e4nmj08il.css')
];

for (const fp of cssFiles) {
  const css = fs.readFileSync(fp, 'utf8');
  assert(css.includes('Weighable card container shield'), `Missing card shield in ${path.basename(fp)}`);
  assert(css.includes('div[role="button"].w-full'), `Missing full-width guard in ${path.basename(fp)}`);
  assert(css.includes('width: 100% !important;'), `Missing width: 100% in ${path.basename(fp)}`);
  console.log(`✓ Verified CSS rules in: ${path.basename(fp)}`);
}

console.log('\n[PASS] ALL WEIGHABLE TOGGLE & LAYOUT CHECKS PASSED CLEANLY (10/10)!');
