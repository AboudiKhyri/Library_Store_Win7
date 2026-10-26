/**
 * Forensic Verification Test Suite: Opacity Fallbacks & Loyalty Dialog Contrast
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('====================================================');
console.log('  TESTING OPACITY FALLBACKS & LOYALTY UI INTEGRITY');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

const chunks = [
  path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js'),
  path.resolve(__dirname, '../out/_next/static/chunks/18yoqc7d05wnq.js')
];

for (const chunkPath of chunks) {
  const rel = path.relative(path.resolve(__dirname, '..'), chunkPath);
  console.log(`--- Checking chunk: ${rel} ---`);
  const content = fs.readFileSync(chunkPath, 'utf8');

  // Verify bracketed opacities eliminated
  assert(!content.includes('bg-primary/[0.06]'), 'Zero occurrences of bg-primary/[0.06]');
  assert(!content.includes('bg-primary/[0.07]'), 'Zero occurrences of bg-primary/[0.07]');
  assert(!content.includes('bg-primary/[0.08]'), 'Zero occurrences of bg-primary/[0.08]');
  assert(!content.includes('bg-primary/[0.05]'), 'Zero occurrences of bg-primary/[0.05]');
  assert(!content.includes('hover:bg-primary/[0.04]'), 'Zero occurrences of hover:bg-primary/[0.04]');
  assert(!content.includes('placeholder:"±نقاط"'), 'Zero occurrences of broken placeholder ±نقاط');
  assert(content.includes('placeholder:"+10 / -5"'), 'Contains clean placeholder +10 / -5');

  // Verify syntax
  let syntaxOk = false;
  try {
    new vm.Script(content);
    syntaxOk = true;
  } catch (e) {
    console.error(e);
  }
  assert(syntaxOk, 'vm.Script compilation verified: 0 syntax errors');
}

// Check CSS fallbacks
const cssFiles = [
  path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/client/_next/static/chunks/3oa5e4nmj08il.css'),
  path.resolve(__dirname, '../out/_next/static/chunks/3oa5e4nmj08il.css')
];

for (const cssPath of cssFiles) {
  const rel = path.relative(path.resolve(__dirname, '..'), cssPath);
  console.log(`--- Checking CSS: ${rel} ---`);
  const css = fs.readFileSync(cssPath, 'utf8');
  assert(css.includes('rgba(var(--primary-rgb), 0.08)'), 'Contains RGBA fallback for bracketed primary opacities');
  assert(css.includes('rgba(var(--primary-rgb), 0.05)'), 'Contains RGBA fallback for bracketed hover opacity');
}

// Check source files
const customerSrc = path.resolve(__dirname, '../src/components/library/screens/customers.tsx');
const custContent = fs.readFileSync(customerSrc, 'utf8');
assert(!custContent.includes('bg-primary/[0.06]'), 'customers.tsx source has no bg-primary/[0.06]');
assert(!custContent.includes('bg-primary/[0.07]'), 'customers.tsx source has no bg-primary/[0.07]');
assert(custContent.includes('placeholder="+10 / -5"'), 'customers.tsx source has clean placeholder');

console.log(`\nSUITE SUMMARY: ${passed} / ${passed + failed} TESTS PASSED`);
if (failed > 0) {
  process.exit(1);
}
