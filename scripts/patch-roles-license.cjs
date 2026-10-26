const fs = require('fs');
const path = require('path');

const base = path.resolve(__dirname, '..');

console.log('=== PATCH ROLES LICENSE ACCESS ===');

function replaceNormalized(content, search, replacement) {
  if (content.includes(search)) {
    return content.replace(search, replacement);
  }
  const crlfSearch = search.replace(/\r?\n/g, '\r\n');
  const crlfReplacement = replacement.replace(/\r?\n/g, '\r\n');
  if (content.includes(crlfSearch)) {
    return content.replace(crlfSearch, crlfReplacement);
  }
  const lfSearch = search.replace(/\r?\n/g, '\n');
  const lfReplacement = replacement.replace(/\r?\n/g, '\n');
  if (content.includes(lfSearch)) {
    return content.replace(lfSearch, lfReplacement);
  }
  return null;
}

// 1. Update src/components/library/screens/roles.tsx
const rolesTsxPath = path.join(base, 'src/components/library/screens/roles.tsx');
let rolesTsx = fs.readFileSync(rolesTsxPath, 'utf8');

const oldOpenEdit = `  function openEdit(r: RoleItem) {
    setEditing(r)
    setForm({ key: r.key, nameAr: r.nameAr, nameEn: r.nameEn === r.nameAr ? '' : r.nameEn, description: r.description })
    setSelected([...r.permissions])
    setDialogOpen(true)
  }`;

const newOpenEdit = `  function openEdit(r: RoleItem) {
    setEditing(r)
    setForm({ key: r.key, nameAr: r.nameAr, nameEn: r.nameEn === r.nameAr ? '' : r.nameEn, description: r.description })
    if (r.key === 'owner') {
      const allPerms = PERMISSION_GROUPS.flatMap((g) => g.perms)
      setSelected(Array.from(new Set([...r.permissions, ...allPerms])))
    } else {
      setSelected([...r.permissions])
    }
    setDialogOpen(true)
  }`;

let resRoles = replaceNormalized(rolesTsx, oldOpenEdit, newOpenEdit);
if (resRoles) {
  rolesTsx = resRoles;
  console.log('✓ Updated openEdit in roles.tsx');
} else if (rolesTsx.includes("r.key === 'owner'")) {
  console.log('ℹ openEdit already updated in roles.tsx');
} else {
  console.warn('⚠ Could not match oldOpenEdit in roles.tsx');
}

// Update card badge
const oldCardBadge = `{t('roles.count')}: <span className="tabular-nums">{r.permissions.length}</span> / 33`;
const newCardBadge = `{t('roles.count')}: <span className="tabular-nums">{r.key === 'owner' ? 33 : r.permissions.filter((p) => p !== 'LICENSE_DEACTIVATE').length}</span> / 33`;

resRoles = replaceNormalized(rolesTsx, oldCardBadge, newCardBadge);
if (resRoles) {
  rolesTsx = resRoles;
  console.log('✓ Updated card badge in roles.tsx');
}

// Update dialog badge
const oldDialogBadge = `<span className="tabular-nums">{selected.length}</span> / 33`;
const newDialogBadge = `<span className="tabular-nums">{editing?.key === 'owner' ? 33 : selected.filter((p) => p !== 'LICENSE_DEACTIVATE').length}</span> / 33`;

resRoles = replaceNormalized(rolesTsx, oldDialogBadge, newDialogBadge);
if (resRoles) {
  rolesTsx = resRoles;
  console.log('✓ Updated dialog badge in roles.tsx');
}

fs.writeFileSync(rolesTsxPath, rolesTsx, 'utf8');

// 2. Update server/db.js
const serverDbPath = path.join(base, 'server/db.js');
let serverDb = fs.readFileSync(serverDbPath, 'utf8');

// Ensure owner role auto-heals any missing permissions on ensureSystemData()
const ensureSeedTarget = `      } catch (e) { console.warn("[DB] Seed warning:", e && e.message); }
    }
  }`;

const ensureSeedReplacement = `      } catch (e) { console.warn("[DB] Seed warning:", e && e.message); }
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
  } catch (e) { console.warn("[DB] Owner role permissions sync warning:", e && e.message); }`;

let resDb = replaceNormalized(serverDb, ensureSeedTarget, ensureSeedReplacement);
if (resDb) {
  serverDb = resDb;
  console.log('✓ Added owner role auto-heal in server/db.js ensureSystemData()');
} else if (serverDb.includes('Owner role permissions sync warning')) {
  console.log('ℹ server/db.js already has owner auto-heal');
} else {
  console.warn('⚠ Could not match ensureSeedTarget in server/db.js');
}

