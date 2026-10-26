/**
 * LIBRARY STORE — Windows 7 Edition
 * Database layer: better-sqlite3 replacing Prisma
 * Compatible with Node.js 16.x
 */

'use strict';

const Database = require('better-sqlite3');
const { randomBytes } = require('crypto');
const path = require('path');
const fs = require('fs');

// ──────────────────────────────────────────────
// Schema DDL (mirrors src/lib/library/db-schema.ts)
// ──────────────────────────────────────────────

const SCHEMA_VERSION = 3;

const BASELINE_DDL = [
  `CREATE TABLE IF NOT EXISTS "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business" TEXT NOT NULL DEFAULT '{}',
    "branding" TEXT NOT NULL DEFAULT '{}',
    "hardware" TEXT NOT NULL DEFAULT '{}',
    "pos" TEXT NOT NULL DEFAULT '{}',
    "localization" TEXT NOT NULL DEFAULT '{}',
    "backup" TEXT NOT NULL DEFAULT '{}',
    "system" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT,
    "key" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "phone" TEXT,
    "roleKey" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT 1,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("roleKey") REFERENCES "Role" ("key") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "userId" TEXT,
    "username" TEXT NOT NULL DEFAULT 'system',
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL DEFAULT '',
    "entityId" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "result" TEXT NOT NULL DEFAULT 'SUCCESS',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Counter" (
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY ("tenantId", "key")
  )`,
  `CREATE TABLE IF NOT EXISTS "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "barcode" TEXT,
    "sku" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "genericName" TEXT,
    "categoryId" TEXT,
    "manufacturer" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'piece',
    "packSize" INTEGER NOT NULL DEFAULT 1,
    "isWeighable" BOOLEAN NOT NULL DEFAULT 0,
    "purchasePrice" REAL NOT NULL DEFAULT 0,
    "sellingPrice" REAL NOT NULL DEFAULT 0,
    "minSellingPrice" REAL,
    "taxRate" REAL NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 10,
    "active" BOOLEAN NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Batch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "productId" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL,
    "expiryDate" DATETIME, /* DEPRECATED: stationery store has no expiry. Always NULL */
    "quantity" REAL NOT NULL DEFAULT 0,
    "costPrice" REAL NOT NULL DEFAULT 0,
    "sellPrice" REAL,
    "supplierId" TEXT,
    "purchaseId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "productId" TEXT NOT NULL,
    "batchId" TEXT,
    "type" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unitCost" REAL,
    "refType" TEXT,
    "refId" TEXT,
    "note" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Purchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "invoiceNo" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "discount" REAL NOT NULL DEFAULT 0,
    "tax" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "notes" TEXT,
    "userId" TEXT,
    "receivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "PurchaseItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "purchaseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchNo" TEXT,
    "expiryDate" DATETIME, /* DEPRECATED: stationery store has no expiry. Always NULL */
    "quantity" REAL NOT NULL DEFAULT 0,
    "unitCost" REAL NOT NULL DEFAULT 0,
    "receivedQty" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "batchId" TEXT,
    FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "invoiceNo" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "customerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "discount" REAL NOT NULL DEFAULT 0,
    "tax" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "changeAmount" REAL NOT NULL DEFAULT 0,
    "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("cashierId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "SaleItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT,
    "batchNo" TEXT,
    "expiryDate" DATETIME, /* DEPRECATED: stationery store has no expiry. Always NULL */
    "productName" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL,
    "costPrice" REAL NOT NULL DEFAULT 0,
    "returnedQty" REAL NOT NULL DEFAULT 0,
    FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "SuspendedCart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "label" TEXT NOT NULL,
    "cart" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Return" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "returnNo" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "userId" TEXT,
    "total" REAL NOT NULL DEFAULT 0,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "ReturnItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "returnId" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "total" REAL NOT NULL,
    FOREIGN KEY ("returnId") REFERENCES "Return" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "StocktakeSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "userId" TEXT,
    "appliedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "StocktakeLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "sessionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "systemQty" REAL NOT NULL DEFAULT 0,
    "countedQty" REAL NOT NULL,
    "difference" REAL NOT NULL DEFAULT 0,
    "batchId" TEXT,
    FOREIGN KEY ("sessionId") REFERENCES "StocktakeSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "BackupRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "filename" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'MANUAL',
    "entityCounts" TEXT NOT NULL DEFAULT '{}',
    "note" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "LoyaltyEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "customerId" TEXT NOT NULL,
    "saleId" TEXT,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "value" REAL NOT NULL DEFAULT 0,
    "note" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  // Indexes
  `CREATE UNIQUE INDEX IF NOT EXISTS "Role_key_key" ON "Role"("key")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_tenantId_username_key" ON "User"("tenantId", "username")`,
  `CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt")`,
  `CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action")`,
  `CREATE INDEX IF NOT EXISTS "AuditLog_tenantId_idx" ON "AuditLog"("tenantId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Category_tenantId_nameAr_key" ON "Category"("tenantId", "nameAr")`,
  `CREATE INDEX IF NOT EXISTS "Product_tenantId_idx" ON "Product"("tenantId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Product_tenantId_barcode_key" ON "Product"("tenantId", "barcode")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Product_tenantId_sku_key" ON "Product"("tenantId", "sku")`,
  `CREATE INDEX IF NOT EXISTS "Batch_productId_idx" ON "Batch"("productId")`,
  `CREATE INDEX IF NOT EXISTS "Batch_expiryDate_idx" ON "Batch"("expiryDate")`,
  `CREATE INDEX IF NOT EXISTS "Batch_tenantId_idx" ON "Batch"("tenantId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Batch_productId_batchNo_createdAt_key" ON "Batch"("productId", "batchNo", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "StockMovement_productId_idx" ON "StockMovement"("productId")`,
  `CREATE INDEX IF NOT EXISTS "StockMovement_createdAt_idx" ON "StockMovement"("createdAt")`,
  `CREATE INDEX IF NOT EXISTS "StockMovement_type_idx" ON "StockMovement"("type")`,
  `CREATE INDEX IF NOT EXISTS "StockMovement_tenantId_idx" ON "StockMovement"("tenantId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Purchase_invoiceNo_key" ON "Purchase"("invoiceNo")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Sale_invoiceNo_key" ON "Sale"("invoiceNo")`,
  `CREATE INDEX IF NOT EXISTS "Sale_createdAt_idx" ON "Sale"("createdAt")`,
  `CREATE INDEX IF NOT EXISTS "Sale_cashierId_idx" ON "Sale"("cashierId")`,
  `CREATE INDEX IF NOT EXISTS "Sale_tenantId_idx" ON "Sale"("tenantId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Return_returnNo_key" ON "Return"("returnNo")`,
  `CREATE INDEX IF NOT EXISTS "Return_saleId_idx" ON "Return"("saleId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "BackupRecord_filename_key" ON "BackupRecord"("filename")`,
  `CREATE INDEX IF NOT EXISTS "LoyaltyEvent_customerId_idx" ON "LoyaltyEvent"("customerId")`,
  `CREATE INDEX IF NOT EXISTS "LoyaltyEvent_createdAt_idx" ON "LoyaltyEvent"("createdAt")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyEvent_saleId_type_key" ON "LoyaltyEvent"("saleId", "type")`,
];

