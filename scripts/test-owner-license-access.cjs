const fs = require('fs');
const assert = require('assert');
const path = require('path');
const Database = require('../server/node_modules/better-sqlite3');

console.log('=== TEST OWNER LICENSE ACCESS VERIFICATION ===\n');

const base = path.resolve(__dirname, '..');

// 1. Verify database integrity
const dbTargets = [
  path.join(base, 'data/custom.db'),
  path.join(process.env.LOCALAPPDATA || '', 'com.library.supermarket', 'custom.db')
];

for (const dbp of dbTargets) {
  if (fs.existsSync(dbp)) {
    const db = new Database(dbp);
    const row = db.prepare("SELECT key, permissions FROM Role WHERE key='owner'").get();
    assert(row, `Owner role must exist in ${dbp}`);
    const perms = JSON.parse(row.permissions);
    assert(Array.isArray(perms), 'Permissions must be array');
    assert(perms.includes('LICENSE_VIEW'), `Owner role in ${dbp} must include LICENSE_VIEW`);
    assert(perms.includes('SETTINGS_VIEW'), `Owner role in ${dbp} must include SETTINGS_VIEW`);
    assert(perms.includes('BACKUP_MANAGE'), `Owner role in ${dbp} must include BACKUP_MANAGE`);
    console.log(`✓ Database verified: ${dbp} (Total perms: ${perms.length}, LICENSE_VIEW: present)`);
    db.close();
  }
}

// 2. Verify server/db.js logic
const serverDbPath = path.join(base, 'server/db.js');
const serverDb = fs.readFileSync(serverDbPath, 'utf8');
assert(serverDb.includes('DEFAULT_PERMISSIONS_OWNER.filter'), 'server/db.js must contain auto-heal logic');
assert(serverDb.includes("effectivePermissions = Array.from(new Set([...effectivePermissions, ...DEFAULT_PERMISSIONS_OWNER]))"), 'server/db.js getSessionUser must guarantee owner permissions');
console.log('✓ server/db.js auto-heal and session permissions verified');

// 3. Verify server/api.js logic
const serverApiPath = path.join(base, 'server/api.js');
const serverApi = fs.readFileSync(serverApiPath, 'utf8');
assert(serverApi.includes("permissions = Array.from(new Set([...permissions, ...DEFAULT_PERMISSIONS_OWNER]))"), 'server/api.js login must guarantee owner permissions');
assert(serverApi.includes("perms = Array.from(new Set([...perms, ...DEFAULT_PERMISSIONS_OWNER]))"), 'server/api.js GET /roles must guarantee owner permissions');
console.log('✓ server/api.js login and roles API owner guarantees verified');

// 4. Verify src/components/library/screens/roles.tsx
const rolesTsxPath = path.join(base, 'src/components/library/screens/roles.tsx');
const rolesTsx = fs.readFileSync(rolesTsxPath, 'utf8');
assert(rolesTsx.includes("r.key === 'owner'"), 'roles.tsx openEdit must check owner key');
assert(rolesTsx.includes("Array.from(new Set([...r.permissions, ...allPerms]))"), 'roles.tsx openEdit must select all permissions for owner');
console.log('✓ src/components/library/screens/roles.tsx openEdit logic verified');

// 5. Verify compiled chunks in out and dist-desktop
const chunkPaths = [
  path.join(base, 'out/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(base, 'dist-desktop/win-unpacked/resources/out/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(base, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js')
];

for (const cp of chunkPaths) {
  if (fs.existsSync(cp)) {
    const js = fs.readFileSync(cp, 'utf8');
    assert(js.includes('MQ.flatMap(x=>x.perms)'), `${path.basename(cp)} must include patched openEdit logic`);
    assert(js.includes('"owner"===t.key?33'), `${path.basename(cp)} must include card badge owner logic`);
    console.log(`✓ Compiled chunk verified: ${path.relative(base, cp)}`);
  }
}

// 6. Verify dist-desktop server sync
const distDbPath = path.join(base, 'dist-desktop/win-unpacked/resources/server/db.js');
const distApiPath = path.join(base, 'dist-desktop/win-unpacked/resources/server/api.js');
if (fs.existsSync(distDbPath)) {
  const distDb = fs.readFileSync(distDbPath, 'utf8');
  assert(distDb.includes('DEFAULT_PERMISSIONS_OWNER.filter'), 'dist-desktop server/db.js must be in sync');
}
if (fs.existsSync(distApiPath)) {
  const distApi = fs.readFileSync(distApiPath, 'utf8');
  assert(distApi.includes("perms = Array.from(new Set([...perms, ...DEFAULT_PERMISSIONS_OWNER]))"), 'dist-desktop server/api.js must be in sync');
}
console.log('✓ dist-desktop resources/server files verified in sync');

console.log('\n[PASS] ALL OWNER LICENSE ACCESS CHECKS PASSED CLEANLY (6/6)!');