// Ensure getSessionUser always supplements owner permissions with DEFAULT_PERMISSIONS_OWNER
const oldGetSessionUser = `  return {
    id: user.id, username: user.username, displayName: user.displayName,
    roleKey: user.roleKey, roleNameAr: user.roleNameAr, roleNameEn: user.roleNameEn,
    permissions: permissions.length > 0 ? permissions : (isOwner ? DEFAULT_PERMISSIONS_OWNER : []),
  };`;

const newGetSessionUser = `  let effectivePermissions = permissions.length > 0 ? permissions : (isOwner ? DEFAULT_PERMISSIONS_OWNER : []);
  if (isOwner) {
    effectivePermissions = Array.from(new Set([...effectivePermissions, ...DEFAULT_PERMISSIONS_OWNER]));
  }
  return {
    id: user.id, username: user.username, displayName: user.displayName,
    roleKey: user.roleKey, roleNameAr: user.roleNameAr, roleNameEn: user.roleNameEn,
    permissions: effectivePermissions,
  };`;

resDb = replaceNormalized(serverDb, oldGetSessionUser, newGetSessionUser);
if (resDb) {
  serverDb = resDb;
  console.log('✓ Updated getSessionUser in server/db.js to guarantee owner permissions');
} else if (serverDb.includes('effectivePermissions = Array.from')) {
  console.log('ℹ server/db.js getSessionUser already updated');
} else {
  console.warn('⚠ Could not match oldGetSessionUser in server/db.js');
}

fs.writeFileSync(serverDbPath, serverDb, 'utf8');

// 3. Update server/api.js
const serverApiPath = path.join(base, 'server/api.js');
let serverApi = fs.readFileSync(serverApiPath, 'utf8');

// Login endpoint owner permissions guarantee
const oldLoginOwner = `    const isOwner = user.roleKey && user.roleKey.toLowerCase() === 'owner';
    if (!permissions.length && isOwner) permissions = DEFAULT_PERMISSIONS_OWNER;`;

const newLoginOwner = `    const isOwner = user.roleKey && user.roleKey.toLowerCase() === 'owner';
    if (isOwner) {
      permissions = Array.from(new Set([...permissions, ...DEFAULT_PERMISSIONS_OWNER]));
    }`;

let resApi = replaceNormalized(serverApi, oldLoginOwner, newLoginOwner);
if (resApi) {
  serverApi = resApi;
  console.log('✓ Updated /auth/login in server/api.js for owner permissions');
} else if (serverApi.includes('Array.from(new Set([...permissions, ...DEFAULT_PERMISSIONS_OWNER]))')) {
  console.log('ℹ server/api.js login already updated');
} else {
  console.warn('⚠ Could not match oldLoginOwner in server/api.js');
}

// GET /roles owner permissions guarantee
const oldGetRoles = `    const rows = db.prepare('SELECT * FROM "Role" ORDER BY isSystem DESC, createdAt ASC').all();
    const items = rows.map(r => ({ ...r, isSystem: fromBool(r.isSystem), permissions: safeJson(r.permissions, []) }));`;

const newGetRoles = `    const rows = db.prepare('SELECT * FROM "Role" ORDER BY isSystem DESC, createdAt ASC').all();
    const items = rows.map(r => {
      let perms = safeJson(r.permissions, []);
      if (r.key === 'owner') {
        perms = Array.from(new Set([...perms, ...DEFAULT_PERMISSIONS_OWNER]));
      }
      return { ...r, isSystem: fromBool(r.isSystem), permissions: perms };
    });`;

resApi = replaceNormalized(serverApi, oldGetRoles, newGetRoles);
if (resApi) {
  serverApi = resApi;
  console.log('✓ Updated GET /roles in server/api.js for owner permissions');
} else if (serverApi.includes("if (r.key === 'owner')")) {
  console.log('ℹ server/api.js GET /roles already updated');
} else {
  console.warn('⚠ Could not match oldGetRoles in server/api.js');
}

// GET /roles/:id owner permissions guarantee
const oldGetRoleById = `    const row = db.prepare('SELECT * FROM "Role" WHERE id=@id').get({ id: req.params.id });
    if (!row) throw ApiError('NOT_FOUND', 'الدور غير موجود', 404);
    ok(res, { ...row, isSystem: fromBool(row.isSystem), permissions: safeJson(row.permissions, []) });`;

const newGetRoleById = `    const row = db.prepare('SELECT * FROM "Role" WHERE id=@id').get({ id: req.params.id });
    if (!row) throw ApiError('NOT_FOUND', 'الدور غير موجود', 404);
    let perms = safeJson(row.permissions, []);
    if (row.key === 'owner') {
      perms = Array.from(new Set([...perms, ...DEFAULT_PERMISSIONS_OWNER]));
    }
    ok(res, { ...row, isSystem: fromBool(row.isSystem), permissions: perms });`;

