const fs = require('fs');
const path = require('path');

// 1. Patch server/db.js
const dbPath = path.resolve(__dirname, '../server/db.js');
let dbCode = fs.readFileSync(dbPath, 'utf8').replace(/\r\n/g, '\n');

// 1a. Update DEFAULT_SYSTEM to include requireLoginOnLaunch: true
dbCode = dbCode.replace(
  "const DEFAULT_SYSTEM = { theme: 'dark' };",
  "const DEFAULT_SYSTEM = { theme: 'dark', requireLoginOnLaunch: true };"
);

// 1b. Fix getSessionUser permission escalation fallback (only owner gets DEFAULT_PERMISSIONS_OWNER on empty permissions)
const oldGetSessionUser = `  return {
    id: user.id, username: user.username, displayName: user.displayName,
    roleKey: user.roleKey, roleNameAr: user.roleNameAr, roleNameEn: user.roleNameEn,
    permissions: permissions.length > 0 ? permissions : DEFAULT_PERMISSIONS_OWNER,
  };`;

const newGetSessionUser = `  const isOwner = user.roleKey && user.roleKey.toLowerCase() === 'owner';
  return {
    id: user.id, username: user.username, displayName: user.displayName,
    roleKey: user.roleKey, roleNameAr: user.roleNameAr, roleNameEn: user.roleNameEn,
    permissions: permissions.length > 0 ? permissions : (isOwner ? DEFAULT_PERMISSIONS_OWNER : []),
  };`;

if (dbCode.includes(oldGetSessionUser)) {
  dbCode = dbCode.replace(oldGetSessionUser, newGetSessionUser);
} else {
  console.warn('oldGetSessionUser pattern not matched in server/db.js');
}

fs.writeFileSync(dbPath, dbCode.replace(/\n/g, '\r\n'), 'utf8');
console.log('✓ server/db.js updated');

// 2. Patch server/api.js login route permission escalation fallback
const apiPath = path.resolve(__dirname, '../server/api.js');
let apiCode = fs.readFileSync(apiPath, 'utf8').replace(/\r\n/g, '\n');

const oldLoginPerm = `    if (!permissions.length) permissions = DEFAULT_PERMISSIONS_OWNER;`;
const newLoginPerm = `    const isOwner = user.roleKey && user.roleKey.toLowerCase() === 'owner';
    if (!permissions.length && isOwner) permissions = DEFAULT_PERMISSIONS_OWNER;`;

if (apiCode.includes(oldLoginPerm)) {
  apiCode = apiCode.replace(oldLoginPerm, newLoginPerm);
  fs.writeFileSync(apiPath, apiCode.replace(/\n/g, '\r\n'), 'utf8');
  console.log('✓ server/api.js updated');
} else {
  console.warn('oldLoginPerm pattern not matched in server/api.js');
}

// 3. Patch server/index.js to purge prior sessions on boot
const indexPath = path.resolve(__dirname, '../server/index.js');
let indexCode = fs.readFileSync(indexPath, 'utf8').replace(/\r\n/g, '\n');

const purgeBlock = `// ─── Startup Session Invalidation ─────────────────────────────────────────────
try {
  const { getSettings, openDb } = require('./db');
  const settings = getSettings('default');
  if (settings.system?.requireLoginOnLaunch !== false) {
    const db = openDb();
    const res = db.prepare('DELETE FROM Session').run();
    console.log(\`[BOOT] Invalidate prior sessions: purged \${res.changes} session(s) from database\`);
  }
} catch (e) {
  console.warn('[BOOT] Error clearing prior sessions on boot:', e && e.message);
}
`;

if (!indexCode.includes('Startup Session Invalidation')) {
  indexCode = indexCode.replace(
    "const server = http.createServer(app);",
    purgeBlock + "\nconst server = http.createServer(app);"
  );
  fs.writeFileSync(indexPath, indexCode.replace(/\n/g, '\r\n'), 'utf8');
  console.log('✓ server/index.js updated');
}

// 4. Synchronize all to dist-desktop/win-unpacked/resources/server/
const destDir = path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/server');
if (fs.existsSync(destDir)) {
  fs.copyFileSync(dbPath, path.join(destDir, 'db.js'));
  fs.copyFileSync(apiPath, path.join(destDir, 'api.js'));
  fs.copyFileSync(indexPath, path.join(destDir, 'index.js'));
  console.log('✓ Synchronized to dist-desktop/win-unpacked/resources/server/');
}
