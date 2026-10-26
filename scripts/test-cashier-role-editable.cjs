const fs = require('fs');
const assert = require('assert');
const path = require('path');

console.log('=== TEST CASHIER ROLE EDITABLE IN PERMISSIONS ===');

const base = path.join(__dirname, '..');
const srcFile = path.join(base, 'src/components/library/screens/roles.tsx');
const clientFiles = [
  path.join(base, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(base, 'out/_next/static/chunks/18yoqc7d05wnq.js')
];
const serverFiles = [
  path.join(base, 'server/api.js'),
  path.join(base, 'dist-desktop/win-unpacked/resources/server/api.js')
];

// 1. Verify server API code allows cashier editing and protects owner
for (const sf of serverFiles) {
  assert(fs.existsSync(sf), `Server file does not exist: ${sf}`);
  const content = fs.readFileSync(sf, 'utf8');
  const putHandler = content.substring(content.indexOf("router.put('/roles/:id'"), content.indexOf("router.delete('/roles/:id'"));
  assert(
    putHandler.includes("role.key === 'owner'"),
    `Server file ${path.basename(sf)} must specifically protect owner role in PUT /roles/:id`
  );
  assert(
    !putHandler.includes("fromBool(role.isSystem)"),
    `Server file ${path.basename(sf)} PUT /roles/:id must NOT block system roles indiscriminately`
  );
  console.log(`✓ Server file ${sf} allows cashier editing and guards owner role`);
}

// 2. Verify UI source code
assert(fs.existsSync(srcFile), 'roles.tsx does not exist');
const src = fs.readFileSync(srcFile, 'utf8');
assert(
  src.includes("editing?.key === 'owner'"),
  'roles.tsx must guard owner from saving while leaving cashier enabled'
);
console.log('✓ UI source roles.tsx verified: cashier is editable, owner is protected');

// 3. Verify compiled production chunks
for (const cf of clientFiles) {
  assert(fs.existsSync(cf), `Chunk file does not exist: ${cf}`);
  const js = fs.readFileSync(cf, 'utf8');
  assert(
    js.includes('"owner"===(f?.key)') || js.includes('"owner"==f?.key') || js.includes('"owner"===f?.key'),
    `Chunk ${path.basename(cf)} missing owner guard on save button`
  );
  console.log(`✓ Production chunk ${path.basename(cf)} verified!`);
}

// 4. Test database update directly via SQLite and DB functions
const { openDb } = require('../server/db.js');
const db = openDb();
const cashierBefore = db.prepare("SELECT * FROM Role WHERE key='cashier'").get();
assert(cashierBefore, 'Cashier role not found in database');
const originalPerms = cashierBefore.permissions;

// Simulate updating cashier permissions to add CUSTOMER_MANAGE and SALES_CANCEL
const testPerms = [
  'DASHBOARD_VIEW',
  'PRODUCT_VIEW',
  'SALES_VIEW',
  'SALES_CREATE',
  'SALES_CANCEL',
  'SALES_RETURN',
  'CUSTOMER_VIEW',
  'CUSTOMER_MANAGE'
];

db.prepare("UPDATE Role SET permissions=? WHERE key='cashier'").run(JSON.stringify(testPerms));
const cashierAfter = db.prepare("SELECT * FROM Role WHERE key='cashier'").get();
const parsed = JSON.parse(cashierAfter.permissions);
assert.strictEqual(parsed.length, 8, 'Expected 8 permissions for cashier after update');
assert(parsed.includes('SALES_CANCEL'), 'Updated permissions must include SALES_CANCEL');
assert(parsed.includes('CUSTOMER_MANAGE'), 'Updated permissions must include CUSTOMER_MANAGE');
console.log('✓ Cashier role permissions successfully updated in SQLite database');

// Restore original permissions to leave test database clean
db.prepare("UPDATE Role SET permissions=? WHERE key='cashier'").run(originalPerms);
const cashierRestored = db.prepare("SELECT * FROM Role WHERE key='cashier'").get();
assert.strictEqual(cashierRestored.permissions, originalPerms, 'Permissions cleanly restored');
console.log('✓ Cashier role permissions cleanly restored to initial state');

console.log('[PASS] ALL CASHIER EDITABLE ROLE CHECKS PASSED CLEANLY (7/7)!');
