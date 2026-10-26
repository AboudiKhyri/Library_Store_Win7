/**
 * Forensic Verification Test Suite: Total Expiry & FEFO Purge Verification
 * Asserts 0 occurrences of legacy expiry/FEFO elements in compiled chunks and source files.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('====================================================');
console.log('  TESTING TOTAL FEFO & EXPIRY PURGE INTEGRITY');
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
  console.log(`--- Checking ${rel} ---`);
  assert(fs.existsSync(chunkPath), `Chunk file exists: ${rel}`);
  
  const content = fs.readFileSync(chunkPath, 'utf8');

  // Syntax validation
  let syntaxOk = false;
  try {
    new vm.Script(content);
    syntaxOk = true;
  } catch (e) {
    console.error(`Syntax error in ${rel}:`, e.message);
  }
  assert(syntaxOk, `vm.Script compilation verified: 0 syntax errors`);

  // Target zero-tolerance assertions
  assert(!content.includes('الباتشات والصلاحية'), 'Zero occurrences of "الباتشات والصلاحية"');
  assert(!content.includes('الأقرب انتهاء'), 'Zero occurrences of "الأقرب انتهاء"');
  assert(!content.includes('FEFO —'), 'Zero occurrences of "FEFO —"');
  assert(!content.includes('بدون تاريخ'), 'Zero occurrences of "بدون تاريخ"');
  assert(!content.includes('تقرير الصلاحية'), 'Zero occurrences of "تقرير الصلاحية" anywhere in chunk');
  assert(!content.includes('السماح ببيع الأصناف منتهية الصلاحية'), 'Zero occurrences of allow expired items switch in Settings');
  assert(!content.includes('تعليم الدفعات التي تجاوزت تاريخ انتهائها كمنتهية الصلاحية'), 'Zero occurrences of expiry sweep card in Settings');
  assert(!content.includes('description:e("inv.fifo")'), 'Inventory header uses clean static description instead of inv.fifo');
  assert(content.includes('description:"متابعة وإدارة كميات الأصناف وحركات المخزون"'), 'Inventory header renders clean store description');
  assert(!content.includes('key:"nearestExpiry"'), 'Zero occurrences of nearestExpiry column in inventory table');
  assert(!content.includes('key:"stockExpired"'), 'Zero occurrences of stockExpired column in inventory table');
  assert(!content.includes('r("inv.expired")'), 'Zero occurrences of inv.expired chip/header in inventory table');
  assert(content.includes('value:"batches",className:"gap-1.5",children:[(0,N.jsx)(kE,{className:"h-4 w-4"}),"الباتشات"]'), 'Tab 2 title is clean "الباتشات"');
}

// Check source files
console.log('\n--- Checking Source Files ---');
const inventorySrc = path.resolve(__dirname, '../src/components/library/screens/inventory.tsx');
const invContent = fs.readFileSync(inventorySrc, 'utf8');
assert(!invContent.includes('الباتشات والصلاحية'), 'inventory.tsx source has no "الباتشات والصلاحية"');
assert(!invContent.includes('inv.fefo'), 'inventory.tsx source has no "inv.fefo"');
assert(!invContent.includes('nearestExpiry'), 'inventory.tsx source has no nearestExpiry column');
assert(!invContent.includes('stockExpired'), 'inventory.tsx source has no stockExpired column');

const settingsSrc = path.resolve(__dirname, '../src/components/library/screens/settings.tsx');
const setContent = fs.readFileSync(settingsSrc, 'utf8');
assert(!setContent.includes('expiryWarningDays'), 'settings.tsx source has no "expiryWarningDays"');
assert(!setContent.includes('allowSellingExpired'), 'settings.tsx source has no "allowSellingExpired"');

const reportsSrc = path.resolve(__dirname, '../src/components/library/screens/reports.tsx');
const repContent = fs.readFileSync(reportsSrc, 'utf8');
assert(!repContent.includes("id: 'expiry'"), 'reports.tsx source has no expiry report definition');

console.log(`\nSUITE SUMMARY: ${passed} / ${passed + failed} TESTS PASSED`);
if (failed > 0) {
  process.exit(1);
}
