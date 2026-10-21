/**
 * Forensic script to update server/db.js, src/lib/library/db-schema.ts,
 * src/lib/library/types.ts, and src/lib/library/config.ts.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// 1. Update server/db.js
const dbJsPath = path.join(root, 'server', 'db.js');
let dbJs = fs.readFileSync(dbJsPath, 'utf8');

const oldBootstrap = `  if (version <= 0) {
    for (const stmt of BASELINE_DDL) {
      try { db.prepare(stmt).run(); } catch (e) { /* idempotent */ }
    }
    db.pragma(\`user_version = \${SCHEMA_VERSION}\`);
  }`;

const newBootstrap = `  if (version <= 0) {
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
        db.prepare(\`INSERT INTO AuditLog (id, tenantId, userId, username, action, entity, metadata, result)
          VALUES (?,?,?,?,?,?,?,?)\`).run(
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
  }`;

const oldStockPattern = /function stockAvailableMap\(db, productIds, tenantId\) \{[\s\S]*?return map;\s*\}/;
const newStock = `function stockAvailableMap(db, productIds, tenantId) {
  if (!productIds || productIds.length === 0) return {};
  const ph = productIds.map(() => '?').join(',');
  const rows = db.prepare(
    \`SELECT productId, SUM(quantity) as qty FROM Batch
     WHERE tenantId=? AND productId IN (\${ph}) AND status='ACTIVE' AND quantity>0
     GROUP BY productId\`
  ).all(tenantId, ...productIds);
  const map = {};
  for (const r of rows) map[r.productId] = r.qty || 0;
  return map;
}`;

// Normalize line endings for replacement
dbJs = dbJs.replace(/\r\n/g, '\n');
if (!dbJs.includes(oldBootstrap.replace(/\r\n/g, '\n'))) {
  console.error('[Step 1] Error: oldBootstrap not found in server/db.js');
  process.exit(1);
}
dbJs = dbJs.replace(oldBootstrap.replace(/\r\n/g, '\n'), newBootstrap.replace(/\r\n/g, '\n'));

if (!oldStockPattern.test(dbJs)) {
  console.error('[Step 1] Error: stockAvailableMap pattern not found in server/db.js');
  process.exit(1);
}
dbJs = dbJs.replace(oldStockPattern, newStock.replace(/\r\n/g, '\n'));

// Restore CRLF
dbJs = dbJs.replace(/\n/g, '\r\n');
fs.writeFileSync(dbJsPath, dbJs, 'utf8');
console.log('✓ server/db.js updated successfully');

// 2. Update src/lib/library/db-schema.ts
const schemaPath = path.join(root, 'src', 'lib', 'library', 'db-schema.ts');
let schemaTs = fs.readFileSync(schemaPath, 'utf8').replace(/\r\n/g, '\n');

schemaTs = schemaTs.replace('export const SCHEMA_VERSION = 1;', 'export const SCHEMA_VERSION = 2;');
schemaTs = schemaTs.replace(
  'export const MIGRATIONS: Record<number, string[]> = {};',
  `export const MIGRATIONS: Record<number, string[]> = {
  1: [
    "UPDATE \\"Batch\\" SET \\"status\\" = 'ACTIVE', \\"updatedAt\\" = CURRENT_TIMESTAMP WHERE \\"status\\" = 'EXPIRED' AND \\"quantity\\" > 0",
    "UPDATE \\"Batch\\" SET \\"status\\" = 'DEPLETED', \\"updatedAt\\" = CURRENT_TIMESTAMP WHERE \\"status\\" = 'EXPIRED' AND \\"quantity\\" <= 0",
  ],
};`
);
schemaTs = schemaTs.replace(
  '"expiryDate" DATETIME,',
  '"expiryDate" DATETIME, /* DEPRECATED: stationery store has no expiry. Always NULL. */'
);

schemaTs = schemaTs.replace(/\n/g, '\r\n');
fs.writeFileSync(schemaPath, schemaTs, 'utf8');
console.log('✓ src/lib/library/db-schema.ts updated successfully');

// 3. Update src/lib/library/types.ts
const typesPath = path.join(root, 'src', 'lib', 'library', 'types.ts');
let typesTs = fs.readFileSync(typesPath, 'utf8').replace(/\r\n/g, '\n');

// Remove allowSellingExpired and expiryWarningDays from PosConfig
typesTs = typesTs.replace(/\s*allowSellingExpired: boolean\n/, '\n');
typesTs = typesTs.replace(/\s*expiryWarningDays: number\n/, '\n');

// Remove lastExpirySweepAt from SystemConfig
typesTs = typesTs.replace(/\s*lastExpirySweepAt: string \| null\n/, '\n');

// Remove expiredSoon from CartLine
typesTs = typesTs.replace(/\s*expiredSoon: boolean\n/, '\n');

// In ReceiptData, remove expiry from allocations
typesTs = typesTs.replace(
  'allocations: { batchNo: string | null; expiry: string | null; qty: number }[]',
  'allocations: { batchNo: string | null; qty: number }[]'
);

typesTs = typesTs.replace(/\n/g, '\r\n');
fs.writeFileSync(typesPath, typesTs, 'utf8');
console.log('✓ src/lib/library/types.ts updated successfully');

// 4. Update src/lib/library/config.ts
const configPath = path.join(root, 'src', 'lib', 'library', 'config.ts');
let configTs = fs.readFileSync(configPath, 'utf8').replace(/\r\n/g, '\n');

// In DEFAULT_POS
configTs = configTs.replace(/\s*allowSellingExpired: false,\n/, '\n');
configTs = configTs.replace(/\s*expiryWarningDays: 90,\n/, '\n');

// In DEFAULT_SYSTEM
configTs = configTs.replace(/\s*lastExpirySweepAt: null,\n/, '\n');

configTs = configTs.replace(/\n/g, '\r\n');
fs.writeFileSync(configPath, configTs, 'utf8');
console.log('✓ src/lib/library/config.ts updated successfully');