// ──────────────────────────────────────────────
// Database singleton
// ──────────────────────────────────────────────

let _db = null;
let _bootstrapped = false;

function getDbPath() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.startsWith('file:')) return dbUrl.slice(5);
  const cwd = process.cwd();
  const local = path.join(cwd, 'data', 'custom.db');
  if (fs.existsSync(local)) return local;
  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
  return path.join(localAppData, 'com.library.supermarket', 'custom.db');
}

function closeDb() {
  if (_db) {
    try { _db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) { console.warn('[DB] WAL checkpoint warning:', e && e.message); }
    try { _db.close(); } catch (e) { console.warn('[DB] DB close warning:', e && e.message); }
    _db = null;
    _bootstrapped = false;
  }
}

function openDb() {
  if (_db) return _db;
  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  return _db;
}

function ensureBootstrap() {
  if (_bootstrapped) return;
  const db = openDb();

  const versionRow = db.prepare('PRAGMA user_version').get();
  const version = versionRow ? versionRow.user_version : 0;

  if (version <= 0) {
    for (const stmt of BASELINE_DDL) {
      try { db.prepare(stmt).run(); } catch (e) { /* idempotent */ }
    }
    db.pragma('user_version = 1');
  }

  // Idempotent migration v1 -> v2: Remove expiry concept from batches
  // Recover batches previously marked 'EXPIRED':
  // If quantity > 0, set status = 'ACTIVE'
  // If quantity <= 0, set status = 'DEPLETED'
  if (version < 2) {
    try {
      const activeRes = db.prepare("UPDATE Batch SET status='ACTIVE', updatedAt=? WHERE status='EXPIRED' AND quantity > 0").run(now());
      const depletedRes = db.prepare("UPDATE Batch SET status='DEPLETED', updatedAt=? WHERE status='EXPIRED' AND quantity <= 0").run(now());
      const totalRecovered = (activeRes ? activeRes.changes : 0) + (depletedRes ? depletedRes.changes : 0);
      if (totalRecovered > 0) {
        db.prepare(`INSERT INTO AuditLog (id, tenantId, userId, username, action, entity, metadata, result)
          VALUES (?,?,?,?,?,?,?,?)`).run(
          newId(), 'default', null, 'system',
          'MIGRATE_EXPIRY_REMOVAL', 'Batch',
          JSON.stringify({ recoveredActive: activeRes.changes, recoveredDepleted: depletedRes.changes, total: totalRecovered }),
          'SUCCESS'
        );
      }
      db.pragma('user_version = 2');
    } catch (e) {
      console.warn("[DB] Migration to v2 warning:", e && e.message);
    }
  }

  // Idempotent migration v2 -> v3: Clean any empty string barcodes to NULL
  // Ensures Product_tenantId_barcode_key UNIQUE index does not fail on products without barcode
  if (version < 3) {
    try {
      db.prepare("UPDATE Product SET barcode = NULL WHERE barcode IS NOT NULL AND (barcode = '' OR TRIM(barcode) = '')").run();
      db.pragma('user_version = 3');
    } catch (e) {
      console.warn("[DB] Migration to v3 warning:", e && e.message);
    }
  }

  _bootstrapped = true;
}

