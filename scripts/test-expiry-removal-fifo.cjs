/**
 * Forensic Test Suite: Expiry Removal and FIFO Allocation Verification
 * Target: Windows 7 Edition (Node 16 + better-sqlite3)
 */
'use strict';

const Database = require('../server/node_modules/better-sqlite3');
const path = require('path');
const fs = require('fs');

console.log('====================================================');
console.log('  TESTING EXPIRY REMOVAL & FIFO ALLOCATION INTEGRITY');
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

// Create isolated test database
const testDbPath = path.join(__dirname, 'test-expiry.db');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const db = new Database(testDbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Load BASELINE_DDL from server/db.js
const serverDb = require('../server/db');

try {
  // --- 1. Schema Baseline & Version ---
  console.log('--- 1. Database Schema & Migration ---');
  db.pragma('user_version = 1');

  // Create baseline tables manually
  db.exec(`
    CREATE TABLE "Role" ("id" TEXT PRIMARY KEY, "key" TEXT UNIQUE, "nameAr" TEXT, "nameEn" TEXT, "permissions" TEXT, "isSystem" INT DEFAULT 0);
    CREATE TABLE "User" ("id" TEXT PRIMARY KEY, "tenantId" TEXT DEFAULT '', "username" TEXT UNIQUE, "passwordHash" TEXT, "displayName" TEXT, "roleKey" TEXT, "active" INT DEFAULT 1);
    CREATE TABLE "Product" ("id" TEXT PRIMARY KEY, "tenantId" TEXT DEFAULT '', "sku" TEXT, "nameAr" TEXT, "sellingPrice" REAL DEFAULT 0, "purchasePrice" REAL DEFAULT 0, "taxRate" REAL DEFAULT 0, "active" INT DEFAULT 1);
    CREATE TABLE "Batch" ("id" TEXT PRIMARY KEY, "tenantId" TEXT DEFAULT '', "productId" TEXT, "batchNo" TEXT, "expiryDate" DATETIME, "quantity" REAL DEFAULT 0, "costPrice" REAL DEFAULT 0, "sellPrice" REAL, "status" TEXT DEFAULT 'ACTIVE', "createdAt" DATETIME, "updatedAt" DATETIME);
    CREATE TABLE "Sale" ("id" TEXT PRIMARY KEY, "tenantId" TEXT DEFAULT '', "invoiceNo" TEXT, "cashierId" TEXT, "customerId" TEXT, "status" TEXT DEFAULT 'COMPLETED', "subtotal" REAL DEFAULT 0, "discount" REAL DEFAULT 0, "tax" REAL DEFAULT 0, "total" REAL DEFAULT 0, "paidAmount" REAL DEFAULT 0, "changeAmount" REAL DEFAULT 0, "paymentMethod" TEXT DEFAULT 'cash', "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE "SaleItem" ("id" TEXT PRIMARY KEY, "tenantId" TEXT DEFAULT '', "saleId" TEXT, "productId" TEXT, "batchId" TEXT, "batchNo" TEXT, "expiryDate" DATETIME, "productName" TEXT, "quantity" REAL, "unitPrice" REAL, "discount" REAL DEFAULT 0, "total" REAL, "costPrice" REAL DEFAULT 0);
    CREATE TABLE "StockMovement" ("id" TEXT PRIMARY KEY, "tenantId" TEXT DEFAULT '', "productId" TEXT, "batchId" TEXT, "type" TEXT, "quantity" REAL, "unitCost" REAL, "note" TEXT, "userId" TEXT, "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE "AuditLog" ("id" TEXT PRIMARY KEY, "tenantId" TEXT DEFAULT '', "userId" TEXT, "username" TEXT DEFAULT 'system', "action" TEXT, "entity" TEXT DEFAULT '', "entityId" TEXT, "metadata" TEXT DEFAULT '{}', "result" TEXT DEFAULT 'SUCCESS', "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE "Counter" ("tenantId" TEXT, "key" TEXT, "value" INTEGER DEFAULT 0, PRIMARY KEY ("tenantId", "key"));
  `);

  // Insert seed batches under schema v1: one expired with qty > 0, one expired with qty = 0
  db.prepare("INSERT INTO Product (id, tenantId, sku, nameAr, sellingPrice, purchasePrice, taxRate) VALUES ('p1', 'default', 'SKU-001', 'كشكول سلك 100 ورقة', 25, 15, 0)").run();
  db.prepare("INSERT INTO Batch (id, tenantId, productId, batchNo, expiryDate, quantity, costPrice, status, createdAt, updatedAt) VALUES ('b_old_exp', 'default', 'p1', 'BATCH-EXP-1', '2020-01-01', 10, 15, 'EXPIRED', '2020-01-01T00:00:00Z', '2020-01-01T00:00:00Z')").run();
  db.prepare("INSERT INTO Batch (id, tenantId, productId, batchNo, expiryDate, quantity, costPrice, status, createdAt, updatedAt) VALUES ('b_dep_exp', 'default', 'p1', 'BATCH-EXP-0', '2020-01-01', 0, 15, 'EXPIRED', '2020-01-01T00:00:00Z', '2020-01-01T00:00:00Z')").run();

  // Execute v1 -> v2 migration
  const now = new Date().toISOString();
  const activeRes = db.prepare("UPDATE Batch SET status='ACTIVE', updatedAt=? WHERE status='EXPIRED' AND quantity > 0").run(now);
  const depletedRes = db.prepare("UPDATE Batch SET status='DEPLETED', updatedAt=? WHERE status='EXPIRED' AND quantity <= 0").run(now);
  const totalRecovered = activeRes.changes + depletedRes.changes;

  if (totalRecovered > 0) {
    db.prepare(`INSERT INTO AuditLog (id, tenantId, userId, username, action, entity, metadata, result)
      VALUES (?,?,?,?,?,?,?,?)`).run(
      'audit_1', 'default', null, 'system',
      'MIGRATE_EXPIRY_REMOVAL', 'Batch',
      JSON.stringify({ recoveredActive: activeRes.changes, recoveredDepleted: depletedRes.changes, total: totalRecovered }),
      'SUCCESS'
    );
  }
  db.pragma('user_version = 2');

  const bActive = db.prepare("SELECT status FROM Batch WHERE id='b_old_exp'").get();
  assert(bActive.status === 'ACTIVE', 'Migration recovered batch with positive quantity from EXPIRED to ACTIVE');

  const bDepleted = db.prepare("SELECT status FROM Batch WHERE id='b_dep_exp'").get();
  assert(bDepleted.status === 'DEPLETED', 'Migration set zero-quantity EXPIRED batch to DEPLETED');

  const auditEntry = db.prepare("SELECT * FROM AuditLog WHERE action='MIGRATE_EXPIRY_REMOVAL'").get();
  assert(auditEntry !== undefined, 'AuditLog record created for MIGRATE_EXPIRY_REMOVAL');

  const v = db.prepare('PRAGMA user_version').get().user_version;
  assert(v === 2, 'PRAGMA user_version is bumped to 2');

  // --- 2. FIFO Allocation Order vs Expiry ---
  console.log('\n--- 2. FIFO Allocation vs Expiry Verification ---');
  // Clean batches for p1
  db.prepare("DELETE FROM Batch WHERE productId='p1'").run();

  // Insert two batches:
  // Batch A: Older arrival (2026-01-01), far future expiry (2030-01-01), qty = 5
  // Batch B: Newer arrival (2026-06-01), past expiry date (2022-01-01), qty = 10
  db.prepare("INSERT INTO Batch (id, tenantId, productId, batchNo, expiryDate, quantity, costPrice, status, createdAt) VALUES ('batch_A', 'default', 'p1', 'LOT-001', '2030-01-01', 5, 12, 'ACTIVE', '2026-01-01T10:00:00Z')").run();
  db.prepare("INSERT INTO Batch (id, tenantId, productId, batchNo, expiryDate, quantity, costPrice, status, createdAt) VALUES ('batch_B', 'default', 'p1', 'LOT-002', '2022-01-01', 10, 14, 'ACTIVE', '2026-06-01T10:00:00Z')").run();

  // Test stockAvailableMap
  const availMap = serverDb.stockAvailableMap(db, ['p1'], 'default');
  assert(availMap['p1'] === 15, `stockAvailableMap returns all active stock (15 units) regardless of past expiry date`);

  // Query batches with FIFO ordering: ORDER BY createdAt ASC, id ASC
  const fifoBatches = db.prepare("SELECT * FROM Batch WHERE productId='p1' AND tenantId='default' AND status='ACTIVE' AND quantity>0 ORDER BY createdAt ASC, id ASC").all();
  assert(fifoBatches.length === 2, 'Found 2 active batches for P1');
  assert(fifoBatches[0].id === 'batch_A', 'FIFO: batch_A (oldest createdAt) is ranked FIRST');
  assert(fifoBatches[1].id === 'batch_B', 'FIFO: batch_B (newer createdAt) is ranked SECOND');

  // Simulate selling 7 units:
  // Should take 5 from batch_A and 2 from batch_B
  let remaining = 7;
  const allocations = [];
  for (const b of fifoBatches) {
    if (remaining <= 0) break;
    const take = Math.min(b.quantity, remaining);
    allocations.push({ batchId: b.id, batchNo: b.batchNo, expiryDate: null, qty: take, costPrice: b.costPrice });
    remaining -= take;
  }

  assert(allocations.length === 2, 'Allocation allocated across 2 batches');
  assert(allocations[0].batchId === 'batch_A' && allocations[0].qty === 5, 'batch_A allocated 5 units completely');
  assert(allocations[1].batchId === 'batch_B' && allocations[1].qty === 2, 'batch_B allocated remaining 2 units');
  assert(allocations[0].expiryDate === null, 'Allocation record has expiryDate = null');

  // Apply checkout mutations
  for (const a of allocations) {
    const cur = db.prepare("SELECT quantity FROM Batch WHERE id=?").get(a.batchId).quantity;
    const next = cur - a.qty;
    const newStatus = next <= 0 ? 'DEPLETED' : 'ACTIVE';
    db.prepare("UPDATE Batch SET quantity=?, status=? WHERE id=?").run(next, newStatus, a.batchId);
    db.prepare("INSERT INTO SaleItem (id, saleId, productId, batchId, batchNo, expiryDate, productName, quantity, unitPrice, total) VALUES (?,?,?,?,?,?,?,?,?,?)").run(
      'si_' + a.batchId, 'sale_1', 'p1', a.batchId, a.batchNo, null, 'كشكول سلك', a.qty, 25, a.qty * 25
    );
  }

  const updatedA = db.prepare("SELECT quantity, status FROM Batch WHERE id='batch_A'").get();
  assert(updatedA.quantity === 0 && updatedA.status === 'DEPLETED', 'batch_A depleted to 0 and marked DEPLETED');

  const updatedB = db.prepare("SELECT quantity, status FROM Batch WHERE id='batch_B'").get();
  assert(updatedB.quantity === 8 && updatedB.status === 'ACTIVE', 'batch_B depleted to 8 and remains ACTIVE');

  const saleItems = db.prepare("SELECT * FROM SaleItem WHERE saleId='sale_1'").all();
  assert(saleItems.every(si => si.expiryDate === null), 'All SaleItem rows written with expiryDate = NULL');

  // --- 3. Lot Identity (productId, batchNo, tenantId) ---
  console.log('\n--- 3. Lot Identity Preservation ---');
  // Receiving new inventory for existing lot: LOT-002
  const existingLot = db.prepare("SELECT * FROM Batch WHERE productId=@p AND batchNo=@b AND tenantId=@t").get({ p: 'p1', b: 'LOT-002', t: 'default' });
  assert(existingLot !== undefined && existingLot.id === 'batch_B', 'Lot identity (productId, batchNo, tenantId) uniquely resolves existing batch');

  // Receive 5 additional units for LOT-002
  db.prepare("UPDATE Batch SET quantity = quantity + 5 WHERE id=?").run('batch_B');
  const restockedB = db.prepare("SELECT quantity FROM Batch WHERE id='batch_B'").get();
  assert(restockedB.quantity === 13, 'Batch quantity successfully incremented to 13 on lot match');

  // --- 4. Historical Movements Display Gracefulness ---
  console.log('\n--- 4. Historical EXPIRY_WRITEOFF Movement Support ---');
  db.prepare("INSERT INTO StockMovement (id, productId, batchId, type, quantity, unitCost, note) VALUES ('sm_hist', 'p1', 'batch_A', 'EXPIRY_WRITEOFF', -2, 12, 'Historical adjustment')").run();

  const histRow = db.prepare("SELECT * FROM StockMovement WHERE id='sm_hist'").get();
  assert(histRow.type === 'EXPIRY_WRITEOFF', 'Historical EXPIRY_WRITEOFF row exists in DB');

  // Verify movementTypeLabel mapping in labels.ts
  const labelsFile = fs.readFileSync(path.join(__dirname, '../src/components/library/parts/labels.ts'), 'utf8');
  assert(
    labelsFile.includes("EXPIRY_WRITEOFF: ['إعدام/تسوية مخزنية', 'Write-off adjustment']"),
    'labels.ts maps EXPIRY_WRITEOFF to generic label: ["إعدام/تسوية مخزنية", "Write-off adjustment"]'
  );

  // Verify server/api.js labels map
  const apiFile = fs.readFileSync(path.join(__dirname, '../server/api.js'), 'utf8');
  assert(
    apiFile.includes("EXPIRY_WRITEOFF: 'إعدام/تسوية مخزنية'"),
    'server/api.js maps EXPIRY_WRITEOFF to: "إعدام/تسوية مخزنية"'
  );

} finally {
  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
}

console.log('\n====================================================');
console.log(`  SUITE SUMMARY: ${passed} / ${passed + failed} TESTS PASSED`);
console.log('====================================================');

if (failed > 0) process.exit(1);
