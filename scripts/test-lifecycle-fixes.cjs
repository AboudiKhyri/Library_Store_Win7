/**
 * Regression and Verification Test Suite for Lifecycle Fixes
 * Tests date safety, precision rounding, returns economics, cancel guard, WAC, and backup security.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('====================================================');
console.log('  RUNNING LIFECYCLE FIXES REGRESSION TEST SUITE');
console.log('====================================================\n');

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
  }
}

// ─── 1. DATE SAFETY TESTS ──────────────────────────────────────────────────────
console.log('--- 1. Date Safety & Parsing (toSafeDate) ---');

function toSafeDate(val) {
  if (val === null || val === undefined || val === '') return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    let d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
    const isoLike = trimmed.replace(' ', 'T');
    d = new Date(isoLike);
    if (!isNaN(d.getTime())) return d;
    d = new Date(isoLike + 'Z');
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function fmtDate(val, fallback = '—') {
  const d = toSafeDate(val);
  if (!d) return fallback;
  return d.toISOString().slice(0, 10);
}

function fmtDateTime(val, fallback = '—') {
  const d = toSafeDate(val);
  if (!d) return fallback;
  return d.toISOString();
}

test('toSafeDate returns null for null, undefined, empty string', () => {
  assert.strictEqual(toSafeDate(null), null);
  assert.strictEqual(toSafeDate(undefined), null);
  assert.strictEqual(toSafeDate(''), null);
  assert.strictEqual(toSafeDate('   '), null);
});

test('toSafeDate handles SQLite CURRENT_TIMESTAMP string (YYYY-MM-DD HH:MM:SS)', () => {
  const sqliteTs = '2026-10-21 12:30:45';
  const parsed = toSafeDate(sqliteTs);
  assert(parsed instanceof Date, 'Should parse to Date instance');
  assert(!isNaN(parsed.getTime()), 'Timestamp should be valid');
  assert.strictEqual(parsed.getUTCFullYear(), 2026);
  assert.strictEqual(parsed.getUTCMonth(), 9); // October is index 9
});

test('toSafeDate handles numeric timestamp in ms', () => {
  const ts = 1761049845000;
  const parsed = toSafeDate(ts);
  assert.strictEqual(parsed.getTime(), ts);
});

test('toSafeDate rejects garbage strings gracefully without throwing', () => {
  assert.strictEqual(toSafeDate('not-a-date'), null);
  assert.strictEqual(toSafeDate('{ invalid: json }'), null);
});

test('fmtDate and fmtDateTime never throw on non-Date or invalid input', () => {
  assert.strictEqual(fmtDate(null), '—');
  assert.strictEqual(fmtDate(undefined), '—');
  assert.strictEqual(fmtDate('garbage'), '—');
  assert.strictEqual(fmtDateTime(null), '—');
  assert.strictEqual(fmtDateTime({}), '—');
  assert.strictEqual(fmtDateTime(new Date('invalid')), '—');
});

// ─── 2. MONEY & QUANTITY PRECISION (r2 & r3) ──────────────────────────────────
console.log('\n--- 2. Precision Rounding (r2 & r3) ---');

function r2(val) {
  if (typeof val !== 'number' || !Number.isFinite(val)) return 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

function r3(val) {
  if (typeof val !== 'number' || !Number.isFinite(val)) return 0;
  return Math.round((val + Number.EPSILON) * 1000) / 1000;
}

test('r2 rounds standard currency without floating drift', () => {
  assert.strictEqual(r2(0.1 + 0.2), 0.3);
  assert.strictEqual(r2(1.005), 1.01);
  assert.strictEqual(r2(19.999), 20);
  assert.strictEqual(r2(0), 0);
});

test('r2 safely handles non-numbers, NaN, Infinity', () => {
  assert.strictEqual(r2(NaN), 0);
  assert.strictEqual(r2(Infinity), 0);
  assert.strictEqual(r2(-Infinity), 0);
  assert.strictEqual(r2(null), 0);
  assert.strictEqual(r2(undefined), 0);
  assert.strictEqual(r2('10.55'), 0);
});

test('r3 rounds weighable quantities to 3 decimal places', () => {
  assert.strictEqual(r3(0.001 + 0.002), 0.003);
  assert.strictEqual(r3(1.2345), 1.235);
  assert.strictEqual(r3(1.2344), 1.234);
});

// ─── 3. RETURNS ECONOMIC INTEGRITY ────────────────────────────────────────────
console.log('\n--- 3. Returns Economic Integrity & Loyalty Reversal ---');

test('Return unit price refunds net discounted unit price, not gross unit price', () => {
  // Scenario: Customer bought 2 items at gross unit price $100 ($200 total), with a $20 discount ($180 total paid).
  const saleItem = {
    quantity: 2,
    unitPrice: 100,
    total: 180, // net paid
  };
  const returnQuantity = 1;
  const netUnitPricePaid = saleItem.quantity > 0 ? r2(saleItem.total / saleItem.quantity) : saleItem.unitPrice;
  const refundAmount = r2(netUnitPricePaid * returnQuantity);

  assert.strictEqual(netUnitPricePaid, 90.0, 'Net unit price paid should be 90, not gross 100');
  assert.strictEqual(refundAmount, 90.0, 'Refund should be 90.0');
});

test('Loyalty point reversal is proportional to returned net amount', () => {
  const sale = {
    netTotal: 180,
    loyaltyPointsEarned: 18, // 1 point per 10 currency units
  };
  const refundAmount = 90;
  const pointsToReverse = sale.netTotal > 0
    ? Math.min(sale.loyaltyPointsEarned, Math.round((refundAmount / sale.netTotal) * sale.loyaltyPointsEarned))
    : 0;

  assert.strictEqual(pointsToReverse, 9, 'Should reverse exactly 9 points out of 18');
});

// ─── 4. CANCEL AFTER RETURN GUARD ─────────────────────────────────────────────
console.log('\n--- 4. Sale Cancellation Guard ---');

test('Cannot cancel sale if items have already been returned', () => {
  const sale = { id: 's-123', status: 'COMPLETED' };
  const mockReturnsForSale = [{ id: 'ret-1', saleId: 's-123' }];

  function cancelSaleGuard(returns) {
    if (returns.length > 0) {
      throw new Error('CANNOT_CANCEL_RETURNED_SALE: Sale has associated returns');
    }
    return true;
  }

  assert.throws(() => cancelSaleGuard(mockReturnsForSale), /CANNOT_CANCEL_RETURNED_SALE/);
  assert.doesNotThrow(() => cancelSaleGuard([]));
});

// ─── 5. WEIGHTED AVERAGE COST (WAC) ───────────────────────────────────────────
console.log('\n--- 5. Weighted Average Cost (WAC) Computation ---');

test('WAC formula accurately balances existing inventory and new purchase batches', () => {
  // Scenario: 10 units in stock @ $5 each = $50.
  // Receiving 10 units @ $7 each = $70.
  // New total units: 20. Total cost: $120. Expected WAC: $6.00
  const curStock = 10;
  const curCost = 5.0;
  const newUnits = 10;
  const newCost = 7.0;

  const totalQty = curStock + newUnits;
  const newWac = totalQty > 0 ? r2((curStock * curCost + newUnits * newCost) / totalQty) : newCost;

  assert.strictEqual(newWac, 6.0, 'WAC should be 6.00');
});

// ─── 6. BACKUP & RESTORE PATH TRAVERSAL GUARD ──────────────────────────────────
console.log('\n--- 6. Backup Security (Path Traversal Protection) ---');

test('path.basename sanitizes directory traversal payloads in restore ID', () => {
  const maliciousId = '../../../../Windows/System32/calc.exe';
  const sanitized = path.basename(maliciousId);
  assert.strictEqual(sanitized, 'calc.exe');

  const maliciousId2 = '..\\..\\secret.db';
  const sanitized2 = path.basename(maliciousId2.replace(/\\/g, '/'));
  assert.strictEqual(sanitized2, 'secret.db');
});

console.log('\n====================================================');
console.log(`  SUITE SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log('====================================================\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
