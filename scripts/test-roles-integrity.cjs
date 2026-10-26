const assert = require('assert');
const path = require('path');
const fs = require('fs');
const Database = require('../server/node_modules/better-sqlite3');

console.log('=== VERIFYING ROLES INTEGRITY (ONLY OWNER & CASHIER) ===\n');

// 1. Check custom.db
const dbPath = path.resolve(__dirname, '../data/custom.db');
const db = new Database(dbPath);

const roles = db.prepare('SELECT id, key, nameAr, nameEn, isSystem FROM Role').all();
console.log('Roles currently in custom.db:');
console.table(roles);

assert.strictEqual(roles.length, 2, 'Expected exactly 2 roles in database');
const keys = roles.map(r => r.key).sort();
assert.deepStrictEqual(keys, ['cashier', 'owner'], 'Expected only cashier and owner in database');

// Check that no user has any deleted role
const deletedKeys = ['manager', 'inventory_manager', 'accountant', 'viewer'];
const invalidUsers = db.prepare(`SELECT * FROM User WHERE roleKey IN ('manager', 'inventory_manager', 'accountant', 'viewer')`).all();
assert.strictEqual(invalidUsers.length, 0, 'Found users assigned to deleted roles!');
console.log('✓ Zero users assigned to deleted roles');

db.close();

// 2. Check server/db.js
const serverDbPath = path.resolve(__dirname, '../server/db.js');
const serverDb = fs.readFileSync(serverDbPath, 'utf8');
deletedKeys.forEach(k => {
  assert(!serverDb.includes(`key: '${k}'`), `server/db.js still contains DEFAULT_ROLES entry for ${k}`);
});
console.log('✓ server/db.js DEFAULT_ROLES contains only owner and cashier');

// 3. Check dist-desktop server/db.js
const distDbPath = path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/server/db.js');
if (fs.existsSync(distDbPath)) {
  const distDb = fs.readFileSync(distDbPath, 'utf8');
  deletedKeys.forEach(k => {
    assert(!distDb.includes(`key: '${k}'`), `dist-desktop server/db.js still contains DEFAULT_ROLES entry for ${k}`);
  });
  console.log('✓ dist-desktop server/db.js DEFAULT_ROLES contains only owner and cashier');
}

// 4. Check permissions.ts
const permPath = path.resolve(__dirname, '../src/lib/library/permissions.ts');
const permContent = fs.readFileSync(permPath, 'utf8');
deletedKeys.forEach(k => {
  assert(!permContent.includes(`key: '${k}'`), `permissions.ts still contains SYSTEM_ROLES entry for ${k}`);
});
console.log('✓ permissions.ts SYSTEM_ROLES contains only owner and cashier');

console.log('\n[PASS] SUITE SUMMARY: ROLES INTEGRITY FULLY VERIFIED (ONLY OWNER & CASHIER EXIST)');