// ──────────────────────────────────────────────
// Utility helpers
// ──────────────────────────────────────────────

function newId() {
  return randomBytes(12).toString('hex');
}

function now() {
  return new Date().toISOString();
}

function bool(v) {
  if (v === null || v === undefined) return null;
  return v ? 1 : 0;
}

function fromBool(v) {
  return v === 1 || v === true;
}

function parseBoolField(row, ...fields) {
  if (!row) return row;
  const r = Object.assign({}, row);
  for (const f of fields) {
    if (f in r) r[f] = fromBool(r[f]);
  }
  return r;
}

// ──────────────────────────────────────────────
// Generic query helpers
// ──────────────────────────────────────────────

function one(stmt, params) {
  ensureBootstrap();
  return openDb().prepare(stmt).get(params);
}

function all(stmt, params) {
  ensureBootstrap();
  return openDb().prepare(stmt).all(params);
}

function run(stmt, params) {
  ensureBootstrap();
  return openDb().prepare(stmt).run(params);
}

function transaction(fn) {
  ensureBootstrap();
  const db = openDb();
  return db.transaction(() => fn(db))();
}

// ──────────────────────────────────────────────
// Counter (document numbering)
// ──────────────────────────────────────────────

function nextDocNo(db, tenantId, key, prefix) {
  const tid = tenantId || 'default';
  db.prepare('INSERT OR IGNORE INTO Counter (tenantId, key, value) VALUES (?,?,0)').run(tid, key);
  db.prepare('UPDATE Counter SET value = value + 1 WHERE tenantId=? AND key=?').run(tid, key);
  const row = db.prepare('SELECT value FROM Counter WHERE tenantId=? AND key=?').get(tid, key);
  const next = row ? row.value : 1;
  const year = new Date().getFullYear();
  const tag = tid === 'default' ? 'STORE' : tid.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'STORE';
  return `${prefix}-${year}-${tag}-${String(next).padStart(6, '0')}`;
}

