/**
 * Unit Test: Barcode Generator & EAN-13 Check Digit
 * Tests 10,000 samples for mathematical GS1 validity.
 */
'use strict';

const crypto = require('crypto');

function calculateEan13CheckDigit(payload12) {
  if (typeof payload12 !== 'string' || payload12.length !== 12 || !/^\d{12}$/.test(payload12)) {
    throw new Error('EAN-13 payload must be exactly 12 numeric digits');
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = payload12.charCodeAt(i) - 48;
    sum += i % 2 === 0 ? digit : digit * 3;
  }

  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

function isValidEan13(barcode) {
  if (typeof barcode !== 'string' || barcode.length !== 13 || !/^\d{13}$/.test(barcode)) {
    return false;
  }
  const payload12 = barcode.slice(0, 12);
  const expectedCheckDigit = calculateEan13CheckDigit(payload12);
  const actualCheckDigit = barcode.charCodeAt(12) - 48;
  return expectedCheckDigit === actualCheckDigit;
}

function generateEan13(prefix = 200) {
  if (prefix < 200 || prefix > 299) {
    throw new Error('In-store EAN-13 prefix must be between 200 and 299');
  }
  const prefixStr = String(prefix).padStart(3, '0');
  const bytes = crypto.randomBytes(9);
  let randomBody = '';
  for (let i = 0; i < 9; i++) {
    randomBody += (bytes[i] % 10).toString();
  }
  const payload12 = prefixStr + randomBody;
  const checkDigit = calculateEan13CheckDigit(payload12);
  return payload12 + checkDigit.toString();
}

function normalizeBarcode(input) {
  if (input === null || input === undefined) return null;
  const str = String(input).replace(/[\x00-\x1F\x7F]/g, '').trim();
  return str.length > 0 ? str : null;
}

console.log('====================================================');
console.log('  RUNNING BARCODE GENERATOR UNIT TESTS');
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

// 1. Known Samples
assert(isValidEan13('6221048100017') === true, 'Known valid barcode (6221048100017) passes validation');
assert(isValidEan13('6221048100015') === false, 'Known invalid barcode (6221048100015 - bad check digit) fails validation');
assert(isValidEan13('12345') === false, 'Short barcode rejected');
assert(isValidEan13('622104810001A') === false, 'Non-numeric barcode rejected');

// 2. Normalization
assert(normalizeBarcode('  0123456789  ') === '0123456789', 'Normalization trims whitespace and preserves leading zeros');
assert(normalizeBarcode('000123') === '000123', 'Normalization preserves multiple leading zeros');
assert(normalizeBarcode('') === null, 'Empty string normalized to NULL');
assert(normalizeBarcode('   ') === null, 'Whitespace-only string normalized to NULL');
assert(normalizeBarcode(null) === null, 'null normalized to NULL');
assert(normalizeBarcode(undefined) === null, 'undefined normalized to NULL');
assert(normalizeBarcode('62210\x00\x1F481') === '62210481', 'Non-printable control characters stripped');

// 3. Stress Test: 10,000 samples
console.log('\n--- Stress Testing 10,000 Generated EAN-13 Samples ---');
const SAMPLE_COUNT = 10000;
let invalidCount = 0;
const prefixCounts = {};

for (let i = 0; i < SAMPLE_COUNT; i++) {
  const prefix = 200 + (i % 100); // 200..299
  const code = generateEan13(prefix);
  prefixCounts[code.slice(0, 3)] = (prefixCounts[code.slice(0, 3)] || 0) + 1;

  if (!isValidEan13(code)) {
    invalidCount++;
  }
}

assert(invalidCount === 0, `All ${SAMPLE_COUNT} generated EAN-13 barcodes are mathematically valid`);
assert(Object.keys(prefixCounts).length === 100, 'All prefixes from 200 to 299 successfully represented');

// 4. Uniqueness Retry Test
const collisions = new Set();
const testPrefix = 250;
let retryCollisionsSimulated = 0;

// Populate set with 100 codes
for (let i = 0; i < 100; i++) {
  collisions.add(generateEan13(testPrefix));
}

// Generate new unique code
let candidate = '';
for (let retry = 0; retry < 10; retry++) {
  candidate = generateEan13(testPrefix);
  if (!collisions.has(candidate)) {
    break;
  }
  retryCollisionsSimulated++;
}

assert(!collisions.has(candidate), 'Uniqueness retry mechanism successfully avoided collision');

console.log('\n====================================================');
console.log(`  SUITE SUMMARY: ${passed} / ${passed + failed} TESTS PASSED`);
console.log('====================================================');

if (failed > 0) process.exit(1);