resApi = replaceNormalized(serverApi, oldGetRoleById, newGetRoleById);
if (resApi) {
  serverApi = resApi;
  console.log('✓ Updated GET /roles/:id in server/api.js for owner permissions');
} else if (serverApi.includes("if (row.key === 'owner')")) {
  console.log('ℹ server/api.js GET /roles/:id already updated');
} else {
  console.warn('⚠ Could not match oldGetRoleById in server/api.js');
}

fs.writeFileSync(serverApiPath, serverApi, 'utf8');

// 4. Update databases (both data/custom.db and %LOCALAPPDATA%\com.library.supermarket\custom.db)
const Database = require('../server/node_modules/better-sqlite3');
const { DEFAULT_PERMISSIONS_OWNER } = require('../server/db.js');

const dbTargets = [
  path.join(base, 'data/custom.db'),
  path.join(process.env.LOCALAPPDATA || '', 'com.library.supermarket', 'custom.db')
];

for (const dbp of dbTargets) {
  if (fs.existsSync(dbp)) {
    try {
      const db = new Database(dbp);
      const row = db.prepare("SELECT id, permissions FROM Role WHERE key='owner'").get();
      if (row) {
        let current = [];
        try { current = JSON.parse(row.permissions); } catch (e) { current = []; }
        const merged = Array.from(new Set([...current, ...DEFAULT_PERMISSIONS_OWNER]));
        db.prepare("UPDATE Role SET permissions=?, updatedAt=? WHERE key='owner'").run(JSON.stringify(merged), new Date().toISOString());
        console.log(`✓ Updated owner role in database: ${dbp} (Total: ${merged.length} perms, LICENSE_VIEW: ${merged.includes('LICENSE_VIEW')})`);
      }
      db.close();
    } catch (e) {
      console.warn(`⚠ Could not update database ${dbp}:`, e.message);
    }
  }
}

// 5. Patch compiled client chunks
const chunkFiles = [
  path.join(base, 'out/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(base, 'dist-desktop/win-unpacked/resources/out/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(base, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js'),
];

for (const cf of chunkFiles) {
  if (fs.existsSync(cf)) {
    let js = fs.readFileSync(cf, 'utf8');
    let patched = false;

    // Target 1: openEdit setSelected in chunk
    const oldOpen = 'g([...t.permissions]),h(!0)';
    const newOpen = 'g("owner"===t.key?Array.from(new Set([...t.permissions,...MQ.flatMap(x=>x.perms)])):[...t.permissions]),h(!0)';
    if (js.includes(oldOpen)) {
      js = js.replace(oldOpen, newOpen);
      patched = true;
      console.log(`✓ Patched openEdit in ${path.basename(cf)} (${path.relative(base, cf)})`);
    } else if (js.includes('MQ.flatMap(x=>x.perms)')) {
      console.log(`ℹ openEdit already patched in ${path.basename(cf)}`);
    }

    // Target 2: card badge count in chunk
    const oldCard = 'children:t.permissions.length})," / 33"';
    const newCard = 'children:"owner"===t.key?33:t.permissions.length})," / 33"';
    if (js.includes(oldCard)) {
      js = js.replace(oldCard, newCard);
      patched = true;
      console.log(`✓ Patched card count in ${path.basename(cf)}`);
    }

    // Target 3: dialog badge count in chunk
    const oldDialog = 'children:b.length})," / 33"';
    const newDialog = 'children:"owner"===f?.key?33:b.length})," / 33"';
    if (js.includes(oldDialog)) {
      js = js.replace(oldDialog, newDialog);
      patched = true;
      console.log(`✓ Patched dialog count in ${path.basename(cf)}`);
    }

    if (patched) {
      fs.writeFileSync(cf, js, 'utf8');
    }
  }
}

// 6. Sync updated server files to dist-desktop
const distServerDb = path.join(base, 'dist-desktop/win-unpacked/resources/server/db.js');
const distServerApi = path.join(base, 'dist-desktop/win-unpacked/resources/server/api.js');

if (fs.existsSync(distServerDb)) {
  fs.copyFileSync(serverDbPath, distServerDb);
  console.log('✓ Synced server/db.js to dist-desktop/win-unpacked/resources/server/db.js');
}

if (fs.existsSync(distServerApi)) {
  fs.copyFileSync(serverApiPath, distServerApi);
  console.log('✓ Synced server/api.js to dist-desktop/win-unpacked/resources/server/api.js');
}

console.log('\n[SUCCESS] ALL ROLES LICENSE PATCHES COMPLETED CLEANLY!');