// ──────────────────────────────────────────────
// Auth helpers (scrypt — same as original)
// ──────────────────────────────────────────────

const { scryptSync, timingSafeEqual } = require('crypto');

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  try {
    const [scheme, salt, hash] = stored.split('$');
    if (scheme !== 'scrypt' || !salt || !hash) return false;
    const candidate = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────
// Audit log
// ──────────────────────────────────────────────

function audit(ctx, action, opts) {
  try {
    ensureBootstrap();
    const db = openDb();
    const tenantId = (opts && opts.tenantId) || 'default';
    db.prepare(`INSERT INTO AuditLog (id, tenantId, userId, username, action, entity, entityId, metadata, result)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(
      newId(), tenantId, (ctx && ctx.userId) || null, (ctx && ctx.username) || 'system',
      action, (opts && opts.entity) || '', (opts && opts.entityId) || null,
      JSON.stringify((opts && opts.metadata) || {}), (opts && opts.result) || 'SUCCESS'
    );
  } catch (e) {
    console.error('[LIBRARY_STORE] audit write failed', e.message);
  }
}

// ──────────────────────────────────────────────
// Stock helpers
// ──────────────────────────────────────────────

function stockAvailableMap(db, productIds, tenantId) {
  if (!productIds || productIds.length === 0) return {};
  const ph = productIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT productId, SUM(quantity) as qty FROM Batch
     WHERE tenantId=? AND productId IN (${ph}) AND status='ACTIVE' AND quantity>0
     GROUP BY productId`
  ).all(tenantId, ...productIds);
  const map = {};
  for (const r of rows) map[r.productId] = r.qty || 0;
  return map;
}

function stockTotalMap(db, productIds, tenantId) {
  if (!productIds || productIds.length === 0) return {};
  const ph = productIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT productId, SUM(quantity) as qty FROM Batch
     WHERE tenantId=? AND productId IN (${ph})
     GROUP BY productId`
  ).all(tenantId, ...productIds);
  const map = {};
  for (const r of rows) map[r.productId] = r.qty || 0;
  return map;
}

// ──────────────────────────────────────────────
// System bootstrap
// ──────────────────────────────────────────────

const DEFAULT_PERMISSIONS_OWNER = [
  'DASHBOARD_VIEW','PRODUCT_VIEW','PRODUCT_CREATE','PRODUCT_EDIT','PRODUCT_DELETE',
  'CATEGORY_VIEW','CATEGORY_MANAGE','INVENTORY_VIEW','INVENTORY_ADJUST','STOCKTAKE_CREATE',
  'SALES_VIEW','SALES_CREATE','SALES_CANCEL','SALES_RETURN','PURCHASE_VIEW','PURCHASE_CREATE',
  'PURCHASE_RECEIVE','SUPPLIER_VIEW','SUPPLIER_MANAGE','CUSTOMER_VIEW','CUSTOMER_MANAGE',
  'REPORT_VIEW','REPORT_EXPORT','USER_VIEW','USER_MANAGE','ROLE_VIEW','ROLE_MANAGE',
  'SETTINGS_VIEW','SETTINGS_MANAGE','HARDWARE_MANAGE','BACKUP_MANAGE','LICENSE_VIEW',
  'LICENSE_DEACTIVATE','AUDIT_VIEW'
];

const DEFAULT_ROLES = [
  { id: 'role_owner', tenantId: 'default', key: 'owner', nameAr: 'المالك', nameEn: 'Owner',
    description: 'صلاحيات كاملة', permissions: JSON.stringify(DEFAULT_PERMISSIONS_OWNER), isSystem: 1 },
  { id: 'role_cashier', tenantId: 'default', key: 'cashier', nameAr: 'كاشير', nameEn: 'Cashier',
    description: 'عمليات نقطة البيع',
    permissions: JSON.stringify(['DASHBOARD_VIEW','PRODUCT_VIEW','SALES_VIEW','SALES_CREATE','SALES_RETURN','CUSTOMER_VIEW']),
    isSystem: 1 },
];

const DEFAULT_BRANDING = {
  primary: '#00c8e0',
  primaryColor: '#00c8e0',
  secondary: '#14b8a6',
  accent: '#22d3ee',
  appName: 'Library Store',
  logoDataUrl: null,
  logoUrl: null,
  defaultTheme: 'dark',
};

function normalizeBranding(raw) {
  const b = typeof raw === 'object' && raw !== null ? raw : safeJson(raw, DEFAULT_BRANDING);
  const primary = b.primary || b.primaryColor || DEFAULT_BRANDING.primary;
  const secondary = b.secondary || DEFAULT_BRANDING.secondary;
  const accent = b.accent || DEFAULT_BRANDING.accent;
  const logoDataUrl = b.logoDataUrl || b.logoUrl || null;
  const appName = b.appName || DEFAULT_BRANDING.appName;
  const defaultTheme = b.defaultTheme || DEFAULT_BRANDING.defaultTheme;
  return {
    ...DEFAULT_BRANDING,
    ...b,
    primary,
    primaryColor: primary,
    secondary,
    accent,
    logoDataUrl,
    logoUrl: logoDataUrl,
    appName,
    defaultTheme,
  };
}
const DEFAULT_BUSINESS = { businessName: 'Library Store', displayName: 'Library Store', address: '', phone: '', taxId: '', currency: 'EGP', currencySymbol: 'ج.م' };
const DEFAULT_HARDWARE = { receiptPrinter: null, cashDrawer: false, barcodeScanner: true };
const DEFAULT_POS = { currency: 'EGP', currencySymbol: 'ج.م', units: ['piece','kg','box','liter','pack','dozen'], receiptFooter: 'شكراً لزيارتكم', cashRounding: false, allowBelowMinPrice: false };
const DEFAULT_LOCALIZATION = { language: 'ar', direction: 'rtl', timezone: 'Africa/Cairo', numberFormat: 'latn' };
const DEFAULT_BACKUP = { autoBackup: false, backupInterval: 'daily', keepCount: 7 };
const DEFAULT_SYSTEM = { theme: 'dark', requireLoginOnLaunch: true };

function ensureSystemData() {
  // Enforce deprecated system roles purge
  try {
    const _db = openDb();
    _db.prepare("UPDATE User SET roleKey='cashier' WHERE roleKey IN ('manager', 'inventory_manager', 'accountant', 'viewer')").run();
    _db.prepare("DELETE FROM Role WHERE key IN ('manager', 'inventory_manager', 'accountant', 'viewer')").run();
  } catch (_e) {}
  const db = openDb();
  // Roles
  const roleCount = db.prepare('SELECT COUNT(*) as c FROM Role').get().c;
  if (roleCount === 0) {
    for (const r of DEFAULT_ROLES) {
      try {
        db.prepare(`INSERT OR IGNORE INTO Role (id, tenantId, key, nameAr, nameEn, description, permissions, isSystem)
          VALUES (?,?,?,?,?,?,?,?)`).run(r.id, r.tenantId, r.key, r.nameAr, r.nameEn, r.description, r.permissions, r.isSystem);
      } catch (e) { console.warn("[DB] Seed warning:", e && e.message); }
    }
  }
  // Ensure the owner role always has ALL default permissions (including LICENSE_VIEW)
  try {
    const ownerRole = db.prepare("SELECT id, permissions FROM Role WHERE key='owner'").get();
    if (ownerRole) {
      let currentPerms = [];
      try { currentPerms = JSON.parse(ownerRole.permissions); } catch (e) { currentPerms = []; }
      const missing = DEFAULT_PERMISSIONS_OWNER.filter(p => !currentPerms.includes(p));
      if (missing.length > 0) {
        const mergedPerms = Array.from(new Set([...currentPerms, ...DEFAULT_PERMISSIONS_OWNER]));
        db.prepare("UPDATE Role SET permissions=?, updatedAt=? WHERE key='owner'").run(JSON.stringify(mergedPerms), now());
      }
    }
  } catch (e) { console.warn("[DB] Owner role permissions sync warning:", e && e.message); }
  // Settings
  const settingsRow = db.prepare('SELECT id FROM AppSettings WHERE id=?').get('default');
  if (!settingsRow) {
    try {
      db.prepare(`INSERT INTO AppSettings (id, business, branding, hardware, pos, localization, backup, system, updatedAt)
        VALUES (?,?,?,?,?,?,?,?,?)`).run(
        'default',
        JSON.stringify(DEFAULT_BUSINESS), JSON.stringify(DEFAULT_BRANDING),
        JSON.stringify(DEFAULT_HARDWARE), JSON.stringify(DEFAULT_POS),
        JSON.stringify(DEFAULT_LOCALIZATION), JSON.stringify(DEFAULT_BACKUP),
        JSON.stringify(DEFAULT_SYSTEM), now()
      );
    } catch (e) { console.warn("[DB] Seed warning:", e && e.message); }
  }
  // Admin user
  const userCount = db.prepare("SELECT COUNT(*) as c FROM User WHERE tenantId='default'").get().c;
  if (userCount === 0) {
    try {
      db.prepare(`INSERT INTO User (id, tenantId, username, passwordHash, displayName, roleKey, active, updatedAt)
        VALUES (?,?,?,?,?,?,?,?)`).run(
        'cmtnfg8i7000au7k0gvfkewwu', 'default', 'admin',
        hashPassword('Admin@1234'), 'مدير النظام', 'owner', 1, now()
      );
    } catch (e) { console.warn("[DB] Seed warning:", e && e.message); }
  }
}

// ──────────────────────────────────────────────
// Settings helpers
// ──────────────────────────────────────────────

function safeJson(str, fallback) {
  try { return JSON.parse(str) || fallback; } catch { return fallback; }
}


function syncThemeFile(settings) {
  try {
    let business = settings && settings.business ? settings.business : null;
    let branding = settings && settings.branding ? settings.branding : null;
    if (!business || !branding) {
      const db = openDb();
      const row = db.prepare('SELECT business, branding FROM AppSettings WHERE id=?').get('default');
      business = safeJson(row && row.business, DEFAULT_BUSINESS);
      branding = normalizeBranding(row && row.branding);
    }
    const themeData = {
      theme: branding.defaultTheme === 'light' ? 'light' : 'dark',
      primary: branding.primary || branding.primaryColor || '#00c8e0',
      appName: branding.appName || 'Library Store',
      displayName: business.displayName || business.businessName || 'Library Store',
      businessName: business.businessName || '',
      updatedAt: new Date().toISOString()
    };
    const candidates = [
      path.join(__dirname, '..', 'data'),
      path.join(__dirname, 'data'),
      path.join(process.cwd(), 'data'),
    ];
    if (process.env.ELECTRON_RESOURCES_PATH) {
      candidates.unshift(path.join(process.env.ELECTRON_RESOURCES_PATH, '..', 'data'));
    }
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      candidates.push(path.join(localAppData, 'com.library.supermarket'));
    }
    for (const d of candidates) {
      try {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
        fs.writeFileSync(path.join(d, 'theme.json'), JSON.stringify(themeData, null, 2), 'utf8');
      } catch (_) {}
    }
    return themeData;
  } catch (err) {
    console.warn('[THEME] Sync theme error:', err && err.message);
    return null;
  }
}

function getSettings(tenantId) {
  ensureBootstrap();
  ensureSystemData();
  const tid = tenantId || 'default';
  let row = one('SELECT * FROM AppSettings WHERE id=?', tid);
  if (!row && tid !== 'default') row = one('SELECT * FROM AppSettings WHERE id=?', 'default');
  return {
    business: safeJson(row && row.business, DEFAULT_BUSINESS),
    branding: normalizeBranding(row && row.branding),
    hardware: safeJson(row && row.hardware, DEFAULT_HARDWARE),
    pos: safeJson(row && row.pos, DEFAULT_POS),
    localization: safeJson(row && row.localization, DEFAULT_LOCALIZATION),
    backup: safeJson(row && row.backup, DEFAULT_BACKUP),
    system: safeJson(row && row.system, DEFAULT_SYSTEM),
  };
}

// ──────────────────────────────────────────────
// Session management
// ──────────────────────────────────────────────

const SESSION_TTL_HOURS = 12;
const SESSION_COOKIE = 'qx_session';

function createSession(userId) {
  const token = randomBytes(32).toString('hex') + randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000).toISOString();
  ensureBootstrap();
  openDb().prepare('INSERT INTO Session (id, userId, expiresAt) VALUES (?,?,?)').run(token, userId, expiresAt);
  return { token, expiresAt: new Date(expiresAt) };
}

function getSessionUser(token) {
  if (!token) return null;
  ensureBootstrap();
  const db = openDb();
  const session = db.prepare('SELECT * FROM Session WHERE id=?').get(token);
  if (!session) return null;
  if (new Date(session.expiresAt) < new Date()) {
    try { db.prepare("DELETE FROM Session WHERE id=?").run(token); } catch (e) { console.warn("[DB] Session delete warning:", e && e.message); }
    return null;
  }
  const user = db.prepare('SELECT u.*, r.permissions, r.nameAr as roleNameAr, r.nameEn as roleNameEn FROM User u JOIN Role r ON u.roleKey=r.key WHERE u.id=?').get(session.userId);
  if (!user || !fromBool(user.active)) return null;
  let permissions = [];
  try { permissions = JSON.parse(user.permissions); } catch (e) { permissions = []; }
  const isOwner = user.roleKey && user.roleKey.toLowerCase() === 'owner';
  let effectivePermissions = permissions.length > 0 ? permissions : (isOwner ? DEFAULT_PERMISSIONS_OWNER : []);
  if (isOwner) {
    effectivePermissions = Array.from(new Set([...effectivePermissions, ...DEFAULT_PERMISSIONS_OWNER]));
  }
  return {
    id: user.id, username: user.username, displayName: user.displayName,
    roleKey: user.roleKey, roleNameAr: user.roleNameAr, roleNameEn: user.roleNameEn,
    permissions: effectivePermissions,
  };
}

function destroySession(token) {
  try { openDb().prepare("DELETE FROM Session WHERE id=?").run(token); } catch (e) { console.warn("[DB] Session destroy warning:", e && e.message); }
}

module.exports = {
  openDb, closeDb, ensureBootstrap, ensureSystemData, getSettings, getDbPath, syncThemeFile,
  newId, now, bool, fromBool, parseBoolField, safeJson,
  one, all, run, transaction,
  nextDocNo, hashPassword, verifyPassword, audit,
  stockAvailableMap, stockTotalMap,
  createSession, getSessionUser, destroySession,
  SESSION_COOKIE,
  DEFAULT_PERMISSIONS_OWNER, DEFAULT_BRANDING, DEFAULT_BUSINESS,
  DEFAULT_POS, DEFAULT_LOCALIZATION, DEFAULT_BACKUP, DEFAULT_SYSTEM, DEFAULT_HARDWARE,
};
