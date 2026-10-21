'use strict';
/**
 * LIBRARY STORE — Windows 7 Edition
 * Express.js API Router — replaces all 44 Next.js API routes
 * Compatible with Node.js 16.x + better-sqlite3
 */

const router = require('express').Router();
const { randomBytes } = require('crypto');
const path = require('path');
const fs = require('fs');

const {
  openDb, ensureBootstrap, ensureSystemData, getSettings, getDbPath,
  newId, now, bool, fromBool, parseBoolField, safeJson,
  nextDocNo, hashPassword, verifyPassword, audit,
  stockAvailableMap, stockTotalMap,
  createSession, getSessionUser, destroySession,
  SESSION_COOKIE, DEFAULT_PERMISSIONS_OWNER, DEFAULT_POS,
  transaction,
} = require('./db');

// ─── Response helpers ──────────────────────────────────────────────────────────
function ok(res, data, status) { res.status(status || 200).json({ ok: true, data }); }
function fail(res, code, message, status) { res.status(status || 400).json({ ok: false, error: { code, message } }); }

function wrap(res, fn) {
  Promise.resolve().then(fn).catch((e) => {
    if (e && e.isApiError) return fail(res, e.code, e.message, e.status);
    const ref = randomBytes(4).toString('hex').toUpperCase();
    console.error(`[LIBRARY_STORE][ERR-${ref}]`, e);
    fail(res, 'INTERNAL', `خطأ غير متوقع — رقم مرجعي ${ref}`, 500);
  });
}

function ApiError(code, message, status) {
  const e = new Error(message);
  e.isApiError = true; e.code = code; e.status = status || 400;
  return e;
}

// ─── Auth middleware ───────────────────────────────────────────────────────────
function requireAuth(req) {
  const token = req.cookies && req.cookies[SESSION_COOKIE];
  const user = getSessionUser(token);
  if (!user) throw ApiError('UNAUTHORIZED', 'انتهت الجلسة — أعد تسجيل الدخول', 401);
  return user;
}
function requirePermission(req, perm) {
  const user = requireAuth(req);
  if (!user.permissions.includes(perm)) throw ApiError('FORBIDDEN', `ليس لديك صلاحية (${perm})`, 403);
  return user;
}

// ─── Pagination ────────────────────────────────────────────────────────────────
function pageParams(req, defaultSize) {
  const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || String(defaultSize || 20), 10) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

function dateRange(req) {
  const f = req.query.from, t = req.query.to;
  if (!f && !t) return null;
  const to = t ? new Date(t) : new Date();
  to.setHours(23, 59, 59, 999);
  const from = f ? new Date(f) : new Date(to.getTime() - 29 * 86400000);
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

// ─── Money helpers ─────────────────────────────────────────────────────────────
function r2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function r3(n) { return Math.round((n + Number.EPSILON) * 1000) / 1000; }

// ─── Ensure system data on every request ──────────────────────────────────────
router.use((req, res, next) => {
  try { ensureBootstrap(); ensureSystemData(); next(); }
  catch (e) { fail(res, 'BOOT_ERROR', 'فشل تهيئة قاعدة البيانات', 503); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM STATUS (public, no auth)
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/system/status', (req, res) => {
  wrap(res, () => {
    const settings = getSettings('default');
    const data = {
      ok: true,
      data: {
        productId: 'LIBRARY_STORE',
        phase: 'READY', licenseState: 'ACTIVE', provisioningStage: 'READY',
        version: '1.0.0', build: 'win7',
        license: null, modules: { supermarket: true, pos: true, inventory: true, purchasing: true, customers: true, reports: true, stocktaking: true, loyalty: true, printing: true, scanner: true, cashDrawer: true, multiUser: true, backups: true },
        hardware: settings.hardware, hardwareCaps: { receiptPrinter: true, cashDrawer: true, barcodeScanner: true },
        branding: settings.branding, localization: settings.localization,
        pos: settings.pos, business: settings.business,
        installationId: 'offline-standalone', tenantId: 'default',
        licenseServer: { reachable: false, checkedAt: null },
        pid: process.pid, runtime: 'node',
      }
    };
    res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS' });
    res.json(data);
  });
});
router.options('/system/status', (req, res) => {
  res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }).status(204).end();
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/auth/login', (req, res) => {
  wrap(res, () => {
    const { username, password } = req.body || {};
    if (!username || !password) throw ApiError('CREDENTIALS_REQUIRED', 'أدخل اسم المستخدم وكلمة المرور', 400);
    const db = openDb();
    const user = db.prepare('SELECT u.*, r.permissions, r.nameAr as roleNameAr, r.nameEn as roleNameEn FROM "User" u JOIN "Role" r ON u.roleKey=r.key WHERE u.username=@username AND u.tenantId=@tenantId AND u.active=1').get({ username: username.trim().toLowerCase(), tenantId: 'default' });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      audit({ username }, 'LOGIN_FAILURE', { entity: 'auth', result: 'FAILURE', metadata: { username } });
      throw ApiError('LOGIN_FAILED', 'بيانات الدخول غير صحيحة', 401);
    }
    const { token, expiresAt } = createSession(user.id);
    db.prepare('UPDATE "User" SET lastLoginAt=@t WHERE id=@id').run({ t: now(), id: user.id });
    audit({ userId: user.id, username: user.username }, 'LOGIN_SUCCESS', { entity: 'auth' });
    let permissions = [];
    try { permissions = JSON.parse(user.permissions); } catch {}
    const isOwner = user.roleKey && user.roleKey.toLowerCase() === 'owner';
    if (!permissions.length && isOwner) permissions = DEFAULT_PERMISSIONS_OWNER;
    const settings = getSettings('default');
    res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: false, expires: expiresAt, path: '/' });
    ok(res, {
      user: { id: user.id, username: user.username, displayName: user.displayName, roleKey: user.roleKey, roleNameAr: user.roleNameAr, roleNameEn: user.roleNameEn, permissions },
      status: { productId: 'LIBRARY_STORE', phase: 'READY', licenseState: 'ACTIVE', version: '1.0.0', branding: settings.branding, business: settings.business, localization: settings.localization, pos: settings.pos, tenantId: 'default' },
    });
  });
});

router.post('/auth/logout', (req, res) => {
  const token = req.cookies && req.cookies[SESSION_COOKIE];
  if (token) destroySession(token);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  ok(res, { loggedOut: true });
});

router.get('/auth/session', (req, res) => {
  wrap(res, () => {
    const token = req.cookies && req.cookies[SESSION_COOKIE];
    const user = token ? getSessionUser(token) : null;
    ok(res, { user: user || null });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/settings', (req, res) => {
  wrap(res, () => { requirePermission(req, 'SETTINGS_VIEW'); ok(res, getSettings('default')); });
});
router.put('/settings', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'SETTINGS_MANAGE');
    const { block, data } = req.body || {};
    const valid = ['business','branding','hardware','pos','localization','backup','system'];
    if (!block || !valid.includes(block)) throw ApiError('INVALID_BLOCK', 'كتلة الإعدادات غير صالحة', 400);
    const current = getSettings('default');
    const updated = { ...current, [block]: data };
    const db = openDb();
    const row = db.prepare('SELECT id FROM AppSettings WHERE id=@id').get({ id: 'default' });
    if (row) {
      db.prepare(`UPDATE AppSettings SET "${block}"=@val, updatedAt=@t WHERE id=@id`)
        .run({ val: JSON.stringify(data), t: now(), id: 'default' });
    } else {
      db.prepare(`INSERT INTO AppSettings (id,business,branding,hardware,pos,localization,backup,system,updatedAt) VALUES (@id,@business,@branding,@hardware,@pos,@localization,@backup,@system,@t)`)
        .run({ id: 'default', business: JSON.stringify(updated.business), branding: JSON.stringify(updated.branding), hardware: JSON.stringify(updated.hardware), pos: JSON.stringify(updated.pos), localization: JSON.stringify(updated.localization), backup: JSON.stringify(updated.backup), system: JSON.stringify(updated.system), t: now() });
    }
    ok(res, getSettings('default'));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/users', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'USER_VIEW');
    const db = openDb();
    const { page, pageSize, skip, take } = pageParams(req, 20);
    const q = req.query.q ? `%${req.query.q.trim()}%` : null;
    let where = 'WHERE u.tenantId=@tenantId';
    const params = { tenantId: 'default' };
    if (q) {
      where += ' AND (u.username LIKE @q OR u.displayName LIKE @q OR u.phone LIKE @q)';
      params.q = q;
    }
    const total = db.prepare(`SELECT COUNT(*) as c FROM "User" u ${where}`).get(params).c;
    const rows = db.prepare(`SELECT u.id, u.username, u.displayName, u.phone, u.roleKey, u.active, u.lastLoginAt, u.createdAt, r.nameAr as roleNameAr, r.nameEn as roleNameEn FROM "User" u JOIN "Role" r ON u.roleKey=r.key ${where} ORDER BY u.createdAt ASC LIMIT @take OFFSET @skip`).all({ ...params, take, skip });
    ok(res, {
      items: rows.map(u => ({ ...u, active: fromBool(u.active) })),
      total,
      page,
      pageSize,
    });
  });
});

router.post('/users', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'USER_MANAGE');
    const { username, password, displayName, roleKey, phone } = req.body || {};
    if (!username || !password || !displayName || !roleKey) throw ApiError('VALIDATION', 'البيانات مطلوبة: username, password, displayName, roleKey', 400);
    const db = openDb();
    const existing = db.prepare('SELECT id FROM "User" WHERE tenantId=@tenantId AND username=@username').get({ tenantId: 'default', username: username.trim().toLowerCase() });
    if (existing) throw ApiError('DUPLICATE', 'اسم المستخدم موجود بالفعل', 409);
    const role = db.prepare('SELECT id FROM "Role" WHERE key=@key').get({ key: roleKey });
    if (!role) throw ApiError('NOT_FOUND', 'الدور غير موجود', 404);
    const id = newId();
    db.prepare('INSERT INTO "User" (id,tenantId,username,passwordHash,displayName,phone,roleKey,active,updatedAt) VALUES (@id,@tenantId,@username,@passwordHash,@displayName,@phone,@roleKey,1,@t)')
      .run({ id, tenantId: 'default', username: username.trim().toLowerCase(), passwordHash: hashPassword(password), displayName: displayName.trim(), phone: phone || null, roleKey, t: now() });
    audit({ username: 'system' }, 'USER_CREATE', { entity: 'user', entityId: id, metadata: { username } });
    ok(res, { id, username: username.trim().toLowerCase(), displayName: displayName.trim(), roleKey, active: true }, 201);
  });
});

router.get('/users/:id', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'USER_VIEW');
    const db = openDb();
    const user = db.prepare('SELECT u.*, r.nameAr as roleNameAr, r.nameEn as roleNameEn FROM "User" u JOIN "Role" r ON u.roleKey=r.key WHERE u.id=@id AND u.tenantId=@tenantId').get({ id: req.params.id, tenantId: 'default' });
    if (!user) throw ApiError('NOT_FOUND', 'المستخدم غير موجود', 404);
    ok(res, { ...user, active: fromBool(user.active), passwordHash: undefined });
  });
});

router.put('/users/:id', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'USER_MANAGE');
    const db = openDb();
    const user = db.prepare('SELECT * FROM "User" WHERE id=@id AND tenantId=@tenantId').get({ id: req.params.id, tenantId: 'default' });
    if (!user) throw ApiError('NOT_FOUND', 'المستخدم غير موجود', 404);
    const { displayName, phone, roleKey, active, password } = req.body || {};
    const updates = [];
    const params = { id: req.params.id, t: now() };
    if (displayName !== undefined) { updates.push('displayName=@displayName'); params.displayName = displayName; }
    if (phone !== undefined) { updates.push('phone=@phone'); params.phone = phone; }
    if (roleKey !== undefined) { updates.push('roleKey=@roleKey'); params.roleKey = roleKey; }
    if (active !== undefined) { updates.push('active=@active'); params.active = bool(active); }
    if (password) { updates.push('passwordHash=@passwordHash'); params.passwordHash = hashPassword(password); }
    if (!updates.length) throw ApiError('NO_CHANGE', 'لا توجد تعديلات', 400);
    updates.push('updatedAt=@t');
    db.prepare(`UPDATE "User" SET ${updates.join(',')} WHERE id=@id`).run(params);
    ok(res, { id: req.params.id, updated: true });
  });
});

router.delete('/users/:id', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'USER_MANAGE');
    const db = openDb();
    const user = db.prepare('SELECT * FROM "User" WHERE id=@id AND tenantId=@tenantId').get({ id: req.params.id, tenantId: 'default' });
    if (!user) throw ApiError('NOT_FOUND', 'المستخدم غير موجود', 404);
    if (user.roleKey === 'owner') {
      const ownerCount = db.prepare("SELECT COUNT(*) as c FROM \"User\" WHERE tenantId=@tenantId AND roleKey='owner' AND active=1").get({ tenantId: 'default' }).c;
      if (ownerCount <= 1) throw ApiError('LAST_OWNER', 'لا يمكن حذف آخر مالك للنظام', 409);
    }
    const salesCount = db.prepare('SELECT COUNT(*) as c FROM "Sale" WHERE cashierId=@id').get({ id: req.params.id }).c;
    if (salesCount > 0) {
      db.prepare('UPDATE "User" SET active=0,updatedAt=@t WHERE id=@id').run({ id: req.params.id, t: now() });
      return ok(res, { deactivated: true, salesCount });
    }
    db.prepare('DELETE FROM "User" WHERE id=@id').run({ id: req.params.id });
    ok(res, { deleted: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ROLES
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/roles', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'ROLE_VIEW');
    const db = openDb();
    const rows = db.prepare('SELECT * FROM "Role" ORDER BY isSystem DESC, createdAt ASC').all();
    const items = rows.map(r => ({ ...r, isSystem: fromBool(r.isSystem), permissions: safeJson(r.permissions, []) }));
    ok(res, { items });
  });
});

router.post('/roles', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'ROLE_MANAGE');
    const { key, nameAr, nameEn, description, permissions } = req.body || {};
    if (!key || !nameAr || !nameEn) throw ApiError('VALIDATION', 'key, nameAr, nameEn مطلوبة', 400);
    const db = openDb();
    const existing = db.prepare('SELECT id FROM "Role" WHERE key=@key').get({ key });
    if (existing) throw ApiError('DUPLICATE', 'مفتاح الدور موجود بالفعل', 409);
    const id = newId();
    db.prepare('INSERT INTO "Role" (id,tenantId,key,nameAr,nameEn,description,permissions,isSystem,updatedAt) VALUES (@id,@tenantId,@key,@nameAr,@nameEn,@description,@permissions,0,@t)')
      .run({ id, tenantId: 'default', key, nameAr, nameEn, description: description || null, permissions: JSON.stringify(permissions || []), t: now() });
    ok(res, { id, key, nameAr, nameEn }, 201);
  });
});

router.get('/roles/:id', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'ROLE_VIEW');
    const db = openDb();
    const row = db.prepare('SELECT * FROM "Role" WHERE id=@id').get({ id: req.params.id });
    if (!row) throw ApiError('NOT_FOUND', 'الدور غير موجود', 404);
    ok(res, { ...row, isSystem: fromBool(row.isSystem), permissions: safeJson(row.permissions, []) });
  });
});

router.put('/roles/:id', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'ROLE_MANAGE');
    const db = openDb();
    const role = db.prepare('SELECT * FROM "Role" WHERE id=@id').get({ id: req.params.id });
    if (!role) throw ApiError('NOT_FOUND', 'الدور غير موجود', 404);
    if (fromBool(role.isSystem)) throw ApiError('SYSTEM_ROLE', 'لا يمكن تعديل دور النظام', 409);
    const { nameAr, nameEn, description, permissions } = req.body || {};
    db.prepare('UPDATE "Role" SET nameAr=@nameAr,nameEn=@nameEn,description=@description,permissions=@permissions,updatedAt=@t WHERE id=@id')
      .run({ nameAr: nameAr || role.nameAr, nameEn: nameEn || role.nameEn, description: description !== undefined ? description : role.description, permissions: JSON.stringify(permissions || safeJson(role.permissions, [])), t: now(), id: req.params.id });
    ok(res, { updated: true });
  });
});

router.delete('/roles/:id', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'ROLE_MANAGE');
    const db = openDb();
    const role = db.prepare('SELECT * FROM "Role" WHERE id=@id').get({ id: req.params.id });
    if (!role) throw ApiError('NOT_FOUND', 'الدور غير موجود', 404);
    if (fromBool(role.isSystem)) throw ApiError('SYSTEM_ROLE', 'لا يمكن حذف دور النظام', 409);
    const inUse = db.prepare('SELECT COUNT(*) as c FROM "User" WHERE roleKey=@key').get({ key: role.key }).c;
    if (inUse > 0) throw ApiError('IN_USE', 'الدور مستخدم ولا يمكن حذفه', 409);
    db.prepare('DELETE FROM "Role" WHERE id=@id').run({ id: req.params.id });
    ok(res, { deleted: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/categories', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'CATEGORY_VIEW');
    const db = openDb();
    const q = req.query.q ? `%${req.query.q.trim()}%` : null;
    const activeParam = req.query.active;
    let where = 'WHERE c.tenantId=@tenantId';
    const params = { tenantId: 'default' };
    if (q) {
      where += ' AND (c.nameAr LIKE @q OR c.nameEn LIKE @q)';
      params.q = q;
    }
    if (activeParam === 'true') { where += ' AND c.active=1'; }
    else if (activeParam === 'false') { where += ' AND c.active=0'; }

    const rows = db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM "Product" p WHERE p.categoryId=c.id AND p.tenantId=@tenantId) as productsCount FROM "Category" c ${where} ORDER BY c.nameAr ASC`).all(params);
    const items = rows.map(r => ({ ...r, active: fromBool(r.active), productsCount: r.productsCount || 0 }));
    ok(res, { items, total: items.length });
  });
});

router.post('/categories', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'CATEGORY_MANAGE');
    const { nameAr, nameEn, description } = req.body || {};
    if (!nameAr) throw ApiError('VALIDATION', 'اسم التصنيف بالعربية مطلوب', 400);
    const db = openDb();
    const existing = db.prepare('SELECT id FROM "Category" WHERE tenantId=@tenantId AND nameAr=@nameAr').get({ tenantId: 'default', nameAr: nameAr.trim() });
    if (existing) throw ApiError('DUPLICATE', 'التصنيف موجود بالفعل', 409);
    const id = newId();
    db.prepare('INSERT INTO "Category" (id,tenantId,nameAr,nameEn,description,active,updatedAt) VALUES (@id,@tenantId,@nameAr,@nameEn,@description,1,@t)')
      .run({ id, tenantId: 'default', nameAr: nameAr.trim(), nameEn: nameEn || null, description: description || null, t: now() });
    audit({ username: 'system' }, 'CATEGORY_CREATE', { entity: 'category', entityId: id, metadata: { nameAr } });
    ok(res, { id, nameAr: nameAr.trim(), nameEn, active: true }, 201);
  });
});

router.get('/categories/:id', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'CATEGORY_VIEW');
    const db = openDb();
    const row = db.prepare('SELECT c.*, (SELECT COUNT(*) FROM "Product" p WHERE p.categoryId=c.id AND p.tenantId=@tenantId) as productsCount FROM "Category" c WHERE c.id=@id AND c.tenantId=@tenantId').get({ id: req.params.id, tenantId: 'default' });
    if (!row) throw ApiError('NOT_FOUND', 'التصنيف غير موجود', 404);
    ok(res, { ...row, active: fromBool(row.active), productsCount: row.productsCount || 0 });
  });
});

router.put('/categories/:id', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'CATEGORY_MANAGE');
    const db = openDb();
    const row = db.prepare('SELECT * FROM "Category" WHERE id=@id AND tenantId=@tenantId').get({ id: req.params.id, tenantId: 'default' });
    if (!row) throw ApiError('NOT_FOUND', 'التصنيف غير موجود', 404);
    const { nameAr, nameEn, description, active } = req.body || {};
    db.prepare('UPDATE "Category" SET nameAr=@nameAr,nameEn=@nameEn,description=@description,active=@active,updatedAt=@t WHERE id=@id')
      .run({ nameAr: nameAr || row.nameAr, nameEn: nameEn !== undefined ? nameEn : row.nameEn, description: description !== undefined ? description : row.description, active: active !== undefined ? bool(active) : row.active, t: now(), id: req.params.id });
    ok(res, { updated: true });
  });
});

router.delete('/categories/:id', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'CATEGORY_MANAGE');
    const db = openDb();
    const row = db.prepare('SELECT * FROM "Category" WHERE id=@id AND tenantId=@tenantId').get({ id: req.params.id, tenantId: 'default' });
    if (!row) throw ApiError('NOT_FOUND', 'التصنيف غير موجود', 404);
    const inUse = db.prepare('SELECT COUNT(*) as c FROM "Product" WHERE categoryId=@id AND tenantId=@tenantId').get({ id: req.params.id, tenantId: 'default' }).c;
    const force = req.query.force === 'true';
    const deleteProducts = req.query.deleteProducts === 'true';

    if (force) {
      if (deleteProducts) {
        db.prepare('UPDATE "Product" SET active=0, categoryId=NULL, updatedAt=@t WHERE categoryId=@id AND tenantId=@tenantId').run({ id: req.params.id, tenantId: 'default', t: now() });
      } else {
        db.prepare('UPDATE "Product" SET categoryId=NULL, updatedAt=@t WHERE categoryId=@id AND tenantId=@tenantId').run({ id: req.params.id, tenantId: 'default', t: now() });
      }
      db.prepare('DELETE FROM "Category" WHERE id=@id').run({ id: req.params.id });
      return ok(res, { deleted: true, forced: true, productsDeleted: deleteProducts });
    }

    if (inUse > 0) throw ApiError('CATEGORY_IN_USE', `لا يمكن حذف التصنيف — مرتبط بـ ${inUse} صنف`, 409);
    db.prepare('DELETE FROM "Category" WHERE id=@id').run({ id: req.params.id });
    ok(res, { deleted: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPLIERS
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/suppliers', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'SUPPLIER_VIEW');
    const db = openDb();
    const { page, pageSize, skip, take } = pageParams(req, 20);
    const q = req.query.q ? `%${req.query.q.trim()}%` : null;
    const activeParam = req.query.active;

    let where = 'WHERE s.tenantId=@tenantId';
    const params = { tenantId: 'default' };
    if (q) {
      where += ' AND (s.name LIKE @q OR s.phone LIKE @q OR s.email LIKE @q)';
      params.q = q;
    }
    if (activeParam === 'true') { where += ' AND s.active=1'; }
    else if (activeParam === 'false') { where += ' AND s.active=0'; }

    const total = db.prepare(`SELECT COUNT(*) as c FROM "Supplier" s ${where}`).get(params).c;

    const rows = db.prepare(`SELECT s.*,
      (SELECT COUNT(*) FROM "Purchase" pu WHERE pu.supplierId=s.id AND pu.tenantId=@tenantId) as purchasesCount,
      (SELECT COALESCE(SUM(total),0) FROM "Purchase" pu WHERE pu.supplierId=s.id AND pu.tenantId=@tenantId AND pu.status!='CANCELLED') as purchasedTotal,
      (SELECT COALESCE(SUM(paidAmount),0) FROM "Purchase" pu WHERE pu.supplierId=s.id AND pu.tenantId=@tenantId AND pu.status!='CANCELLED') as paidTotal
      FROM "Supplier" s
      ${where}
      ORDER BY s.name ASC
      LIMIT @take OFFSET @skip`).all({ ...params, take, skip });

    const items = rows.map(r => ({
      ...r,
      active: fromBool(r.active),
      purchasesCount: r.purchasesCount || 0,
      totalPurchased: r.purchasedTotal || 0,
      paidAmount: r.paidTotal || 0,
      balanceDue: Math.max(0, r2((r.purchasedTotal || 0) - (r.paidTotal || 0))),
    }));

    ok(res, { items, total, page, pageSize });
  });
});

router.post('/suppliers', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'SUPPLIER_MANAGE');
    const { name, phone, email, address, notes } = req.body || {};
    if (!name) throw ApiError('VALIDATION', 'اسم المورد مطلوب', 400);
    const db = openDb();
    const id = newId();
    db.prepare('INSERT INTO "Supplier" (id,tenantId,name,phone,email,address,notes,active,updatedAt) VALUES (@id,@tenantId,@name,@phone,@email,@address,@notes,1,@t)')
      .run({ id, tenantId: 'default', name: name.trim(), phone: phone || null, email: email || null, address: address || null, notes: notes || null, t: now() });
    ok(res, { id, name: name.trim(), active: true }, 201);
  });
});

router.get('/suppliers/:id', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'SUPPLIER_VIEW');
    const db = openDb();
    const row = db.prepare('SELECT * FROM "Supplier" WHERE id=@id AND tenantId=@tenantId').get({ id: req.params.id, tenantId: 'default' });
    if (!row) throw ApiError('NOT_FOUND', 'المورد غير موجود', 404);
    ok(res, { ...row, active: fromBool(row.active) });
  });
});

router.put('/suppliers/:id', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'SUPPLIER_MANAGE');
    const db = openDb();
    const row = db.prepare('SELECT * FROM "Supplier" WHERE id=@id AND tenantId=@tenantId').get({ id: req.params.id, tenantId: 'default' });
    if (!row) throw ApiError('NOT_FOUND', 'المورد غير موجود', 404);
    const { name, phone, email, address, notes, active } = req.body || {};
    db.prepare('UPDATE "Supplier" SET name=@name,phone=@phone,email=@email,address=@address,notes=@notes,active=@active,updatedAt=@t WHERE id=@id')
      .run({ name: name || row.name, phone: phone !== undefined ? phone : row.phone, email: email !== undefined ? email : row.email, address: address !== undefined ? address : row.address, notes: notes !== undefined ? notes : row.notes, active: active !== undefined ? bool(active) : row.active, t: now(), id: req.params.id });
    ok(res, { updated: true });
  });
});

router.delete('/suppliers/:id', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'SUPPLIER_MANAGE');
    const db = openDb();
    const row = db.prepare('SELECT * FROM "Supplier" WHERE id=@id AND tenantId=@tenantId').get({ id: req.params.id, tenantId: 'default' });
    if (!row) throw ApiError('NOT_FOUND', 'المورد غير موجود', 404);
    const force = req.query.force === 'true';
    const deletePurchases = req.query.deletePurchases === 'true';

    db.prepare('UPDATE "Supplier" SET active=0,updatedAt=@t WHERE id=@id').run({ id: req.params.id, t: now() });
    if (force) {
      return ok(res, { deactivated: true, forced: true, purchasesDeleted: deletePurchases });
    }
    ok(res, { deactivated: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMERS
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/customers', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'CUSTOMER_VIEW');
    const { page, pageSize, skip, take } = pageParams(req);
    const q = req.query.q ? `%${req.query.q}%` : null;
    const db = openDb();
    let where = 'WHERE tenantId=@tenantId';
    const params = { tenantId: 'default' };
    if (q) { where += ' AND (name LIKE @q OR phone LIKE @q)'; params.q = q; }
    const total = db.prepare(`SELECT COUNT(*) as c FROM "Customer" ${where}`).get(params).c;
    const rows = db.prepare(`SELECT * FROM "Customer" ${where} ORDER BY name ASC LIMIT @take OFFSET @skip`).all({ ...params, take, skip });
    ok(res, { items: rows.map(r => ({ ...r, active: fromBool(r.active) })), total, page, pageSize });
  });
});

router.post('/customers', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'CUSTOMER_MANAGE');
    const { name, phone, email, address, notes } = req.body || {};
    if (!name) throw ApiError('VALIDATION', 'اسم العميل مطلوب', 400);
    const db = openDb();
    const id = newId();
    db.prepare('INSERT INTO "Customer" (id,tenantId,name,phone,email,address,notes,active,updatedAt) VALUES (@id,@tenantId,@name,@phone,@email,@address,@notes,1,@t)')
      .run({ id, tenantId: 'default', name: name.trim(), phone: phone || null, email: email || null, address: address || null, notes: notes || null, t: now() });
    audit({ username: 'system' }, 'CUSTOMER_CREATE', { entity: 'customer', entityId: id, metadata: { name } });
    ok(res, { id, name: name.trim(), active: true, loyaltyPoints: 0 }, 201);
  });
});

router.get('/customers/:id', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'CUSTOMER_VIEW');
    const db = openDb();
    const row = db.prepare('SELECT * FROM "Customer" WHERE id=@id AND tenantId=@tenantId').get({ id: req.params.id, tenantId: 'default' });
    if (!row) throw ApiError('NOT_FOUND', 'العميل غير موجود', 404);
    const balance = db.prepare('SELECT COALESCE(SUM(points),0) as b FROM "LoyaltyEvent" WHERE customerId=@id').get({ id: req.params.id }).b || 0;
    ok(res, { ...row, active: fromBool(row.active), loyaltyBalance: balance });
  });
});

router.put('/customers/:id', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'CUSTOMER_MANAGE');
    const db = openDb();
    const row = db.prepare('SELECT * FROM "Customer" WHERE id=@id AND tenantId=@tenantId').get({ id: req.params.id, tenantId: 'default' });
    if (!row) throw ApiError('NOT_FOUND', 'العميل غير موجود', 404);
    const { name, phone, email, address, notes, active } = req.body || {};
    db.prepare('UPDATE "Customer" SET name=@name,phone=@phone,email=@email,address=@address,notes=@notes,active=@active,updatedAt=@t WHERE id=@id')
      .run({ name: name || row.name, phone: phone !== undefined ? phone : row.phone, email: email !== undefined ? email : row.email, address: address !== undefined ? address : row.address, notes: notes !== undefined ? notes : row.notes, active: active !== undefined ? bool(active) : row.active, t: now(), id: req.params.id });
    ok(res, { updated: true });
  });
});

router.delete('/customers/:id', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'CUSTOMER_MANAGE');
    const db = openDb();
    const row = db.prepare('SELECT * FROM "Customer" WHERE id=@id AND tenantId=@tenantId').get({ id: req.params.id, tenantId: 'default' });
    if (!row) throw ApiError('NOT_FOUND', 'العميل غير موجود', 404);
    db.prepare('UPDATE "Customer" SET active=0,updatedAt=@t WHERE id=@id').run({ id: req.params.id, t: now() });
    ok(res, { deleted: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════════
function normalizeBarcode(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).replace(/[\x00-\x1F\x7F]/g, '').trim();
  return s.length > 0 ? s : null;
}

function productRow(p, availMap, totalMap) {
  return {
    id: p.id, sku: p.sku, barcode: p.barcode, nameAr: p.nameAr, nameEn: p.nameEn,
    genericName: p.genericName, categoryId: p.categoryId, categoryName: p.categoryName || null,
    manufacturer: p.manufacturer, unit: p.unit, packSize: p.packSize,
    isWeighable: fromBool(p.isWeighable), purchasePrice: p.purchasePrice, sellingPrice: p.sellingPrice,
    minSellingPrice: p.minSellingPrice, taxRate: p.taxRate, reorderLevel: p.reorderLevel,
    active: fromBool(p.active), notes: p.notes, createdAt: p.createdAt,
    stockAvailable: (availMap && availMap[p.id]) || 0,
    stockTotal: (totalMap && totalMap[p.id]) || 0,
  };
}

router.get('/products', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'PRODUCT_VIEW');
    const db = openDb();
    const { page, pageSize, skip, take } = pageParams(req);
    const q = req.query.q ? `%${req.query.q}%` : null;
    const categoryId = req.query.categoryId || null;
    const activeParam = req.query.active;
    const lowStock = req.query.lowStock === '1';

    let where = 'WHERE p.tenantId=@tenantId';
    const params = { tenantId: 'default' };
    if (q) { where += ' AND (p.nameAr LIKE @q OR p.nameEn LIKE @q OR p.barcode LIKE @q OR p.sku LIKE @q OR p.genericName LIKE @q)'; params.q = q; }
    if (categoryId) { where += ' AND p.categoryId=@categoryId'; params.categoryId = categoryId; }
    if (activeParam === 'true') { where += ' AND p.active=1'; }
    else if (activeParam === 'false') { where += ' AND p.active=0'; }

    const selectSql = `SELECT p.*, c.nameAr as categoryName FROM "Product" p LEFT JOIN "Category" c ON p.categoryId=c.id ${where} ORDER BY p.nameAr ASC`;

    if (lowStock) {
      const all = db.prepare(selectSql).all(params);
      const ids = all.map(p => p.id);
      const availMap = stockAvailableMap(db, ids, 'default');
      const totalMap = stockTotalMap(db, ids, 'default');
      const filtered = all.map(p => productRow(p, availMap, totalMap)).filter(r => r.stockAvailable <= r.reorderLevel + 1e-9);
      return ok(res, { items: filtered.slice(skip, skip + take), total: filtered.length, page, pageSize });
    }

    const total = db.prepare(`SELECT COUNT(*) as c FROM "Product" p ${where}`).get(params).c;
    const rows = db.prepare(`${selectSql} LIMIT @take OFFSET @skip`).all({ ...params, take, skip });
    const ids = rows.map(p => p.id);
    const availMap = stockAvailableMap(db, ids, 'default');
    const totalMap = stockTotalMap(db, ids, 'default');
    ok(res, { items: rows.map(p => productRow(p, availMap, totalMap)), total, page, pageSize });
  });
});

router.post('/products', (req, res) => {
  wrap(res, () => {
    const user = requirePermission(req, 'PRODUCT_CREATE');
    const db = openDb();
    const { sku, nameAr, nameEn, genericName, barcode, categoryId, manufacturer, unit, packSize, isWeighable, purchasePrice, sellingPrice, minSellingPrice, taxRate, reorderLevel, active, notes } = req.body || {};
    if (!sku || !nameAr || sellingPrice === undefined) throw ApiError('VALIDATION', 'sku, nameAr, sellingPrice مطلوبة', 400);
    if (db.prepare('SELECT id FROM "Product" WHERE tenantId=@tenantId AND sku=@sku').get({ tenantId: 'default', sku: sku.trim() })) throw ApiError('SKU_DUPLICATE', 'الكود الداخلي مستخدم لصنف آخر', 409);
    const normBarcode = normalizeBarcode(barcode);
    if (normBarcode) {
      const existing = db.prepare('SELECT id, nameAr, sku FROM "Product" WHERE tenantId=@tenantId AND barcode=@barcode').get({ tenantId: 'default', barcode: normBarcode });
      if (existing) {
        throw ApiError('BARCODE_EXISTS', `الباركود مستخدم لمنتج آخر: ${existing.nameAr} (${existing.sku})`, 409, { existingProduct: { id: existing.id, nameAr: existing.nameAr, sku: existing.sku } });
      }
    }
    if (categoryId && !db.prepare('SELECT id FROM "Category" WHERE id=@id AND tenantId=@tenantId').get({ id: categoryId, tenantId: 'default' })) throw ApiError('CATEGORY_NOT_FOUND', 'التصنيف غير موجود', 400);
    const id = newId();
    db.prepare('INSERT INTO "Product" (id,tenantId,sku,nameAr,nameEn,genericName,barcode,categoryId,manufacturer,unit,packSize,isWeighable,purchasePrice,sellingPrice,minSellingPrice,taxRate,reorderLevel,active,notes,updatedAt) VALUES (@id,@tenantId,@sku,@nameAr,@nameEn,@genericName,@barcode,@categoryId,@manufacturer,@unit,@packSize,@isWeighable,@purchasePrice,@sellingPrice,@minSellingPrice,@taxRate,@reorderLevel,@active,@notes,@t)')
      .run({ id, tenantId: 'default', sku: sku.trim(), nameAr: nameAr.trim(), nameEn: nameEn || null, genericName: genericName || null, barcode: normBarcode, categoryId: categoryId || null, manufacturer: manufacturer || null, unit: unit || 'piece', packSize: packSize || 1, isWeighable: bool(isWeighable || false), purchasePrice: purchasePrice || 0, sellingPrice: Number(sellingPrice), minSellingPrice: minSellingPrice || null, taxRate: taxRate || 0, reorderLevel: reorderLevel !== undefined ? reorderLevel : 10, active: active !== false ? 1 : 0, notes: notes || null, t: now() });
    audit({ userId: user.id, username: user.username }, 'PRODUCT_CREATE', { entity: 'product', entityId: id, metadata: { sku, nameAr } });
    ok(res, { id, sku: sku.trim(), nameAr: nameAr.trim(), active: active !== false }, 201);
  });
});

router.post('/products/bulk', (req, res) => {
  wrap(res, () => {
    const user = requirePermission(req, 'PRODUCT_CREATE');
    const { items } = req.body || {};
    if (!Array.isArray(items) || !items.length) throw ApiError('VALIDATION', 'قائمة المنتجات فارغة', 400);
    const db = openDb();
    let created = 0, skipped = 0;
    for (const item of items) {
      try {
        if (!item.sku || !item.nameAr || item.sellingPrice === undefined) { skipped++; continue; }
        if (db.prepare('SELECT id FROM "Product" WHERE tenantId=@tenantId AND sku=@sku').get({ tenantId: 'default', sku: item.sku.trim() })) { skipped++; continue; }
        db.prepare('INSERT INTO "Product" (id,tenantId,sku,nameAr,nameEn,barcode,unit,purchasePrice,sellingPrice,taxRate,reorderLevel,active,updatedAt) VALUES (@id,@tenantId,@sku,@nameAr,@nameEn,@barcode,@unit,@purchasePrice,@sellingPrice,@taxRate,@reorderLevel,1,@t)')
          .run({ id: newId(), tenantId: 'default', sku: item.sku.trim(), nameAr: item.nameAr.trim(), nameEn: item.nameEn || null, barcode: normalizeBarcode(item.barcode), unit: item.unit || 'piece', purchasePrice: item.purchasePrice || 0, sellingPrice: Number(item.sellingPrice), taxRate: item.taxRate || 0, reorderLevel: item.reorderLevel || 10, t: now() });
        created++;
      } catch { skipped++; }
    }
    audit({ userId: user.id, username: user.username }, 'PRODUCT_BULK_IMPORT', { metadata: { created, skipped } });
    ok(res, { created, skipped }, 201);
  });
});

router.get('/products/:id', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'PRODUCT_VIEW');
    const db = openDb();
    const row = db.prepare('SELECT p.*, c.nameAr as categoryName FROM "Product" p LEFT JOIN "Category" c ON p.categoryId=c.id WHERE p.id=@id AND p.tenantId=@tenantId').get({ id: req.params.id, tenantId: 'default' });
    if (!row) throw ApiError('NOT_FOUND', 'المنتج غير موجود', 404);

    const availMap = stockAvailableMap(db, [row.id], 'default');
    const totalMap = stockTotalMap(db, [row.id], 'default');
    const pRow = productRow(row, availMap, totalMap);

    const batches = db.prepare('SELECT b.*, s.name as supplierName FROM "Batch" b LEFT JOIN "Supplier" s ON b.supplierId=s.id WHERE b.productId=@id AND b.tenantId=@tenantId ORDER BY b.createdAt DESC, b.id DESC').all({ id: row.id, tenantId: 'default' });
    const movements = db.prepare('SELECT * FROM "StockMovement" WHERE productId=@id AND tenantId=@tenantId ORDER BY createdAt DESC LIMIT 10').all({ id: row.id, tenantId: 'default' });

    ok(res, {
      product: {
        id: row.id,
        sku: row.sku,
        barcode: row.barcode,
        nameAr: row.nameAr,
        nameEn: row.nameEn,
        genericName: row.genericName,
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        manufacturer: row.manufacturer,
        unit: row.unit,
        packSize: row.packSize,
        isWeighable: fromBool(row.isWeighable),
        purchasePrice: row.purchasePrice,
        sellingPrice: row.sellingPrice,
        minSellingPrice: row.minSellingPrice,
        taxRate: row.taxRate,
        reorderLevel: row.reorderLevel,
        active: fromBool(row.active),
        notes: row.notes,
        createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date(row.createdAt).toISOString(),
      },
      batches: batches.map(b => ({
        id: b.id,
        batchNo: b.batchNo,
        expiryDate: null, /* DEPRECATED */
        quantity: b.quantity,
        costPrice: b.costPrice,
        status: b.status,
        supplierName: b.supplierName || null,
        createdAt: typeof b.createdAt === 'string' ? b.createdAt : new Date(b.createdAt).toISOString(),
      })),
      movements: movements.map(m => ({
        id: m.id,
        type: m.type,
        quantity: m.quantity,
        note: m.note,
        createdAt: typeof m.createdAt === 'string' ? m.createdAt : new Date(m.createdAt).toISOString(),
      })),
      stockAvailable: pRow.stockAvailable,
      stockTotal: pRow.stockTotal,
    });
  });
});

router.put('/products/:id', (req, res) => {
  wrap(res, () => {
    const user = requirePermission(req, 'PRODUCT_EDIT');
    const db = openDb();
    const row = db.prepare('SELECT * FROM "Product" WHERE id=@id AND tenantId=@tenantId').get({ id: req.params.id, tenantId: 'default' });
    if (!row) throw ApiError('NOT_FOUND', 'المنتج غير موجود', 404);
    const b = req.body || {};
    const normBarcode = b.barcode !== undefined ? normalizeBarcode(b.barcode) : row.barcode;
    if (normBarcode) {
      const existing = db.prepare('SELECT id, nameAr, sku FROM "Product" WHERE tenantId=@tenantId AND barcode=@barcode AND id!=@id').get({ tenantId: 'default', barcode: normBarcode, id: req.params.id });
      if (existing) {
        throw ApiError('BARCODE_EXISTS', `الباركود مستخدم لمنتج آخر: ${existing.nameAr} (${existing.sku})`, 409, { existingProduct: { id: existing.id, nameAr: existing.nameAr, sku: existing.sku } });
      }
    }
    db.prepare('UPDATE "Product" SET nameAr=@nameAr,nameEn=@nameEn,genericName=@genericName,barcode=@barcode,categoryId=@categoryId,manufacturer=@manufacturer,unit=@unit,packSize=@packSize,isWeighable=@isWeighable,purchasePrice=@purchasePrice,sellingPrice=@sellingPrice,minSellingPrice=@minSellingPrice,taxRate=@taxRate,reorderLevel=@reorderLevel,active=@active,notes=@notes,updatedAt=@t WHERE id=@id')
      .run({ nameAr: b.nameAr || row.nameAr, nameEn: b.nameEn !== undefined ? b.nameEn : row.nameEn, genericName: b.genericName !== undefined ? b.genericName : row.genericName, barcode: normBarcode, categoryId: b.categoryId !== undefined ? b.categoryId : row.categoryId, manufacturer: b.manufacturer !== undefined ? b.manufacturer : row.manufacturer, unit: b.unit || row.unit, packSize: b.packSize || row.packSize, isWeighable: b.isWeighable !== undefined ? bool(b.isWeighable) : row.isWeighable, purchasePrice: b.purchasePrice !== undefined ? b.purchasePrice : row.purchasePrice, sellingPrice: b.sellingPrice !== undefined ? b.sellingPrice : row.sellingPrice, minSellingPrice: b.minSellingPrice !== undefined ? b.minSellingPrice : row.minSellingPrice, taxRate: b.taxRate !== undefined ? b.taxRate : row.taxRate, reorderLevel: b.reorderLevel !== undefined ? b.reorderLevel : row.reorderLevel, active: b.active !== undefined ? bool(b.active) : row.active, notes: b.notes !== undefined ? b.notes : row.notes, t: now(), id: req.params.id });
    audit({ userId: user.id, username: user.username }, 'PRODUCT_EDIT', { entity: 'product', entityId: req.params.id });
    ok(res, { updated: true });
  });
});

router.delete('/products/:id', (req, res) => {
  wrap(res, () => {
    const user = requirePermission(req, 'PRODUCT_DELETE');
    const db = openDb();
    const row = db.prepare('SELECT * FROM "Product" WHERE id=@id AND tenantId=@tenantId').get({ id: req.params.id, tenantId: 'default' });
    if (!row) throw ApiError('NOT_FOUND', 'المنتج غير موجود', 404);
    const force = req.query.force === 'true';
    const deleteSales = req.query.deleteSales === 'true';
    db.prepare('UPDATE "Product" SET active=0,updatedAt=@t WHERE id=@id').run({ id: req.params.id, t: now() });
    audit({ userId: user.id, username: user.username }, 'PRODUCT_DELETE', { entity: 'product', entityId: req.params.id });
    if (force) {
      return ok(res, { deactivated: true, forced: true, salesDeleted: deleteSales });
    }
    ok(res, { deactivated: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/inventory', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'INVENTORY_VIEW');
    const db = openDb();
    const { page, pageSize, skip, take } = pageParams(req);
    const q = req.query.q ? `%${req.query.q}%` : null;
    let where = 'WHERE p.tenantId=@tenantId AND p.active=1';
    const params = { tenantId: 'default' };
    if (q) { where += ' AND (p.nameAr LIKE @q OR p.sku LIKE @q OR p.barcode LIKE @q)'; params.q = q; }
    const total = db.prepare(`SELECT COUNT(*) as c FROM "Product" p ${where}`).get(params).c;
    const rows = db.prepare(`SELECT p.*, c.nameAr as categoryName FROM "Product" p LEFT JOIN "Category" c ON p.categoryId=c.id ${where} ORDER BY p.nameAr ASC LIMIT @take OFFSET @skip`).all({ ...params, take, skip });
    const ids = rows.map(p => p.id);
    const availMap = stockAvailableMap(db, ids, 'default');
    const totalMap = stockTotalMap(db, ids, 'default');
    ok(res, { items: rows.map(p => productRow(p, availMap, totalMap)), total, page, pageSize });
  });
});

router.get('/inventory/batches', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'INVENTORY_VIEW');
    const db = openDb();
    const { page, pageSize, skip, take } = pageParams(req, 20);
    const q = req.query.q ? `%${req.query.q.trim()}%` : null;
    const productId = req.query.productId;
    const filter = req.query.filter; // 'depleted' | 'active'
    const status = req.query.status;

    let where = 'WHERE b.tenantId=@tenantId';
    const params = { tenantId: 'default' };
    if (productId) { where += ' AND b.productId=@productId'; params.productId = productId; }
    if (status) { where += ' AND b.status=@status'; params.status = status; }
    if (q) {
      where += ' AND (p.nameAr LIKE @q OR p.nameEn LIKE @q OR p.sku LIKE @q OR b.batchNo LIKE @q)';
      params.q = q;
    }

    if (filter === 'depleted') {
      where += " AND b.quantity <= 0";
    } else if (filter === 'active') {
      where += " AND b.status='ACTIVE' AND b.quantity > 0";
    }

    const countSql = `SELECT COUNT(*) as c FROM "Batch" b JOIN "Product" p ON b.productId=p.id ${where}`;
    const total = db.prepare(countSql).get(params).c;

    const selectSql = `SELECT b.*, p.nameAr as productName, p.sku, s.name as supplierName, pu.invoiceNo as purchaseInvoiceNo
      FROM "Batch" b
      JOIN "Product" p ON b.productId=p.id
      LEFT JOIN "Supplier" s ON b.supplierId=s.id
      LEFT JOIN "Purchase" pu ON b.purchaseId=pu.id
      ${where}
      ORDER BY b.createdAt DESC, b.id DESC
      LIMIT @take OFFSET @skip`;

    const rows = db.prepare(selectSql).all({ ...params, take, skip });

    const statsActive = db.prepare("SELECT COUNT(*) as c FROM \"Batch\" WHERE tenantId=@tenantId AND status='ACTIVE' AND quantity > 0").get({ tenantId: 'default' }).c;
    const statsDepleted = db.prepare("SELECT COUNT(*) as c FROM \"Batch\" WHERE tenantId=@tenantId AND quantity <= 0").get({ tenantId: 'default' }).c;

    const items = rows.map(b => {
      return {
        id: b.id,
        productId: b.productId,
        productName: b.productName,
        sku: b.sku,
        batchNo: b.batchNo,
        expiryDate: null,
        daysLeft: null,
        quantity: b.quantity,
        costPrice: b.costPrice,
        status: b.status,
        supplierName: b.supplierName || null,
        purchaseInvoiceNo: b.purchaseInvoiceNo || null,
        createdAt: typeof b.createdAt === 'string' ? b.createdAt : new Date(b.createdAt).toISOString(),
      };
    });

    ok(res, {
      items,
      total,
      page,
      pageSize,
      warningDays: 0,
      stats: { expired: 0, near: 0, valid: statsActive, active: statsActive, depleted: statsDepleted },
    });
  });
});

router.get('/inventory/movements', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'INVENTORY_VIEW');
    const db = openDb();
    const { page, pageSize, skip, take } = pageParams(req);
    const productId = req.query.productId;
    const type = req.query.type;
    const range = dateRange(req);
    let where = 'WHERE sm.tenantId=@tenantId';
    const params = { tenantId: 'default' };
    if (productId) { where += ' AND sm.productId=@productId'; params.productId = productId; }
    if (type) { where += ' AND sm.type=@type'; params.type = type; }
    if (range) { where += ' AND sm.createdAt BETWEEN @from AND @to'; params.from = range.from; params.to = range.to; }
    const total = db.prepare(`SELECT COUNT(*) as c FROM "StockMovement" sm ${where}`).get(params).c;
    const rows = db.prepare(`SELECT sm.*, p.nameAr as productName, p.sku FROM "StockMovement" sm JOIN "Product" p ON sm.productId=p.id ${where} ORDER BY sm.createdAt DESC LIMIT @take OFFSET @skip`).all({ ...params, take, skip });
    ok(res, { items: rows, total, page, pageSize });
  });
});

router.post('/inventory/adjust', (req, res) => {
  wrap(res, () => {
    const user = requirePermission(req, 'INVENTORY_ADJUST');
    const { batchId, countedQty, type, reason } = req.body || {};
    if (!batchId || countedQty === undefined) throw ApiError('VALIDATION', 'batchId و countedQty مطلوبان', 400);
    if (countedQty < 0) throw ApiError('QTY_INVALID', 'الكمية لا يمكن أن تكون سالبة', 400);
    const adjType = type || 'ADJUSTMENT';
    const result = transaction((db) => {
      const batch = db.prepare('SELECT b.*, p.isWeighable, p.nameAr FROM "Batch" b JOIN "Product" p ON b.productId=p.id WHERE b.id=@id AND b.tenantId=@tenantId').get({ id: batchId, tenantId: 'default' });
      if (!batch) throw ApiError('NOT_FOUND', 'الباتش غير موجود', 404);
      const counted = Number(countedQty);
      const delta = r3(counted - batch.quantity);
      if (Math.abs(delta) < 1e-9) throw ApiError('NO_CHANGE', 'لا يوجد فرق', 400);
      const newStatus = counted === 0 ? 'DEPLETED' : batch.status === 'DEPLETED' ? 'ACTIVE' : batch.status;
      db.prepare('UPDATE "Batch" SET quantity=@qty,status=@status,updatedAt=@t WHERE id=@id').run({ qty: counted, status: newStatus, t: now(), id: batchId });
      db.prepare('INSERT INTO "StockMovement" (id,tenantId,productId,batchId,type,quantity,unitCost,note,userId,createdAt) VALUES (@id,@tenantId,@productId,@batchId,@type,@quantity,@unitCost,@note,@userId,@t)')
        .run({ id: newId(), tenantId: 'default', productId: batch.productId, batchId, type: adjType, quantity: delta, unitCost: batch.costPrice, note: reason || null, userId: user.id, t: now() });
      return { batchId, delta, newQty: counted };
    });
    audit({ userId: user.id, username: user.username }, 'INVENTORY_ADJUST', { entity: 'batch', entityId: batchId, metadata: { delta: result.delta, type: adjType } });
    ok(res, result);
  });
});

router.post('/inventory/expiry/sweep', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'INVENTORY_ADJUST');
    // Stationery store: products do not expire. Sweep is a safe no-op.
    ok(res, { swept: 0 });
  });
});

router.get('/inventory/stocktake', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'INVENTORY_VIEW');
    const db = openDb();
    const { page, pageSize, skip, take } = pageParams(req, 20);
    const total = db.prepare('SELECT COUNT(*) as c FROM "StocktakeSession" WHERE tenantId=@tenantId').get({ tenantId: 'default' }).c;
    const rows = db.prepare(`SELECT s.*, u.displayName as username,
      (SELECT COUNT(*) FROM "StocktakeLine" sl WHERE sl.sessionId=s.id) as linesCount
      FROM "StocktakeSession" s
      LEFT JOIN "User" u ON s.userId=u.id
      WHERE s.tenantId=@tenantId
      ORDER BY s.createdAt DESC
      LIMIT @take OFFSET @skip`).all({ tenantId: 'default', take, skip });

    const items = rows.map(s => ({
      id: s.id,
      name: s.name,
      status: s.status,
      linesCount: s.linesCount || 0,
      createdAt: typeof s.createdAt === 'string' ? s.createdAt : new Date(s.createdAt).toISOString(),
      appliedAt: s.appliedAt ? (typeof s.appliedAt === 'string' ? s.appliedAt : new Date(s.appliedAt).toISOString()) : null,
      username: s.username || null,
    }));
    ok(res, { items, total, page, pageSize });
  });
});

router.post('/inventory/stocktake', (req, res) => {
  wrap(res, () => {
    const user = requirePermission(req, 'STOCKTAKE_CREATE');
    const { name } = req.body || {};
    if (!name) throw ApiError('VALIDATION', 'اسم الجلسة مطلوب', 400);
    const result = transaction((db) => {
      const sessionId = newId();
      db.prepare('INSERT INTO "StocktakeSession" (id,tenantId,name,status,userId,createdAt) VALUES (@id,@tenantId,@name,\'OPEN\',@userId,@t)')
        .run({ id: sessionId, tenantId: 'default', name, userId: user.id, t: now() });
      const products = db.prepare('SELECT p.id, p.nameAr, b.id as batchId, b.batchNo, b.quantity FROM "Product" p LEFT JOIN "Batch" b ON p.id=b.productId AND b.quantity>0 AND b.tenantId=@tenantId WHERE p.tenantId=@tenantId AND p.active=1 ORDER BY p.nameAr ASC').all({ tenantId: 'default' });
      const byProduct = {};
      for (const row of products) {
        if (!byProduct[row.id]) byProduct[row.id] = { productId: row.id, nameAr: row.nameAr, systemQty: 0, batches: [] };
        if (row.batchId) { byProduct[row.id].systemQty = r3(byProduct[row.id].systemQty + row.quantity); byProduct[row.id].batches.push({ id: row.batchId, batchNo: row.batchNo, qty: row.quantity, expiryDate: null }); }
      }
      const lines = Object.values(byProduct);
      for (const line of lines) {
        db.prepare('INSERT INTO "StocktakeLine" (id,tenantId,sessionId,productId,systemQty,countedQty,difference) VALUES (@id,@tenantId,@sessionId,@productId,@systemQty,@countedQty,0)')
          .run({ id: newId(), tenantId: 'default', sessionId, productId: line.productId, systemQty: line.systemQty, countedQty: line.systemQty });
      }
      return { sessionId, lines };
    });
    ok(res, result, 201);
  });
});

router.get('/inventory/stocktake/:id', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'INVENTORY_VIEW');
    const db = openDb();
    const session = db.prepare('SELECT * FROM "StocktakeSession" WHERE id=@id AND tenantId=@tenantId').get({ id: req.params.id, tenantId: 'default' });
    if (!session) throw ApiError('NOT_FOUND', 'جلسة الجرد غير موجودة', 404);
    const lines = db.prepare(`SELECT sl.*, p.nameAr, p.sku, p.unit, p.isWeighable
      FROM "StocktakeLine" sl
      JOIN "Product" p ON sl.productId=p.id
      WHERE sl.sessionId=@sessionId`).all({ sessionId: req.params.id });

    const productIds = [...new Set(lines.map(l => l.productId))];
    const batchesMap = {};
    if (productIds.length > 0) {
      const bRows = db.prepare(`SELECT * FROM "Batch" WHERE productId IN (${productIds.map((_, i) => `@p${i}`).join(',')}) AND tenantId=@tenantId AND quantity > 0 ORDER BY createdAt ASC, id ASC`)
        .all({ ...Object.fromEntries(productIds.map((p, i) => [`p${i}`, p])), tenantId: 'default' });
      for (const b of bRows) {
        if (!batchesMap[b.productId]) batchesMap[b.productId] = [];
        batchesMap[b.productId].push({
          id: b.id,
          batchNo: b.batchNo,
          qty: b.quantity,
          expiryDate: null,
        });
      }
    }

    ok(res, {
      id: session.id,
      name: session.name,
      status: session.status,
      createdAt: typeof session.createdAt === 'string' ? session.createdAt : new Date(session.createdAt).toISOString(),
      appliedAt: session.appliedAt ? (typeof session.appliedAt === 'string' ? session.appliedAt : new Date(session.appliedAt).toISOString()) : null,
      lines: lines.map(l => {
        const pBatches = batchesMap[l.productId] || [];
        const currentQty = r3(pBatches.reduce((s, b) => s + b.qty, 0));
        return {
          productId: l.productId,
          nameAr: l.nameAr,
          sku: l.sku,
          unit: l.unit || 'piece',
          isWeighable: fromBool(l.isWeighable),
          systemQty: l.systemQty,
          countedQty: l.countedQty,
          difference: l.difference,
          currentQty,
          batches: pBatches,
        };
      }),
    });
  });
});

router.post('/inventory/stocktake/:id', (req, res) => {
  wrap(res, () => {
    const user = requirePermission(req, 'STOCKTAKE_CREATE');
    const { counted } = req.body || {};
    if (!Array.isArray(counted)) throw ApiError('VALIDATION', 'counted مطلوب', 400);
    const result = transaction((db) => {
      const session = db.prepare('SELECT * FROM "StocktakeSession" WHERE id=@id AND tenantId=@tenantId').get({ id: req.params.id, tenantId: 'default' });
      if (!session) throw ApiError('NOT_FOUND', 'جلسة الجرد غير موجودة', 404);
      if (session.status !== 'OPEN') throw ApiError('SESSION_CLOSED', 'الجلسة مغلقة', 409);
      let adjusted = 0;
      for (const line of counted) {
        const product = db.prepare('SELECT * FROM "Product" WHERE id=@id AND tenantId=@tenantId').get({ id: line.productId, tenantId: 'default' });
        if (!product) continue;
        const countedQty = r3(Number(line.countedQty) || 0);
        const batches = db.prepare('SELECT * FROM "Batch" WHERE productId=@productId AND tenantId=@tenantId AND quantity>0 ORDER BY createdAt ASC, id ASC').all({ productId: line.productId, tenantId: 'default' });
        const systemQty = r3(batches.reduce((s, b) => s + b.quantity, 0));
        const delta = r3(countedQty - systemQty);
        if (Math.abs(delta) < 1e-9) continue;
        adjusted++;
        if (delta < 0) {
          let remaining = r3(-delta);
          for (const batch of batches) {
            if (remaining <= 1e-9) break;
            const take = r3(Math.min(batch.quantity, remaining));
            const newQty = r3(batch.quantity - take);
            db.prepare('UPDATE "Batch" SET quantity=@qty,status=@status,updatedAt=@t WHERE id=@id').run({ qty: newQty, status: newQty <= 1e-9 ? 'DEPLETED' : batch.status, t: now(), id: batch.id });
            db.prepare('INSERT INTO "StockMovement" (id,tenantId,productId,batchId,type,quantity,unitCost,refType,refId,userId,createdAt) VALUES (@id,@tenantId,@productId,@batchId,\'STOCKTAKE\',@qty,@cost,\'stocktake\',@refId,@userId,@t)')
              .run({ id: newId(), tenantId: 'default', productId: line.productId, batchId: batch.id, qty: -take, cost: batch.costPrice, refId: req.params.id, userId: user.id, t: now() });
            remaining = r3(remaining - take);
          }
        } else {
          const lastBatch = batches[batches.length - 1];
          const bid = newId();
          db.prepare('INSERT INTO "Batch" (id,tenantId,productId,batchNo,quantity,costPrice,status,updatedAt) VALUES (@id,@tenantId,@productId,@batchNo,@qty,@cost,\'ACTIVE\',@t)')
            .run({ id: bid, tenantId: 'default', productId: line.productId, batchNo: `ST-${req.params.id.slice(-6).toUpperCase()}`, qty: delta, cost: (lastBatch && lastBatch.costPrice) || product.purchasePrice, t: now() });
          db.prepare('INSERT INTO "StockMovement" (id,tenantId,productId,batchId,type,quantity,unitCost,refType,refId,userId,createdAt) VALUES (@id,@tenantId,@productId,@batchId,\'STOCKTAKE\',@qty,@cost,\'stocktake\',@refId,@userId,@t)')
            .run({ id: newId(), tenantId: 'default', productId: line.productId, batchId: bid, qty: delta, cost: (lastBatch && lastBatch.costPrice) || product.purchasePrice, refId: req.params.id, userId: user.id, t: now() });
        }
        db.prepare('UPDATE "StocktakeLine" SET countedQty=@counted,difference=@diff WHERE sessionId=@sessionId AND productId=@productId')
          .run({ counted: countedQty, diff: delta, sessionId: req.params.id, productId: line.productId });
      }
      db.prepare("UPDATE \"StocktakeSession\" SET status='APPLIED',appliedAt=@t WHERE id=@id").run({ t: now(), id: req.params.id });
      return { adjusted };
    });
    audit({ userId: user.id, username: user.username }, 'STOCKTAKE_APPLY', { entity: 'stocktake', entityId: req.params.id, metadata: { adjusted: result.adjusted } });
    ok(res, result);
  });
});

router.delete('/inventory/stocktake/:id', (req, res) => {
  wrap(res, () => {
    const user = requirePermission(req, 'STOCKTAKE_CREATE');
    const db = openDb();
    const session = db.prepare('SELECT * FROM "StocktakeSession" WHERE id=@id AND tenantId=@tenantId').get({ id: req.params.id, tenantId: 'default' });
    if (!session) throw ApiError('NOT_FOUND', 'جلسة الجرد غير موجودة', 404);
    if (session.status !== 'OPEN') throw ApiError('SESSION_CLOSED', 'لا يمكن إلغاء جلسة مغلقة', 409);
    db.prepare("UPDATE \"StocktakeSession\" SET status='CANCELLED' WHERE id=@id").run({ id: req.params.id });
    audit({ userId: user.id, username: user.username }, 'STOCKTAKE_CANCEL', { entity: 'stocktakeSession', entityId: req.params.id, metadata: { name: session.name } });
    ok(res, { cancelled: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SALES
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/sales/suspended', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'SALES_VIEW');
    const db = openDb();
    const rows = db.prepare('SELECT * FROM "SuspendedCart" WHERE tenantId=@tenantId ORDER BY createdAt DESC').all({ tenantId: 'default' });
    ok(res, rows.map(r => ({ ...r, cart: safeJson(r.cart, []) })));
  });
});

router.post('/sales/suspended', (req, res) => {
  wrap(res, () => {
    const user = requirePermission(req, 'SALES_CREATE');
    const { label, cart } = req.body || {};
    if (!label || !cart) throw ApiError('VALIDATION', 'label و cart مطلوبان', 400);
    const db = openDb();
    const id = newId();
    db.prepare('INSERT INTO "SuspendedCart" (id,tenantId,label,cart,userId,createdAt) VALUES (@id,@tenantId,@label,@cart,@userId,@t)')
      .run({ id, tenantId: 'default', label, cart: JSON.stringify(cart), userId: user.id, t: now() });
    ok(res, { id, label }, 201);
  });
});

router.delete('/sales/suspended/:id', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'SALES_CREATE');
    const db = openDb();
    db.prepare('DELETE FROM "SuspendedCart" WHERE id=@id AND tenantId=@tenantId').run({ id: req.params.id, tenantId: 'default' });
    ok(res, { deleted: true });
  });
});

router.get('/sales', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'SALES_VIEW');
    const db = openDb();
    const { page, pageSize, skip, take } = pageParams(req);
    const q = req.query.q ? `%${req.query.q}%` : null;
    const status = req.query.status;
    const cashierId = req.query.cashierId;
    const paymentMethod = req.query.paymentMethod;
    const range = dateRange(req);
    const mode = req.query.mode;

    if (mode === 'cashiers') {
      const rows = db.prepare('SELECT DISTINCT s.cashierId, u.displayName FROM "Sale" s JOIN "User" u ON s.cashierId=u.id WHERE s.tenantId=@tenantId ORDER BY s.createdAt DESC').all({ tenantId: 'default' });
      return ok(res, rows.map(r => ({ id: r.cashierId, displayName: r.displayName })));
    }

    let where = 'WHERE s.tenantId=@tenantId';
    const params = { tenantId: 'default' };
    if (q) { where += ' AND (s.invoiceNo LIKE @q OR c.name LIKE @q)'; params.q = q; }
    if (status) { where += ' AND s.status IN (' + status.split(',').map((_, i) => `@s${i}`).join(',') + ')'; status.split(',').forEach((v, i) => { params[`s${i}`] = v.trim(); }); }
    if (cashierId) { where += ' AND s.cashierId=@cashierId'; params.cashierId = cashierId; }
    if (paymentMethod) { where += ' AND s.paymentMethod=@paymentMethod'; params.paymentMethod = paymentMethod; }
    if (range) { where += ' AND s.createdAt BETWEEN @from AND @to'; params.from = range.from; params.to = range.to; }

    const selectSql = `SELECT s.id, s.invoiceNo, s.createdAt, s.status, s.total, s.paidAmount, s.paymentMethod, u.displayName as cashierName, c.name as customerName, (SELECT COUNT(*) FROM "SaleItem" si WHERE si.saleId=s.id) as itemsCount FROM "Sale" s LEFT JOIN "User" u ON s.cashierId=u.id LEFT JOIN "Customer" c ON s.customerId=c.id ${where} ORDER BY s.createdAt DESC`;

    if (mode === 'recent') {
      const limit = Math.min(50, parseInt(req.query.limit || '8', 10) || 8);
      const rows = db.prepare(`${selectSql} LIMIT @limit`).all({ ...params, limit });
      return ok(res, rows);
    }

    const total = db.prepare(`SELECT COUNT(*) as c FROM "Sale" s LEFT JOIN "Customer" c ON s.customerId=c.id ${where}`).get(params).c;
    const rows = db.prepare(`${selectSql} LIMIT @take OFFSET @skip`).all({ ...params, take, skip });
    ok(res, { items: rows, total, page, pageSize });
  });
});

function buildReceipt(db, saleId, tenantId = 'default') {
  const sale = db.prepare('SELECT s.*, u.displayName as cashierName, c.name as customerName, c.phone as customerPhone FROM "Sale" s LEFT JOIN "User" u ON s.cashierId=u.id LEFT JOIN "Customer" c ON s.customerId=c.id WHERE s.id=@id AND s.tenantId=@tenantId').get({ id: saleId, tenantId });
  if (!sale) return null;

  const rawItems = db.prepare('SELECT * FROM "SaleItem" WHERE saleId=@saleId AND tenantId=@tenantId ORDER BY rowid ASC').all({ saleId, tenantId });

  const byProduct = new Map();
  for (const item of rawItems) {
    const key = `${item.productId}|${item.unitPrice}|${r2(item.discount / Math.max(item.quantity, 1e-9))}`;
    let line = byProduct.get(key);
    if (!line) {
      line = {
        productName: item.productName,
        batchNo: item.batchNo,
        quantity: 0,
        unitPrice: item.unitPrice,
        discount: 0,
        total: 0,
        allocations: [],
      };
      byProduct.set(key, line);
    }
    line.quantity = r3(line.quantity + item.quantity);
    line.discount = r2(line.discount + item.discount);
    line.total = r2(line.total + item.total);
    line.allocations.push({
      batchNo: item.batchNo,
      expiry: null,
      qty: item.quantity,
    });
  }

  let loyalty = null;
  const lEvents = db.prepare('SELECT * FROM "LoyaltyEvent" WHERE saleId=@saleId').all({ saleId });
  if (lEvents.length > 0 && sale.customerId) {
    const redeemed = lEvents.find(e => e.type === 'REDEEM');
    const earned = lEvents.find(e => e.type === 'EARN');
    const balRow = db.prepare('SELECT COALESCE(SUM(points),0) as b FROM "LoyaltyEvent" WHERE customerId=@cid').get({ cid: sale.customerId });
    loyalty = {
      redeemedPoints: redeemed ? Math.abs(redeemed.points) : 0,
      redeemedValue: redeemed ? r2(redeemed.value) : 0,
      earnedPoints: earned ? earned.points : 0,
      newBalance: balRow ? balRow.b : 0,
    };
  }

  return {
    saleId: sale.id,
    invoiceNo: sale.invoiceNo,
    createdAt: typeof sale.createdAt === 'string' ? sale.createdAt : new Date(sale.createdAt).toISOString(),
    cashierName: sale.cashierName || '—',
    customerName: sale.customerName || null,
    items: Array.from(byProduct.values()),
    subtotal: sale.subtotal,
    discount: sale.discount,
    tax: sale.tax,
    total: sale.total,
    paidAmount: sale.paidAmount,
    changeAmount: sale.changeAmount,
    paymentMethod: sale.paymentMethod,
    loyalty,
  };
}

router.post('/sales', (req, res) => {
  wrap(res, () => {
    const user = requirePermission(req, 'SALES_CREATE');
    const body = req.body || {};
    const items = body.items || [];
    if (!items.length) throw ApiError('EMPTY_CART', 'الفاتورة فارغة', 400);
    const settings = getSettings('default');
    const posConfig = settings.pos || {};
    const loyaltyCfg = {
      enabled: posConfig.loyalty ? posConfig.loyalty.enabled !== false : true,
      earnRatePer100: (posConfig.loyalty && posConfig.loyalty.earnRatePer100) || 1,
      pointValueEgp: (posConfig.loyalty && posConfig.loyalty.pointValueEgp) || 0.1,
      maxRedeemShare: (posConfig.loyalty && posConfig.loyalty.maxRedeemShare) || 0.5,
      minRedeemPoints: (posConfig.loyalty && posConfig.loyalty.minRedeemPoints) || 10,
    };
    const redeemRequest = body.redeemPoints && body.redeemPoints > 0 ? Math.round(Number(body.redeemPoints)) : 0;

    const result = transaction((db) => {
      // Resolve products
      const productIds = [...new Set(items.map(i => i.productId))];
      const products = db.prepare(`SELECT p.*, c.nameAr as categoryName FROM "Product" p LEFT JOIN "Category" c ON p.categoryId=c.id WHERE p.id IN (${productIds.map((_, i) => `@p${i}`).join(',')}) AND p.tenantId=@tenantId`).all({ tenantId: 'default', ...Object.fromEntries(productIds.map((id, i) => [`p${i}`, id])) });
      const productMap = {};
      for (const p of products) productMap[p.id] = p;

      // Merge duplicate lines
      const merged = {};
      for (const item of items) {
        const p = productMap[item.productId];
        if (!p) throw ApiError('NOT_FOUND', 'صنف غير موجود في الفاتورة', 404);
        if (!fromBool(p.active)) throw ApiError('PRODUCT_INACTIVE', `الصنف ${p.nameAr} غير نشط`, 409);
        const qty = Number(item.quantity) || 0;
        if (qty <= 0) throw ApiError('QTY_INVALID', 'الكمية يجب أن تكون أكبر من صفر', 400);
        if (merged[item.productId]) merged[item.productId].quantity = r3(merged[item.productId].quantity + qty);
        else merged[item.productId] = { ...item, quantity: qty };
      }

      // Calculate totals
      let subtotal = 0, totalTax = 0;
      const lineRows = [];

      for (const item of Object.values(merged)) {
        const p = productMap[item.productId];
        const unitPrice = r2(item.unitPrice !== undefined ? Number(item.unitPrice) : p.sellingPrice);
        const lineDiscount = r2(Math.max(0, item.discount || 0));
        const lineGross = r2(unitPrice * item.quantity);
        const lineTotal = r2(lineGross - lineDiscount);
        const taxAmount = r2((lineTotal * (p.taxRate || 0)) / 100);
        subtotal = r2(subtotal + lineGross);
        totalTax = r2(totalTax + taxAmount);

        // FIFO allocation (oldest batch first by createdAt, then id tie-breaker)
        const batches = db.prepare(`SELECT * FROM "Batch" WHERE productId=@productId AND tenantId=@tenantId AND status='ACTIVE' AND quantity>0 ORDER BY createdAt ASC, id ASC`).all({ productId: item.productId, tenantId: 'default' });
        const allocations = [];
        let remaining = item.quantity;
        for (const batch of batches) {
          if (remaining <= 1e-9) break;
          const take = r3(Math.min(batch.quantity, remaining));
          if (take <= 0) continue;
          allocations.push({ batchId: batch.id, batchNo: batch.batchNo, expiryDate: null, qty: take, costPrice: batch.costPrice });
          remaining = r3(remaining - take);
        }
        if (remaining > 1e-9) {
          const available = r3(batches.reduce((s, b) => s + b.quantity, 0));
          throw ApiError('INSUFFICIENT_STOCK', `الكمية المطلوبة غير متاحة — المتاح ${available} وحدة من ${p.nameAr}`, 409);
        }
        lineRows.push({ productId: item.productId, productName: p.nameAr, quantity: item.quantity, unitPrice, discount: lineDiscount, total: lineTotal, taxAmount, allocations });
      }

      const invoiceDiscount = r2(Math.max(0, body.discount || 0));
      if (invoiceDiscount > r2(subtotal + totalTax)) throw ApiError('DISCOUNT_TOO_LARGE', 'خصم الفاتورة أكبر من قيمتها', 400);

      // Validate customer
      if (body.customerId) {
        const cust = db.prepare('SELECT id FROM "Customer" WHERE id=@id AND tenantId=@tenantId').get({ id: body.customerId, tenantId: 'default' });
        if (!cust) throw ApiError('NOT_FOUND', 'العميل غير موجود', 404);
      }

      // Loyalty redemption
      let loyaltyDiscount = 0;
      if (redeemRequest > 0) {
        if (!body.customerId) throw ApiError('LOYALTY_NO_CUSTOMER', 'استبدال النقاط يتطلب اختيار عميل', 400);
        const balanceRow = db.prepare('SELECT COALESCE(SUM(points),0) as b FROM "LoyaltyEvent" WHERE customerId=@customerId').get({ customerId: body.customerId });
        const balance = balanceRow ? balanceRow.b : 0;
        const totalBefore = r2(subtotal - invoiceDiscount + totalTax);
        const cap = Math.max(0, Math.floor((totalBefore * loyaltyCfg.maxRedeemShare) / loyaltyCfg.pointValueEgp));
        if (redeemRequest > cap || redeemRequest > balance) throw ApiError('POINTS_CAP', `نقاط غير كافية أو تتجاوز الحد المسموح`, 409);
        loyaltyDiscount = r2(redeemRequest * loyaltyCfg.pointValueEgp);
      }

      const total = r2(subtotal - invoiceDiscount - loyaltyDiscount + totalTax);
      const paidAmount = r2(Number(body.paidAmount) || 0);
      if (paidAmount < total - 1e-9) throw ApiError('INSUFFICIENT_PAID', 'المبلغ المدفوع أقل من الإجمالي', 400);

      // Ensure cashier exists
      let cashierId = user.id;
      const cashierExists = db.prepare('SELECT id FROM "User" WHERE id=@id').get({ id: user.id });
      if (!cashierExists) {
        const anyUser = db.prepare('SELECT id FROM "User" WHERE tenantId=@tenantId AND active=1').get({ tenantId: 'default' });
        cashierId = anyUser ? anyUser.id : user.id;
      }

      const invoiceNo = nextDocNo(db, 'default', 'sale', 'INV');
      const saleId = newId();
      db.prepare('INSERT INTO "Sale" (id,tenantId,invoiceNo,cashierId,customerId,status,subtotal,discount,tax,total,paidAmount,changeAmount,paymentMethod,notes,updatedAt) VALUES (@id,@tenantId,@invoiceNo,@cashierId,@customerId,\'COMPLETED\',@subtotal,@discount,@tax,@total,@paidAmount,@changeAmount,@paymentMethod,@notes,@t)')
        .run({ id: saleId, tenantId: 'default', invoiceNo, cashierId, customerId: body.customerId || null, subtotal, discount: invoiceDiscount, tax: totalTax, total, paidAmount, changeAmount: r2(paidAmount - total), paymentMethod: body.paymentMethod || 'cash', notes: body.notes || null, t: now() });

      // Create sale items + update batches + stock movements
      for (const line of lineRows) {
        for (const alloc of line.allocations) {
          const siId = newId();
          const allocDiscount = r2((line.discount / line.quantity) * alloc.qty);
          const allocTotal = r2(line.unitPrice * alloc.qty - allocDiscount);
          db.prepare('INSERT INTO "SaleItem" (id,tenantId,saleId,productId,batchId,batchNo,expiryDate,productName,quantity,unitPrice,discount,total,costPrice) VALUES (@id,@tenantId,@saleId,@productId,@batchId,@batchNo,@expiryDate,@productName,@quantity,@unitPrice,@discount,@total,@costPrice)')
            .run({ id: siId, tenantId: 'default', saleId, productId: line.productId, batchId: alloc.batchId, batchNo: alloc.batchNo, expiryDate: null, productName: line.productName, quantity: alloc.qty, unitPrice: line.unitPrice, discount: allocDiscount, total: allocTotal, costPrice: alloc.costPrice });
          // Decrement batch
          const batch = db.prepare('SELECT * FROM "Batch" WHERE id=@id').get({ id: alloc.batchId });
          const newQty = r3(batch.quantity - alloc.qty);
          db.prepare('UPDATE "Batch" SET quantity=@qty,status=@status,updatedAt=@t WHERE id=@id').run({ qty: Math.max(0, newQty), status: newQty <= 1e-9 ? 'DEPLETED' : batch.status, t: now(), id: alloc.batchId });
          db.prepare('INSERT INTO "StockMovement" (id,tenantId,productId,batchId,type,quantity,unitCost,refType,refId,userId,createdAt) VALUES (@id,@tenantId,@productId,@batchId,\'SALE\',@quantity,@unitCost,\'sale\',@refId,@userId,@t)')
            .run({ id: newId(), tenantId: 'default', productId: line.productId, batchId: alloc.batchId, quantity: -r3(alloc.qty), unitCost: alloc.costPrice, refId: saleId, userId: user.id, t: now() });
        }
      }

      // Loyalty
      if (redeemRequest > 0 && body.customerId) {
        db.prepare('INSERT INTO "LoyaltyEvent" (id,tenantId,customerId,saleId,type,points,value,note,userId,createdAt) VALUES (@id,@tenantId,@customerId,@saleId,\'REDEEM\',@points,@value,@note,@userId,@t)')
          .run({ id: newId(), tenantId: 'default', customerId: body.customerId, saleId, points: -redeemRequest, value: loyaltyDiscount, note: `استبدال ${redeemRequest} نقطة`, userId: user.id, t: now() });
      }
      if (loyaltyCfg.enabled && body.customerId && total > 0) {
        const earnedPoints = Math.floor((total / 100) * loyaltyCfg.earnRatePer100);
        if (earnedPoints > 0) {
          db.prepare('INSERT OR IGNORE INTO "LoyaltyEvent" (id,tenantId,customerId,saleId,type,points,value,note,userId,createdAt) VALUES (@id,@tenantId,@customerId,@saleId,\'EARN\',@points,0,@note,@userId,@t)')
            .run({ id: newId(), tenantId: 'default', customerId: body.customerId, saleId, points: earnedPoints, note: `نقاط مكتسبة`, userId: user.id, t: now() });
        }
      }
      const receipt = buildReceipt(db, saleId, 'default');
      return { saleId, invoiceNo, total, paidAmount, changeAmount: r2(paidAmount - total), receipt };
    });

    audit({ userId: user.id, username: user.username }, 'SALE_CREATE', { entity: 'sale', entityId: result.saleId, metadata: { invoiceNo: result.invoiceNo, total: result.total } });
    ok(res, result, 201);
  });
});

router.get('/sales/:id', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'SALES_VIEW');
    const db = openDb();
    const sale = db.prepare('SELECT s.*, u.displayName as cashierName, c.name as customerName, c.phone as customerPhone FROM "Sale" s LEFT JOIN "User" u ON s.cashierId=u.id LEFT JOIN "Customer" c ON s.customerId=c.id WHERE s.id=@id AND s.tenantId=@tenantId').get({ id: req.params.id, tenantId: 'default' });
    if (!sale) throw ApiError('NOT_FOUND', 'الفاتورة غير موجودة', 404);
    const items = db.prepare('SELECT si.*, p.sku FROM "SaleItem" si JOIN "Product" p ON si.productId=p.id WHERE si.saleId=@saleId').all({ saleId: req.params.id });
    const receipt = buildReceipt(db, sale.id, 'default');
    ok(res, {
      sale: {
        id: sale.id,
        invoiceNo: sale.invoiceNo,
        createdAt: typeof sale.createdAt === 'string' ? sale.createdAt : new Date(sale.createdAt).toISOString(),
        status: sale.status,
        subtotal: sale.subtotal,
        discount: sale.discount,
        tax: sale.tax,
        total: sale.total,
        paidAmount: sale.paidAmount,
        changeAmount: sale.changeAmount,
        paymentMethod: sale.paymentMethod,
        notes: sale.notes,
        cashierName: sale.cashierName || '—',
        customerName: sale.customerName || null,
        customerPhone: sale.customerPhone || null,
        items: items.map(i => ({
          id: i.id,
          productName: i.productName,
          batchNo: i.batchNo,
          expiryDate: null,
          quantity: i.quantity,
          returnedQty: i.returnedQty || 0,
          unitPrice: i.unitPrice,
          discount: i.discount || 0,
          total: i.total,
        })),
      },
      receipt,
    });
  });
});

router.post('/sales/:id/cancel', (req, res) => {
  wrap(res, () => {
    const user = requirePermission(req, 'SALES_CANCEL');
    const { reason } = req.body || {};
    transaction((db) => {
      const sale = db.prepare('SELECT s.*, (SELECT json_group_array(json_object(\'id\',si.id,\'productId\',si.productId,\'batchId\',si.batchId,\'quantity\',si.quantity,\'returnedQty\',si.returnedQty,\'costPrice\',si.costPrice)) FROM "SaleItem" si WHERE si.saleId=s.id) as itemsJson FROM "Sale" s WHERE s.id=@id AND s.tenantId=@tenantId').get({ id: req.params.id, tenantId: 'default' });
      if (!sale) throw ApiError('NOT_FOUND', 'الفاتورة غير موجودة', 404);
      if (sale.status === 'CANCELLED') throw ApiError('ALREADY_CANCELLED', 'الفاتورة ملغاة بالفعل', 409);
      const saleItems = safeJson(sale.itemsJson, []);
      for (const item of saleItems) {
        const returnable = r3((item.quantity || 0) - (item.returnedQty || 0));
        if (returnable <= 1e-9 || !item.batchId) continue;
        const batch = db.prepare('SELECT * FROM "Batch" WHERE id=@id').get({ id: item.batchId });
        if (!batch) continue;
        const newQty = r3(batch.quantity + returnable);
        db.prepare('UPDATE "Batch" SET quantity=@qty,status=\'ACTIVE\',updatedAt=@t WHERE id=@id').run({ qty: newQty, t: now(), id: item.batchId });
        db.prepare('INSERT INTO "StockMovement" (id,tenantId,productId,batchId,type,quantity,unitCost,refType,refId,note,userId,createdAt) VALUES (@id,@tenantId,@productId,@batchId,\'SALE_CANCEL_RESTOCK\',@quantity,@unitCost,\'sale_cancel\',@refId,@note,@userId,@t)')
          .run({ id: newId(), tenantId: 'default', productId: item.productId, batchId: item.batchId, quantity: returnable, unitCost: item.costPrice, refId: req.params.id, note: reason || null, userId: user.id, t: now() });
      }
      // Reverse loyalty
      if (sale.customerId) {
        const events = db.prepare('SELECT * FROM "LoyaltyEvent" WHERE saleId=@saleId').all({ saleId: req.params.id });
        for (const ev of events) {
          db.prepare('INSERT INTO "LoyaltyEvent" (id,tenantId,customerId,type,points,value,note,userId,createdAt) VALUES (@id,@tenantId,@customerId,\'ADJUST\',@points,@value,@note,@userId,@t)')
            .run({ id: newId(), tenantId: 'default', customerId: ev.customerId, points: -ev.points, value: ev.value, note: `عكس إلغاء فاتورة`, userId: user.id, t: now() });
        }
      }
      db.prepare("UPDATE \"Sale\" SET status='CANCELLED',updatedAt=@t WHERE id=@id").run({ t: now(), id: req.params.id });
    });
    audit({ userId: user.id, username: user.username }, 'SALE_CANCEL', { entity: 'sale', entityId: req.params.id, metadata: { reason } });
    ok(res, { cancelled: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PURCHASES
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/purchases', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'PURCHASE_VIEW');
    const db = openDb();
    const { page, pageSize, skip, take } = pageParams(req);
    const q = req.query.q ? `%${req.query.q}%` : null;
    const status = req.query.status;
    const paymentStatus = req.query.paymentStatus;
    const supplierId = req.query.supplierId;
    const range = dateRange(req);
    let where = 'WHERE pu.tenantId=@tenantId';
    const params = { tenantId: 'default' };
    if (q) { where += ' AND (pu.invoiceNo LIKE @q OR s.name LIKE @q)'; params.q = q; }
    if (status) { where += ' AND pu.status=@status'; params.status = status; }
    if (paymentStatus) { where += ' AND pu.paymentStatus=@paymentStatus'; params.paymentStatus = paymentStatus; }
    if (supplierId) { where += ' AND pu.supplierId=@supplierId'; params.supplierId = supplierId; }
    if (range) { where += ' AND pu.createdAt BETWEEN @from AND @to'; params.from = range.from; params.to = range.to; }
    const total = db.prepare(`SELECT COUNT(*) as c FROM "Purchase" pu JOIN "Supplier" s ON pu.supplierId=s.id ${where}`).get(params).c;
    const rows = db.prepare(`SELECT pu.*, s.name as supplierName, (SELECT COUNT(*) FROM "PurchaseItem" pi WHERE pi.purchaseId=pu.id) as itemsCount FROM "Purchase" pu JOIN "Supplier" s ON pu.supplierId=s.id ${where} ORDER BY pu.createdAt DESC LIMIT @take OFFSET @skip`).all({ ...params, take, skip });
    ok(res, { items: rows, total, page, pageSize });
  });
});

router.post('/purchases', (req, res) => {
  wrap(res, () => {
    const user = requirePermission(req, 'PURCHASE_CREATE');
    const { supplierId, items, discount, tax, paidAmount, notes, receiveNow } = req.body || {};
    if (!supplierId || !Array.isArray(items) || !items.length) throw ApiError('VALIDATION', 'supplierId و items مطلوبان', 400);
    const result = transaction((db) => {
      const supplier = db.prepare('SELECT * FROM "Supplier" WHERE id=@id AND tenantId=@tenantId').get({ id: supplierId, tenantId: 'default' });
      if (!supplier) throw ApiError('NOT_FOUND', 'المورد غير موجود', 404);
      let subtotal = 0;
      const validated = [];
      for (const item of items) {
        if (!item.productId || !item.quantity || item.quantity <= 0) throw ApiError('VALIDATION', 'بيانات البند غير صالحة', 400);
        const product = db.prepare('SELECT * FROM "Product" WHERE id=@id AND tenantId=@tenantId').get({ id: item.productId, tenantId: 'default' });
        if (!product) throw ApiError('NOT_FOUND', 'صنف غير موجود', 404);
        const qty = r3(Number(item.quantity));
        const unitCost = r2(Number(item.unitCost || 0));
        subtotal = r2(subtotal + qty * unitCost);
        validated.push({ item, product, qty, unitCost });
      }
      const disc = r2(Math.max(0, Number(discount || 0)));
      const taxAmt = r2(Math.max(0, Number(tax || 0)));
      const total = r2(subtotal - disc + taxAmt);
      const paid = r2(Math.max(0, Number(paidAmount || 0)));
      const payStatus = paid >= total && total > 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID';
      const invoiceNo = nextDocNo(db, 'default', 'purchase', 'PUR');
      const purchaseId = newId();
      db.prepare('INSERT INTO "Purchase" (id,tenantId,invoiceNo,supplierId,status,subtotal,discount,tax,total,paidAmount,paymentStatus,notes,userId,updatedAt) VALUES (@id,@tenantId,@invoiceNo,@supplierId,\'DRAFT\',@subtotal,@discount,@tax,@total,@paidAmount,@paymentStatus,@notes,@userId,@t)')
        .run({ id: purchaseId, tenantId: 'default', invoiceNo, supplierId, subtotal, discount: disc, tax: taxAmt, total, paidAmount: paid, paymentStatus: payStatus, notes: notes || null, userId: user.id, t: now() });
      for (const v of validated) {
        db.prepare('INSERT INTO "PurchaseItem" (id,tenantId,purchaseId,productId,batchNo,expiryDate,quantity,unitCost,total) VALUES (@id,@tenantId,@purchaseId,@productId,@batchNo,@expiryDate,@quantity,@unitCost,@total)')
          .run({ id: newId(), tenantId: 'default', purchaseId, productId: v.item.productId, batchNo: v.item.batchNo || null, expiryDate: null, quantity: v.qty, unitCost: v.unitCost, total: r2(v.qty * v.unitCost) });
      }
      if (receiveNow) {
        // Receive immediately
        _receivePurchase(db, user, purchaseId, 'default');
        return { purchaseId, invoiceNo, status: 'RECEIVED' };
      }
      return { purchaseId, invoiceNo, status: 'DRAFT' };
    });
    audit({ userId: user.id, username: user.username }, 'PURCHASE_CREATE', { entity: 'purchase', entityId: result.purchaseId, metadata: { invoiceNo: result.invoiceNo } });
    ok(res, result, 201);
  });
});

function _receivePurchase(db, user, purchaseId, tenantId) {
  const purchase = db.prepare('SELECT * FROM "Purchase" WHERE id=@id AND tenantId=@tenantId').get({ id: purchaseId, tenantId });
  if (!purchase) throw ApiError('NOT_FOUND', 'فاتورة الشراء غير موجودة', 404);
  if (purchase.status === 'RECEIVED') throw ApiError('ALREADY_RECEIVED', 'تم استلام هذه الفاتورة بالفعل', 409);
  if (purchase.status === 'CANCELLED') throw ApiError('CANCELLED', 'هذه الفاتورة ملغاة', 409);
  const items = db.prepare('SELECT * FROM "PurchaseItem" WHERE purchaseId=@purchaseId').all({ purchaseId });
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const product = db.prepare('SELECT * FROM "Product" WHERE id=@id AND tenantId=@tenantId').get({ id: item.productId, tenantId });
    if (!product) throw ApiError('NOT_FOUND', 'صنف غير موجود', 404);
    const batchNo = (item.batchNo && item.batchNo.trim()) || `AUTO-${purchase.invoiceNo}-${i + 1}`;
    const existing = db.prepare('SELECT * FROM "Batch" WHERE productId=@productId AND batchNo=@batchNo AND tenantId=@tenantId').get({ productId: item.productId, batchNo, tenantId });
    let batchId;
    if (existing) {
      const newQty = r3(existing.quantity + item.quantity);
      db.prepare('UPDATE "Batch" SET quantity=@qty,costPrice=@cost,status=\'ACTIVE\',supplierId=@supplierId,purchaseId=@purchaseId,updatedAt=@t WHERE id=@id').run({ qty: newQty, cost: item.unitCost, supplierId: purchase.supplierId, purchaseId, t: now(), id: existing.id });
      batchId = existing.id;
    } else {
      batchId = newId();
      db.prepare('INSERT INTO "Batch" (id,tenantId,productId,batchNo,expiryDate,quantity,costPrice,sellPrice,supplierId,purchaseId,status,updatedAt) VALUES (@id,@tenantId,@productId,@batchNo,@expiryDate,@quantity,@costPrice,@sellPrice,@supplierId,@purchaseId,\'ACTIVE\',@t)')
        .run({ id: batchId, tenantId, productId: item.productId, batchNo, expiryDate: null, quantity: item.quantity, costPrice: item.unitCost, sellPrice: product.sellingPrice, supplierId: purchase.supplierId, purchaseId, t: now() });
    }
    db.prepare('INSERT INTO "StockMovement" (id,tenantId,productId,batchId,type,quantity,unitCost,refType,refId,userId,createdAt) VALUES (@id,@tenantId,@productId,@batchId,\'PURCHASE_RECEIVE\',@quantity,@unitCost,\'purchase\',@refId,@userId,@t)')
      .run({ id: newId(), tenantId, productId: item.productId, batchId, quantity: item.quantity, unitCost: item.unitCost, refId: purchaseId, userId: user.id, t: now() });
    db.prepare('UPDATE "PurchaseItem" SET receivedQty=@qty,batchId=@batchId WHERE id=@id').run({ qty: item.quantity, batchId, id: item.id });
    const currentStockRow = db.prepare('SELECT COALESCE(SUM(quantity),0) as q FROM "Batch" WHERE productId=@productId AND tenantId=@tenantId AND status=\'ACTIVE\' AND quantity>0').get({ productId: item.productId, tenantId });
    const currentStock = currentStockRow ? currentStockRow.q : 0;
    const oldProdCost = product.purchasePrice || 0;
    const totalCombined = r3(currentStock + item.quantity);
    const prodWac = totalCombined > 0 ? r2(((currentStock * oldProdCost) + (item.quantity * item.unitCost)) / totalCombined) : item.unitCost;
    db.prepare('UPDATE "Product" SET purchasePrice=@cost,updatedAt=@t WHERE id=@id AND tenantId=@tenantId').run({ cost: prodWac, t: now(), id: item.productId, tenantId });
  }
  db.prepare("UPDATE \"Purchase\" SET status='RECEIVED',receivedAt=@t,updatedAt=@t WHERE id=@id").run({ t: now(), id: purchaseId });
}

router.get('/purchases/:id', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'PURCHASE_VIEW');
    const db = openDb();
    const purchase = db.prepare('SELECT pu.*, s.name as supplierName, s.phone as supplierPhone FROM "Purchase" pu JOIN "Supplier" s ON pu.supplierId=s.id WHERE pu.id=@id AND pu.tenantId=@tenantId').get({ id: req.params.id, tenantId: 'default' });
    if (!purchase) throw ApiError('NOT_FOUND', 'فاتورة الشراء غير موجودة', 404);
    const items = db.prepare('SELECT pi.*, p.nameAr as productName, p.sku, p.unit FROM "PurchaseItem" pi JOIN "Product" p ON pi.productId=p.id WHERE pi.purchaseId=@purchaseId').all({ purchaseId: req.params.id });
    ok(res, {
      ...purchase,
      supplier: { id: purchase.supplierId, name: purchase.supplierName, phone: purchase.supplierPhone || null },
      notes: purchase.notes || null,
      items: items.map(i => ({
        id: i.id,
        productName: i.productName,
        sku: i.sku,
        unit: i.unit || 'piece',
        batchNo: i.batchNo || null,
        expiryDate: null,
        quantity: i.quantity,
        unitCost: i.unitCost,
        total: i.total,
        receivedQty: i.receivedQty || 0,
        batchId: i.batchId || null,
      })),
    });
  });
});

router.post('/purchases/:id/receive', (req, res) => {
  wrap(res, () => {
    const user = requirePermission(req, 'PURCHASE_RECEIVE');
    transaction((db) => { _receivePurchase(db, user, req.params.id, 'default'); });
    audit({ userId: user.id, username: user.username }, 'PURCHASE_RECEIVE', { entity: 'purchase', entityId: req.params.id });
    ok(res, { received: true });
  });
});

router.post('/purchases/:id/pay', (req, res) => {
  wrap(res, () => {
    const user = requirePermission(req, 'PURCHASE_CREATE');
    const { amount } = req.body || {};
    const db = openDb();
    const purchase = db.prepare('SELECT * FROM "Purchase" WHERE id=@id AND tenantId=@tenantId').get({ id: req.params.id, tenantId: 'default' });
    if (!purchase) throw ApiError('NOT_FOUND', 'فاتورة الشراء غير موجودة', 404);
    if (purchase.status === 'CANCELLED') throw ApiError('CANCELLED', 'الفاتورة ملغاة', 409);
    const remaining = r2(Math.max(0, purchase.total - purchase.paidAmount));
    if (remaining <= 0) throw ApiError('ALREADY_PAID', 'الفاتورة مسددة بالكامل', 400);
    const payAmount = amount && amount > 0 ? r2(Number(amount)) : remaining;
    const newPaid = r2(Math.min(purchase.total, purchase.paidAmount + payAmount));
    const payStatus = newPaid >= purchase.total ? 'PAID' : 'PARTIAL';
    db.prepare('UPDATE "Purchase" SET paidAmount=@paid,paymentStatus=@status,updatedAt=@t WHERE id=@id').run({ paid: newPaid, status: payStatus, t: now(), id: req.params.id });
    audit({ userId: user.id, username: user.username }, 'PURCHASE_PAY', { entity: 'purchase', entityId: req.params.id, metadata: { newPaid, payStatus } });
    ok(res, { purchaseId: req.params.id, paidAmount: newPaid, paymentStatus: payStatus });
  });
});

router.post('/purchases/:id/cancel', (req, res) => {
  wrap(res, () => {
    const user = requirePermission(req, 'PURCHASE_CREATE');
    const db = openDb();
    const purchase = db.prepare('SELECT * FROM "Purchase" WHERE id=@id AND tenantId=@tenantId').get({ id: req.params.id, tenantId: 'default' });
    if (!purchase) throw ApiError('NOT_FOUND', 'فاتورة الشراء غير موجودة', 404);
    if (purchase.status === 'RECEIVED') throw ApiError('CANNOT_CANCEL', 'لا يمكن إلغاء فاتورة مستلمة', 409);
    if (purchase.status === 'CANCELLED') throw ApiError('ALREADY_CANCELLED', 'الفاتورة ملغاة بالفعل', 409);
    db.prepare("UPDATE \"Purchase\" SET status='CANCELLED',updatedAt=@t WHERE id=@id").run({ t: now(), id: req.params.id });
    audit({ userId: user.id, username: user.username }, 'PURCHASE_CANCEL', { entity: 'purchase', entityId: req.params.id });
    ok(res, { cancelled: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RETURNS
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/returns', (req, res) => {
  wrap(res, () => {
    const saleInvoice = typeof req.query.saleInvoice === 'string' ? req.query.saleInvoice.trim() : null;
    const saleId = typeof req.query.saleId === 'string' ? req.query.saleId.trim() : null;

    const db = openDb();
    if (saleInvoice || saleId) {
      requirePermission(req, 'SALES_RETURN');
      const sale = db.prepare(saleInvoice
        ? 'SELECT s.*, u.displayName as cashierName, c.name as customerName FROM "Sale" s LEFT JOIN "User" u ON s.cashierId=u.id LEFT JOIN "Customer" c ON s.customerId=c.id WHERE s.invoiceNo=@inv AND s.tenantId=@tenantId'
        : 'SELECT s.*, u.displayName as cashierName, c.name as customerName FROM "Sale" s LEFT JOIN "User" u ON s.cashierId=u.id LEFT JOIN "Customer" c ON s.customerId=c.id WHERE s.id=@id AND s.tenantId=@tenantId'
      ).get(saleInvoice ? { inv: saleInvoice, tenantId: 'default' } : { id: saleId, tenantId: 'default' });

      if (!sale) throw ApiError('NOT_FOUND', 'لم يتم العثور على فاتورة بهذا الرقم', 404);
      if (sale.status === 'CANCELLED') throw ApiError('SALE_CANCELLED', 'لا يمكن عمل مرتجع لفاتورة ملغاة', 409);

      const items = db.prepare('SELECT * FROM "SaleItem" WHERE saleId=@saleId AND tenantId=@tenantId ORDER BY rowid ASC').all({ saleId: sale.id, tenantId: 'default' });

      return ok(res, {
        sale: {
          id: sale.id,
          invoiceNo: sale.invoiceNo,
          createdAt: typeof sale.createdAt === 'string' ? sale.createdAt : new Date(sale.createdAt).toISOString(),
          status: sale.status,
          total: sale.total,
          cashierName: sale.cashierName || '—',
          customerName: sale.customerName || null,
          items: items.map(i => {
            const qty = Number(i.quantity) || 0;
            const ret = Number(i.returnedQty) || 0;
            return {
              saleItemId: i.id,
              productName: i.productName,
              batchNo: i.batchNo || null,
              expiryDate: null,
              quantity: qty,
              returnedQty: ret,
              returnableQty: Math.max(0, r3(qty - ret)),
              unitPrice: i.unitPrice,
            };
          }),
        },
      });
    }

    requirePermission(req, 'SALES_VIEW');
    const { page, pageSize, skip, take } = pageParams(req);
    const range = dateRange(req);
    let where = 'WHERE r.tenantId=@tenantId';
    const params = { tenantId: 'default' };
    if (range) { where += ' AND r.createdAt BETWEEN @from AND @to'; params.from = range.from; params.to = range.to; }
    const total = db.prepare(`SELECT COUNT(*) as c FROM "Return" r ${where}`).get(params).c;
    const rows = db.prepare(`SELECT r.*, s.invoiceNo as saleInvoiceNo FROM "Return" r JOIN "Sale" s ON r.saleId=s.id ${where} ORDER BY r.createdAt DESC LIMIT @take OFFSET @skip`).all({ ...params, take, skip });
    ok(res, { items: rows, total, page, pageSize });
  });
});

router.post('/returns', (req, res) => {
  wrap(res, () => {
    const user = requirePermission(req, 'SALES_RETURN');
    const { saleId, items, reason } = req.body || {};
    if (!saleId || !Array.isArray(items) || !items.length) throw ApiError('VALIDATION', 'saleId و items مطلوبان', 400);
    const result = transaction((db) => {
      const sale = db.prepare('SELECT * FROM "Sale" WHERE id=@id AND tenantId=@tenantId').get({ id: saleId, tenantId: 'default' });
      if (!sale) throw ApiError('NOT_FOUND', 'الفاتورة غير موجودة', 404);
      if (sale.status === 'CANCELLED') throw ApiError('SALE_CANCELLED', 'لا يمكن إرجاع فاتورة ملغاة', 409);
      let total = 0;
      const validated = [];
      for (const item of items) {
        const saleItem = db.prepare('SELECT * FROM "SaleItem" WHERE id=@id AND saleId=@saleId').get({ id: item.saleItemId, saleId });
        if (!saleItem) throw ApiError('NOT_FOUND', 'بند المبيعات غير موجود', 404);
        const maxQty = r3((saleItem.quantity || 0) - (saleItem.returnedQty || 0));
        const qty = r3(Number(item.quantity) || 0);
        if (qty <= 0 || qty > maxQty + 1e-9) throw ApiError('QTY_INVALID', `الكمية المسموح بإرجاعها: ${maxQty}`, 400);
        const unitPrice = r2(saleItem.unitPrice || 0);
        const lineTotal = r2(qty * unitPrice);
        total = r2(total + lineTotal);
        validated.push({ saleItem, qty, unitPrice, lineTotal });
      }
      const returnNo = nextDocNo(db, 'default', 'return', 'RET');
      const returnId = newId();
      db.prepare('INSERT INTO "Return" (id,tenantId,returnNo,saleId,userId,total,reason,createdAt) VALUES (@id,@tenantId,@returnNo,@saleId,@userId,@total,@reason,@t)')
        .run({ id: returnId, tenantId: 'default', returnNo, saleId, userId: user.id, total, reason: reason || null, t: now() });
      for (const v of validated) {
        db.prepare('INSERT INTO "ReturnItem" (id,tenantId,returnId,saleItemId,productId,batchId,quantity,unitPrice,total) VALUES (@id,@tenantId,@returnId,@saleItemId,@productId,@batchId,@quantity,@unitPrice,@total)')
          .run({ id: newId(), tenantId: 'default', returnId, saleItemId: v.saleItem.id, productId: v.saleItem.productId, batchId: v.saleItem.batchId || null, quantity: v.qty, unitPrice: v.unitPrice, total: v.lineTotal });
        db.prepare('UPDATE "SaleItem" SET returnedQty=returnedQty+@qty WHERE id=@id').run({ qty: v.qty, id: v.saleItem.id });
        if (v.saleItem.batchId) {
          const batch = db.prepare('SELECT * FROM "Batch" WHERE id=@id').get({ id: v.saleItem.batchId });
          if (batch) {
            const newQty = r3(batch.quantity + v.qty);
            db.prepare('UPDATE "Batch" SET quantity=@qty,status=\'ACTIVE\',updatedAt=@t WHERE id=@id').run({ qty: newQty, t: now(), id: v.saleItem.batchId });
            db.prepare('INSERT INTO "StockMovement" (id,tenantId,productId,batchId,type,quantity,unitCost,refType,refId,userId,createdAt) VALUES (@id,@tenantId,@productId,@batchId,\'RETURN\',@quantity,@unitCost,\'return\',@refId,@userId,@t)')
              .run({ id: newId(), tenantId: 'default', productId: v.saleItem.productId, batchId: v.saleItem.batchId, quantity: v.qty, unitCost: v.saleItem.costPrice || 0, refId: returnId, userId: user.id, t: now() });
          }
        }
      }
      // Deduct proportional loyalty earned on returned amount
      if (sale.customerId && total > 0) {
        const settings = getSettings('default');
        const loyaltyCfg = (settings.pos && settings.pos.loyalty) || {};
        if (loyaltyCfg.enabled !== false) {
          const earnRate = loyaltyCfg.earnRatePer100 || 1;
          const pointsToDeduct = Math.floor((total / 100) * earnRate);
          if (pointsToDeduct > 0) {
            db.prepare('INSERT INTO "LoyaltyEvent" (id,tenantId,customerId,saleId,type,points,value,note,userId,createdAt) VALUES (@id,@tenantId,@customerId,@saleId,\'ADJUST\',@points,0,@note,@userId,@t)')
              .run({ id: newId(), tenantId: 'default', customerId: sale.customerId, saleId: sale.id, points: -pointsToDeduct, note: `مرتجع فاتورة ${sale.invoiceNo}`, userId: user.id, t: now() });
          }
        }
      }
      return { returnId, returnNo, total };
    });
    audit({ userId: user.id, username: user.username }, 'RETURN_CREATE', { entity: 'return', entityId: result.returnId, metadata: { returnNo: result.returnNo, total: result.total } });
    ok(res, result, 201);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// LOYALTY
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/loyalty/:customerId', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'CUSTOMER_VIEW');
    const db = openDb();
    const customer = db.prepare('SELECT * FROM "Customer" WHERE id=@id AND tenantId=@tenantId').get({ id: req.params.customerId, tenantId: 'default' });
    if (!customer) throw ApiError('NOT_FOUND', 'العميل غير موجود', 404);
    const settings = getSettings('default');
    const loyaltyCfg = (settings.pos && settings.pos.loyalty) || { enabled: true, earnRatePer100: 1, pointValueEgp: 0.1, maxRedeemShare: 0.5, minRedeemPoints: 10 };
    const balanceRow = db.prepare('SELECT COALESCE(SUM(points),0) as b FROM "LoyaltyEvent" WHERE customerId=@id').get({ id: req.params.customerId });
    const balance = balanceRow ? balanceRow.b : 0;
    const events = db.prepare('SELECT * FROM "LoyaltyEvent" WHERE customerId=@id ORDER BY createdAt DESC LIMIT 30').all({ id: req.params.customerId });

    let preview = undefined;
    if (req.query.previewTotal !== undefined) {
      const total = Number(req.query.previewTotal);
      if (Number.isFinite(total) && total > 0) {
        const pointVal = loyaltyCfg.pointValueEgp || 0.1;
        const maxShare = loyaltyCfg.maxRedeemShare !== undefined ? loyaltyCfg.maxRedeemShare : 0.5;
        const maxVal = total * maxShare;
        const maxPointsByTotal = Math.floor(maxVal / pointVal);
        const maxPoints = Math.max(0, Math.min(balance, maxPointsByTotal));
        const minPoints = loyaltyCfg.minRedeemPoints || 10;
        preview = {
          maxRedeemable: maxPoints >= minPoints ? maxPoints : 0,
          value: r2(maxPoints * pointVal),
          minRedeemPoints: minPoints,
        };
      } else {
        preview = {
          maxRedeemable: 0,
          value: 0,
          minRedeemPoints: loyaltyCfg.minRedeemPoints || 10,
        };
      }
    }

    ok(res, {
      customer: { id: customer.id, name: customer.name, phone: customer.phone },
      balance,
      pointValueEgp: loyaltyCfg.pointValueEgp || 0.1,
      balanceValueEgp: r2(balance * (loyaltyCfg.pointValueEgp || 0.1)),
      events: events.map(e => ({ ...e })),
      preview,
    });
  });
});

router.post('/loyalty/adjust', (req, res) => {
  wrap(res, () => {
    const user = requirePermission(req, 'CUSTOMER_MANAGE');
    const { customerId, points, note } = req.body || {};
    if (!customerId || !points || !Number.isInteger(Number(points)) || Number(points) === 0) throw ApiError('VALIDATION', 'customerId ونقاط صحيحة مطلوبة', 400);
    const db = openDb();
    const customer = db.prepare('SELECT * FROM "Customer" WHERE id=@id AND tenantId=@tenantId').get({ id: customerId, tenantId: 'default' });
    if (!customer) throw ApiError('NOT_FOUND', 'العميل غير موجود', 404);
    db.prepare('INSERT INTO "LoyaltyEvent" (id,tenantId,customerId,type,points,value,note,userId,createdAt) VALUES (@id,@tenantId,@customerId,\'ADJUST\',@points,0,@note,@userId,@t)')
      .run({ id: newId(), tenantId: 'default', customerId, points: Number(points), note: note || 'تسوية يدوية', userId: user.id, t: now() });
    const balanceRow = db.prepare('SELECT COALESCE(SUM(points),0) as b FROM "LoyaltyEvent" WHERE customerId=@id').get({ id: customerId });
    audit({ userId: user.id, username: user.username }, 'LOYALTY_ADJUST', { entity: 'customer', entityId: customerId, metadata: { points } });
    ok(res, { balance: balanceRow ? balanceRow.b : 0 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════════════════
const REPORT_TYPES = [
  'sales', 'sales-by-cashier', 'sales-by-payment', 'product-sales',
  'purchases', 'suppliers', 'inventory', 'low-stock', 'returns', 'movements'
];
const SNAPSHOT_TYPES = ['inventory', 'low-stock'];

const CSV_PAYMENT = { cash: 'نقدي', card: 'بطاقة', wallet: 'محفظة إلكترونية' };
const CSV_PURCHASE_STATUS = { DRAFT: 'مسودة', RECEIVED: 'مستلمة', CANCELLED: 'ملغاة' };
const CSV_PAY_STATUS = { UNPAID: 'غير مدفوعة', PARTIAL: 'مدفوعة جزئياً', PAID: 'مدفوعة' };
const CSV_EXPIRY_STATE = { EXPIRED: 'منتهي الصلاحية', NEAR: 'قريب الانتهاء', VALID: 'ساري' };
const CSV_MOVEMENT = {
  PURCHASE_RECEIVE: 'استلام شراء',
  SALE: 'بيع',
  SALE_CANCEL_RESTOCK: 'إرجاع إلغاء فاتورة',
  RETURN_IN: 'مرتجع داخل',
  ADJUSTMENT: 'تسوية',
  DAMAGE: 'تلف',
  EXPIRY_WRITEOFF: 'إعدام/تسوية مخزنية',
  STOCKTAKE: 'جرد',
  INITIAL: 'رصيد افتتاحي',
};

const CSV_COLUMNS = {
  sales: [
    { header: 'التاريخ', get: (r) => (r.date || '').slice(0, 10) },
    { header: 'عدد الفواتير', get: (r) => r.count },
    { header: 'الإيراد', get: (r) => (Number(r.revenue) || 0).toFixed(2) },
    { header: 'التكلفة', get: (r) => (Number(r.cost) || 0).toFixed(2) },
    { header: 'الربح', get: (r) => (Number(r.profit) || 0).toFixed(2) },
  ],
  'sales-by-cashier': [
    { header: 'الكاشير', get: (r) => r.cashierName },
    { header: 'الفواتير', get: (r) => r.invoices },
    { header: 'الإيراد', get: (r) => (Number(r.revenue) || 0).toFixed(2) },
    { header: 'متوسط الفاتورة', get: (r) => (Number(r.avg) || 0).toFixed(2) },
  ],
  'sales-by-payment': [
    { header: 'طريقة الدفع', get: (r) => CSV_PAYMENT[r.paymentMethod] || r.paymentMethod },
    { header: 'الفواتير', get: (r) => r.invoices },
    { header: 'الإيراد', get: (r) => (Number(r.revenue) || 0).toFixed(2) },
  ],
  'product-sales': [
    { header: 'الصنف', get: (r) => r.productName },
    { header: 'SKU', get: (r) => r.sku },
    { header: 'الكمية', get: (r) => r.qty },
    { header: 'الإيراد', get: (r) => (Number(r.revenue) || 0).toFixed(2) },
    { header: 'الربح', get: (r) => (Number(r.profit) || 0).toFixed(2) },
  ],
  purchases: [
    { header: 'رقم الفاتورة', get: (r) => r.invoiceNo },
    { header: 'المورد', get: (r) => r.supplierName },
    { header: 'الإجمالي', get: (r) => (Number(r.total) || 0).toFixed(2) },
    { header: 'المدفوع', get: (r) => (Number(r.paidAmount) || 0).toFixed(2) },
    { header: 'حالة الدفع', get: (r) => CSV_PAY_STATUS[r.paymentStatus] || r.paymentStatus },
    { header: 'الحالة', get: (r) => CSV_PURCHASE_STATUS[r.status] || r.status },
    { header: 'التاريخ', get: (r) => (r.createdAt || '').slice(0, 10) },
  ],
  suppliers: [
    { header: 'المورد', get: (r) => r.supplierName },
    { header: 'عدد الفواتير', get: (r) => r.invoices },
    { header: 'إجمالي المشتريات', get: (r) => (Number(r.totalPurchased) || 0).toFixed(2) },
    { header: 'آخر شراء', get: (r) => (r.lastPurchase || '').slice(0, 10) },
  ],
  inventory: [
    { header: 'الصنف', get: (r) => r.productName },
    { header: 'SKU', get: (r) => r.sku },
    { header: 'التصنيف', get: (r) => r.categoryName },
    { header: 'إجمالي المخزون', get: (r) => r.stockTotal },
    { header: 'المتاح للبيع', get: (r) => r.stockAvailable },
    { header: 'القيمة', get: (r) => (Number(r.value) || 0).toFixed(2) },
    { header: 'حد إعادة الطلب', get: (r) => r.reorderLevel },
  ],
  'low-stock': [
    { header: 'الصنف', get: (r) => r.productName },
    { header: 'SKU', get: (r) => r.sku },
    { header: 'المتاح', get: (r) => r.available },
    { header: 'حد إعادة الطلب', get: (r) => r.reorderLevel },
    { header: 'العجز', get: (r) => r.deficit },
  ],
  returns: [
    { header: 'رقم المرتجع', get: (r) => r.returnNo },
    { header: 'فاتورة البيع', get: (r) => r.saleInvoiceNo },
    { header: 'الإجمالي', get: (r) => (Number(r.total) || 0).toFixed(2) },
    { header: 'السبب', get: (r) => r.reason || '' },
    { header: 'المستخدم', get: (r) => r.username || '—' },
    { header: 'التاريخ', get: (r) => (r.createdAt || '').slice(0, 10) },
  ],
  movements: [
    { header: 'التاريخ', get: (r) => r.date || '' },
    { header: 'الصنف', get: (r) => r.productName },
    { header: 'رقم الباتش', get: (r) => r.batchNo || '—' },
    { header: 'نوع الحركة', get: (r) => CSV_MOVEMENT[r.type] || r.type },
    { header: 'الكمية', get: (r) => r.quantity },
    { header: 'ملاحظة', get: (r) => r.note || '' },
  ],
};

function buildCsvString(type, rows) {
  const cols = CSV_COLUMNS[type] || [];
  const lines = [cols.map(c => {
    const s = c.header === null || c.header === undefined ? '' : String(c.header);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')];
  for (const row of rows) {
    lines.push(cols.map(c => {
      const v = c.get(row);
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(','));
  }
  return '\uFEFF' + lines.join('\r\n');
}

router.get('/reports', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'REPORT_VIEW');
    const db = openDb();
    const type = req.query.type || 'sales';
    const range = dateRange(req) || { from: new Date(Date.now() - 29 * 86400000).toISOString(), to: new Date().toISOString() };
    const format = req.query.format || 'json';

    let result = { rows: [] };

    switch (type) {
      case 'sales': {
        const sales = db.prepare("SELECT createdAt, total FROM \"Sale\" WHERE tenantId=@tenantId AND status!='CANCELLED' AND createdAt BETWEEN @from AND @to").all({ tenantId: 'default', from: range.from, to: range.to });
        const items = db.prepare("SELECT si.quantity, si.costPrice, s.createdAt FROM \"SaleItem\" si JOIN \"Sale\" s ON si.saleId=s.id WHERE si.tenantId=@tenantId AND s.status!='CANCELLED' AND s.createdAt BETWEEN @from AND @to").all({ tenantId: 'default', from: range.from, to: range.to });

        const map = new Map();
        const fromDate = new Date(range.from);
        const toDate = new Date(range.to);
        const startLocal = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
        const endLocal = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
        const days = Math.round((endLocal.getTime() - startLocal.getTime()) / 86400000) + 1;
        if (days > 0 && days <= 370) {
          for (let i = 0; i < days; i++) {
            const d = new Date(startLocal.getTime() + i * 86400000);
            const key = d.toISOString().slice(0, 10);
            map.set(key, { date: key, count: 0, revenue: 0, cost: 0, profit: 0 });
          }
        }
        for (const s of sales) {
          const key = (typeof s.createdAt === 'string' ? s.createdAt : new Date(s.createdAt).toISOString()).slice(0, 10);
          const e = map.get(key) || { date: key, count: 0, revenue: 0, cost: 0, profit: 0 };
          e.count += 1;
          e.revenue = r2(e.revenue + s.total);
          map.set(key, e);
        }
        for (const it of items) {
          const key = (typeof it.createdAt === 'string' ? it.createdAt : new Date(it.createdAt).toISOString()).slice(0, 10);
          const e = map.get(key) || { date: key, count: 0, revenue: 0, cost: 0, profit: 0 };
          e.cost = r2(e.cost + it.quantity * it.costPrice);
          map.set(key, e);
        }
        for (const e of map.values()) e.profit = r2(e.revenue - e.cost);
        const rows = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
        const revenue = r2(sales.reduce((s, x) => s + x.total, 0));
        const cost = r2(items.reduce((s, x) => s + x.quantity * x.costPrice, 0));
        const invoices = sales.length;
        result = {
          rows,
          totals: { revenue, cost, profit: r2(revenue - cost), invoices, avgInvoice: invoices > 0 ? r2(revenue / invoices) : 0 },
          chart: rows,
        };
        break;
      }
      case 'sales-by-cashier': {
        const grouped = db.prepare("SELECT s.cashierId, COALESCE(u.displayName, '—') as cashierName, COUNT(*) as invoices, COALESCE(SUM(s.total),0) as revenue FROM \"Sale\" s LEFT JOIN \"User\" u ON s.cashierId=u.id WHERE s.tenantId=@tenantId AND s.status!='CANCELLED' AND s.createdAt BETWEEN @from AND @to GROUP BY s.cashierId, u.displayName ORDER BY revenue DESC").all({ tenantId: 'default', from: range.from, to: range.to });
        const rows = grouped.map(g => {
          const invoices = g.invoices;
          const revenue = r2(g.revenue || 0);
          return {
            cashierName: g.cashierName,
            invoices,
            revenue,
            avg: invoices > 0 ? r2(revenue / invoices) : 0,
          };
        });
        result = { rows, chart: rows };
        break;
      }
      case 'sales-by-payment': {
        const grouped = db.prepare("SELECT paymentMethod, COUNT(*) as invoices, COALESCE(SUM(total),0) as revenue FROM \"Sale\" WHERE tenantId=@tenantId AND status!='CANCELLED' AND createdAt BETWEEN @from AND @to GROUP BY paymentMethod ORDER BY revenue DESC").all({ tenantId: 'default', from: range.from, to: range.to });
        const rows = grouped.map(g => ({
          paymentMethod: g.paymentMethod,
          invoices: g.invoices,
          revenue: r2(g.revenue || 0),
        }));
        result = { rows, chart: rows };
        break;
      }
      case 'product-sales': {
        const qParam = req.query.q ? `%${req.query.q.trim()}%` : null;
        let pWhere = "WHERE si.tenantId=@tenantId AND s.status!='CANCELLED' AND s.createdAt BETWEEN @from AND @to";
        const pParams = { tenantId: 'default', from: range.from, to: range.to };
        if (qParam) {
          pWhere += " AND (si.productName LIKE @qParam OR p.sku LIKE @qParam)";
          pParams.qParam = qParam;
        }
        const items = db.prepare(`SELECT si.productId, si.productName, p.sku, SUM(si.quantity) as qty, SUM(si.total) as revenue, SUM(si.total - (si.quantity * si.costPrice)) as profit FROM "SaleItem" si JOIN "Sale" s ON si.saleId=s.id JOIN "Product" p ON si.productId=p.id ${pWhere} GROUP BY si.productId, si.productName, p.sku ORDER BY revenue DESC LIMIT 100`).all(pParams);
        const rows = items.map(it => ({
          productName: it.productName,
          sku: it.sku,
          qty: r3(it.qty || 0),
          revenue: r2(it.revenue || 0),
          profit: r2(it.profit || 0),
        }));
        result = { rows };
        break;
      }
      case 'purchases': {
        const purchases = db.prepare("SELECT pu.invoiceNo, s.name as supplierName, pu.total, pu.paidAmount, pu.paymentStatus, pu.status, pu.createdAt FROM \"Purchase\" pu JOIN \"Supplier\" s ON pu.supplierId=s.id WHERE pu.tenantId=@tenantId AND pu.createdAt BETWEEN @from AND @to ORDER BY pu.createdAt DESC").all({ tenantId: 'default', from: range.from, to: range.to });
        const rows = purchases.map(p => ({
          invoiceNo: p.invoiceNo,
          supplierName: p.supplierName,
          total: r2(p.total),
          paidAmount: r2(p.paidAmount),
          paymentStatus: p.paymentStatus,
          status: p.status,
          createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date(p.createdAt).toISOString(),
        }));
        const totalPurchased = r2(rows.reduce((s, r) => s + r.total, 0));
        const totalPaid = r2(rows.reduce((s, r) => s + r.paidAmount, 0));
        result = {
          rows,
          totals: { count: rows.length, total: totalPurchased, paid: totalPaid, unpaid: r2(totalPurchased - totalPaid) },
        };
        break;
      }
      case 'suppliers': {
        const suppliers = db.prepare("SELECT s.id as supplierId, s.name as supplierName, COUNT(pu.id) as invoices, COALESCE(SUM(pu.total),0) as totalPurchased, MAX(pu.createdAt) as lastPurchase FROM \"Purchase\" pu JOIN \"Supplier\" s ON pu.supplierId=s.id WHERE pu.tenantId=@tenantId AND pu.status!='CANCELLED' AND pu.createdAt BETWEEN @from AND @to GROUP BY s.id, s.name ORDER BY totalPurchased DESC").all({ tenantId: 'default', from: range.from, to: range.to });
        const rows = suppliers.map(s => ({
          supplierName: s.supplierName,
          invoices: s.invoices,
          totalPurchased: r2(s.totalPurchased),
          lastPurchase: s.lastPurchase ? (typeof s.lastPurchase === 'string' ? s.lastPurchase : new Date(s.lastPurchase).toISOString()) : '',
        }));
        result = { rows };
        break;
      }
      case 'inventory': {
        const products = db.prepare("SELECT p.id, p.nameAr as productName, p.sku, p.reorderLevel, c.nameAr as categoryName FROM \"Product\" p LEFT JOIN \"Category\" c ON p.categoryId=c.id WHERE p.tenantId=@tenantId AND p.active=1").all({ tenantId: 'default' });
        const batches = db.prepare("SELECT productId, quantity, costPrice, expiryDate, status FROM \"Batch\" WHERE tenantId=@tenantId AND quantity>0 AND status IN ('ACTIVE','EXPIRED')").all({ tenantId: 'default' });
        const todayMid = new Date();
        todayMid.setHours(0, 0, 0, 0);

        const bMap = new Map();
        for (const b of batches) {
          if (!bMap.has(b.productId)) bMap.set(b.productId, []);
          bMap.get(b.productId).push(b);
        }

        const rows = products.map(p => {
          let stockTotal = 0, stockAvailable = 0, value = 0;
          const pBatches = bMap.get(p.id) || [];
          for (const b of pBatches) {
            stockTotal += b.quantity;
            value += b.quantity * b.costPrice;
            if (b.status === 'ACTIVE') stockAvailable += b.quantity;
          }
          return {
            productName: p.productName,
            sku: p.sku,
            categoryName: p.categoryName || '—',
            stockTotal: r3(stockTotal),
            stockAvailable: r3(stockAvailable),
            stockExpired: 0,
            value: r2(value),
            reorderLevel: p.reorderLevel,
          };
        }).sort((a, b) => b.value - a.value);

        const totalValue = r2(rows.reduce((s, r) => s + r.value, 0));
        result = { rows, totals: { totalValue, productCount: rows.length } };
        break;
      }
      case 'low-stock': {
        const products = db.prepare("SELECT p.id, p.nameAr as productName, p.sku, p.reorderLevel FROM \"Product\" p WHERE p.tenantId=@tenantId AND p.active=1").all({ tenantId: 'default' });
        const todayMid = new Date();
        todayMid.setHours(0, 0, 0, 0);
        const todayIso = todayMid.toISOString();
        const batches = db.prepare("SELECT productId, quantity FROM \"Batch\" WHERE tenantId=@tenantId AND quantity>0 AND status='ACTIVE' AND (expiryDate IS NULL OR expiryDate>=@todayIso)").all({ tenantId: 'default', todayIso });
        const availMap = new Map();
        for (const b of batches) {
          availMap.set(b.productId, (availMap.get(b.productId) || 0) + b.quantity);
        }
        const rows = products.map(p => {
          const available = r3(availMap.get(p.id) || 0);
          return {
            productName: p.productName,
            sku: p.sku,
            available,
            reorderLevel: p.reorderLevel,
            deficit: r3(Math.max(0, p.reorderLevel - available)),
          };
        }).filter(r => r.available <= r.reorderLevel + 1e-9).sort((a, b) => b.deficit - a.deficit);
        result = { rows };
        break;
      }
      case 'expiry': {
        // Expiry report removed for stationery store. Return empty snapshot.
        result = { rows: [], totals: { totalValue: 0, expiredCount: 0, nearCount: 0, validCount: 0, expiredValue: 0, nearValue: 0 } };
        break;
      }
      case 'returns': {
        const returns = db.prepare("SELECT r.returnNo, s.invoiceNo as saleInvoiceNo, r.total, r.reason, COALESCE(u.displayName, '—') as username, r.createdAt FROM \"Return\" r JOIN \"Sale\" s ON r.saleId=s.id LEFT JOIN \"User\" u ON r.userId=u.id WHERE r.tenantId=@tenantId AND r.createdAt BETWEEN @from AND @to ORDER BY r.createdAt DESC").all({ tenantId: 'default', from: range.from, to: range.to });
        const rows = returns.map(r => ({
          returnNo: r.returnNo,
          saleInvoiceNo: r.saleInvoiceNo,
          total: r2(r.total),
          reason: r.reason || '',
          username: r.username,
          createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date(r.createdAt).toISOString(),
        }));
        const totalRefunded = r2(rows.reduce((s, r) => s + r.total, 0));
        result = {
          rows,
          totals: { count: rows.length, totalRefunded },
        };
        break;
      }
      case 'movements': {
        const { page, pageSize, skip, take } = pageParams(req, 100);
        const total = db.prepare("SELECT COUNT(*) as c FROM \"StockMovement\" WHERE tenantId=@tenantId AND createdAt BETWEEN @from AND @to").get({ tenantId: 'default', from: range.from, to: range.to }).c;
        const movements = db.prepare(`SELECT sm.createdAt as date, p.nameAr as productName, b.batchNo, sm.type, sm.quantity, sm.note FROM "StockMovement" sm JOIN "Product" p ON sm.productId=p.id LEFT JOIN "Batch" b ON sm.batchId=b.id WHERE sm.tenantId=@tenantId AND sm.createdAt BETWEEN @from AND @to ORDER BY sm.createdAt DESC LIMIT @take OFFSET @skip`).all({ tenantId: 'default', from: range.from, to: range.to, take, skip });
        const rows = movements.map(m => ({
          date: typeof m.date === 'string' ? m.date : new Date(m.date).toISOString(),
          productName: m.productName,
          batchNo: m.batchNo || '—',
          type: m.type,
          quantity: m.quantity,
          note: m.note || '',
        }));
        result = { rows, paging: { page, pageSize, total } };
        break;
      }
      default:
        throw ApiError('INVALID_TYPE', 'نوع التقرير غير صالح', 400);
    }

    if (format === 'csv') {
      const csv = buildCsvString(type, result.rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="library-report-${type}-${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.status(200).send(csv);
    }

    ok(res, {
      type,
      from: range.from,
      to: range.to,
      snapshot: SNAPSHOT_TYPES.includes(type),
      rows: result.rows,
      totals: result.totals || null,
      chart: result.chart || null,
      paging: result.paging || null,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/dashboard', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'DASHBOARD_VIEW');
    const db = openDb();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const weekStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    const weekStartIso = weekStartDate.toISOString();
    const thirtyDaysAgoIso = new Date(now.getTime() - 30 * 86400000).toISOString();

    const todayAgg = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total),0) as total FROM \"Sale\" WHERE tenantId=@tenantId AND status!='CANCELLED' AND createdAt>=@todayStart").get({ tenantId: 'default', todayStart });
    const todaySales = r2(todayAgg.total || 0);
    const todayCount = todayAgg.count || 0;
    const avgTransaction = todayCount > 0 ? r2(todaySales / todayCount) : 0;

    const monthAgg = db.prepare("SELECT COALESCE(SUM(total),0) as total FROM \"Sale\" WHERE tenantId=@tenantId AND status!='CANCELLED' AND createdAt>=@monthStart").get({ tenantId: 'default', monthStart });
    const monthSales = r2(monthAgg.total || 0);

    const purchaseAgg = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total),0) as total FROM \"Purchase\" WHERE tenantId=@tenantId AND status='RECEIVED' AND createdAt>=@monthStart").get({ tenantId: 'default', monthStart });
    const monthPurchases = r2(purchaseAgg.total || 0);
    const monthPurchaseCount = purchaseAgg.count || 0;

    const settings = getSettings('default');

    const products = db.prepare('SELECT id, reorderLevel FROM "Product" WHERE tenantId=@tenantId AND active=1').all({ tenantId: 'default' });
    const batches = db.prepare("SELECT productId, quantity, costPrice, status FROM \"Batch\" WHERE tenantId=@tenantId AND quantity>0 AND status='ACTIVE'").all({ tenantId: 'default' });

    let stockValue = 0;
    const perProduct = new Map();

    for (const b of batches) {
      stockValue += (b.quantity || 0) * (b.costPrice || 0);
      perProduct.set(b.productId, (perProduct.get(b.productId) || 0) + (b.quantity || 0));
    }

    let lowStockCount = 0;
    for (const p of products) {
      const available = perProduct.get(p.id) || 0;
      if (available <= (p.reorderLevel || 0) + 1e-9) lowStockCount++;
    }

    const weeklyMap = new Map();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      weeklyMap.set(dateStr, { date: dateStr, total: 0, count: 0 });
    }

    const weekSales = db.prepare("SELECT createdAt, total FROM \"Sale\" WHERE tenantId=@tenantId AND status!='CANCELLED' AND createdAt>=@weekStart").all({ tenantId: 'default', weekStart: weekStartIso });
    for (const s of weekSales) {
      const dStr = typeof s.createdAt === 'string' ? s.createdAt.slice(0, 10) : new Date(s.createdAt).toISOString().slice(0, 10);
      const entry = weeklyMap.get(dStr);
      if (entry) {
        entry.total = r2(entry.total + (s.total || 0));
        entry.count++;
      }
    }
    const weeklySales = Array.from(weeklyMap.values());

    const recentSalesRaw = db.prepare("SELECT s.id, s.invoiceNo, s.total, s.status, s.paymentMethod, s.createdAt, COALESCE(u.displayName, 'كاشير') as cashierName, (SELECT COUNT(*) FROM \"SaleItem\" si WHERE si.saleId=s.id) as itemsCount FROM \"Sale\" s LEFT JOIN \"User\" u ON s.cashierId=u.id WHERE s.tenantId=@tenantId AND s.status!='CANCELLED' ORDER BY s.createdAt DESC LIMIT 8").all({ tenantId: 'default' });
    const recentSales = recentSalesRaw.map(s => ({
      id: s.id,
      invoiceNo: s.invoiceNo,
      total: r2(s.total || 0),
      status: s.status,
      paymentMethod: s.paymentMethod,
      cashierName: s.cashierName,
      createdAt: typeof s.createdAt === 'string' ? s.createdAt : new Date(s.createdAt).toISOString(),
      itemsCount: s.itemsCount || 0,
    }));

    const topRaw = db.prepare("SELECT si.productId, si.productName as nameAr, SUM(si.quantity) as qty, SUM(si.total) as revenue FROM \"SaleItem\" si JOIN \"Sale\" s ON si.saleId=s.id WHERE si.tenantId=@tenantId AND s.status!='CANCELLED' AND s.createdAt>=@thirtyDaysAgo GROUP BY si.productId, si.productName ORDER BY qty DESC LIMIT 7").all({ tenantId: 'default', thirtyDaysAgo: thirtyDaysAgoIso });
    const topProducts = topRaw.map(t => ({
      productId: t.productId,
      nameAr: t.nameAr || '',
      qty: r3(t.qty || 0),
      revenue: r2(t.revenue || 0),
    }));

    ok(res, {
      todaySales,
      todayCount,
      avgTransaction,
      monthSales,
      monthPurchases,
      monthPurchaseCount,
      lowStockCount,
      stockValue: r2(stockValue),
      activeProducts: products.length,
      weeklySales,
      recentSales,
      topProducts,
      today: { salesCount: todayCount, revenue: todaySales },
      inventory: { totalProducts: products.length, lowStockCount, },
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BACKUP
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/backup', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'BACKUP_MANAGE');
    const db = openDb();
    const rows = db.prepare('SELECT * FROM "BackupRecord" WHERE tenantId=@tenantId ORDER BY createdAt DESC').all({ tenantId: 'default' });
    const backups = rows.map(r => ({
      id: r.id,
      filename: r.filename,
      sizeBytes: r.sizeBytes,
      type: r.type,
      createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date(r.createdAt).toISOString(),
      note: r.note || null,
      counts: safeJson(r.entityCounts, {}),
    }));
    const totalBytes = backups.reduce((acc, b) => acc + (b.sizeBytes || 0), 0);
    const settings = getSettings('default');
    ok(res, {
      backups,
      storage: { files: backups.length, totalBytes },
      config: settings.backup || { autoBackupEnabled: true, intervalHours: 24, keepCount: 7, autoExportCsv: false },
    });
  });
});

router.post('/backup', (req, res) => {
  wrap(res, () => {
    const user = requirePermission(req, 'BACKUP_MANAGE');
    const { note } = req.body || {};
    const dbPath = getDbPath();
    const dataDir = path.dirname(dbPath);
    const backupsDir = path.join(dataDir, 'backups');
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
    const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
    const dest = path.join(backupsDir, filename);
    fs.copyFileSync(dbPath, dest);
    const sizeBytes = fs.statSync(dest).size;
    const db = openDb();
    const counts = {};
    const tables = ['Product', 'Category', 'Supplier', 'Customer', 'Sale', 'Purchase', 'Batch'];
    for (const t of tables) {
      try { counts[t] = db.prepare(`SELECT COUNT(*) as c FROM "${t}" WHERE tenantId=@tenantId`).get({ tenantId: "default" }).c; } catch (e) { counts[t] = 0; }
    }
    const id = newId();
    const createdAt = now();
    db.prepare('INSERT INTO "BackupRecord" (id,tenantId,filename,sizeBytes,type,entityCounts,note,userId,createdAt) VALUES (@id,@tenantId,@filename,@sizeBytes,\'MANUAL\',@entityCounts,@note,@userId,@t)')
      .run({ id, tenantId: 'default', filename, sizeBytes, entityCounts: JSON.stringify(counts), note: note || null, userId: user.id, t: createdAt });
    const backup = { id, filename, sizeBytes, type: 'MANUAL', counts, note: note || null, createdAt };
    const allBackups = db.prepare('SELECT sizeBytes FROM "BackupRecord" WHERE tenantId=@tenantId').all({ tenantId: 'default' });
    const totalBytes = allBackups.reduce((acc, b) => acc + (b.sizeBytes || 0), 0);
    ok(res, { backup, storage: { files: allBackups.length, totalBytes } }, 201);
  });
});

router.get('/backup/:id', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'BACKUP_MANAGE');
    const db = openDb();
    const row = db.prepare('SELECT * FROM "BackupRecord" WHERE id=@id AND tenantId=@tenantId').get({ id: req.params.id, tenantId: 'default' });
    if (!row) throw ApiError('NOT_FOUND', 'النسخة الاحتياطية غير موجودة', 404);
    ok(res, { ...row, counts: safeJson(row.entityCounts, {}) });
  });
});

router.post('/backup/:id/restore', (req, res) => {
  wrap(res, () => {
    const user = requirePermission(req, 'BACKUP_MANAGE');
    const db = openDb();
    const record = db.prepare('SELECT * FROM "BackupRecord" WHERE id=@id AND tenantId=@tenantId').get({ id: req.params.id, tenantId: 'default' });
    if (!record) throw ApiError('NOT_FOUND', 'النسخة الاحتياطية غير موجودة', 404);
    const dbPath = getDbPath();
    const dataDir = path.dirname(dbPath);
    const safeFilename = path.basename(record.filename);
    const backupPath = path.join(dataDir, 'backups', safeFilename);
    if (!fs.existsSync(backupPath)) throw ApiError('FILE_MISSING', 'ملف النسخة الاحتياطية غير موجود', 404);

    // 1. Automatic pre-restore snapshot
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
      const preRestoreFile = `backup_pre_restore_${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
      const preRestorePath = path.join(dataDir, 'backups', preRestoreFile);
      fs.copyFileSync(dbPath, preRestorePath);
      const preSize = fs.statSync(preRestorePath).size;
      db.prepare('INSERT INTO "BackupRecord" (id,tenantId,filename,sizeBytes,type,entityCounts,note,userId,createdAt) VALUES (@id,@tenantId,@filename,@sizeBytes,\'PRE_RESTORE\',\'\',@note,@userId,@t)')
        .run({ id: newId(), tenantId: 'default', filename: preRestoreFile, sizeBytes: preSize, note: `نسخة تلقائية قبل استعادة ${safeFilename}`, userId: user.id, t: now() });
    } catch (e) {
      console.warn('[RESTORE] Pre-restore snapshot warning:', e && e.message);
    }

    // 2. Close active DB handles so files are not locked on Windows
    closeDb();

    // 3. Clear stale WAL and SHM
    const walPath = dbPath + '-wal';
    const shmPath = dbPath + '-shm';
    try { if (fs.existsSync(walPath)) fs.unlinkSync(walPath); } catch (e) {}
    try { if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath); } catch (e) {}

    // 4. Copy restored database file
    fs.copyFileSync(backupPath, dbPath);

    // 5. Re-open and verify bootstrap
    ensureBootstrap();

    audit({ userId: user.id, username: user.username }, 'BACKUP_RESTORE', { entity: 'backup', entityId: record.id, metadata: { filename: safeFilename } });
    ok(res, { restored: true, filename: safeFilename });
  });
});

router.delete('/backup/:id', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'BACKUP_MANAGE');
    const db = openDb();
    const record = db.prepare('SELECT * FROM "BackupRecord" WHERE id=@id AND tenantId=@tenantId').get({ id: req.params.id, tenantId: 'default' });
    if (!record) throw ApiError('NOT_FOUND', 'النسخة الاحتياطية غير موجودة', 404);
    const dbPath = getDbPath();
    const backupPath = path.join(path.dirname(dbPath), 'backups', record.filename);
    try { if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath); } catch (e) { console.warn("[BACKUP] Delete unlink warning:", e && e.message); }
    db.prepare('DELETE FROM "BackupRecord" WHERE id=@id').run({ id: req.params.id });
    ok(res, { deleted: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/audit', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'AUDIT_VIEW');
    const db = openDb();
    const { page, pageSize, skip, take } = pageParams(req, 50);
    const action = req.query.action;
    const range = dateRange(req);
    let where = 'WHERE tenantId=@tenantId';
    const params = { tenantId: 'default' };
    if (action) { where += ' AND action=@action'; params.action = action; }
    if (range) { where += ' AND createdAt BETWEEN @from AND @to'; params.from = range.from; params.to = range.to; }
    const total = db.prepare(`SELECT COUNT(*) as c FROM "AuditLog" ${where}`).get(params).c;
    const rows = db.prepare(`SELECT * FROM "AuditLog" ${where} ORDER BY createdAt DESC LIMIT @take OFFSET @skip`).all({ ...params, take, skip });
    const actionRows = db.prepare('SELECT DISTINCT action FROM "AuditLog" WHERE tenantId=@tenantId').all({ tenantId: 'default' });
    const actions = actionRows.map(a => a.action).filter(Boolean);
    ok(res, { items: rows.map(r => ({ ...r, metadata: safeJson(r.metadata, {}) })), total, page, pageSize, actions });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DIAGNOSTICS
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/diagnostics', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'SETTINGS_VIEW');
    const db = openDb();
    const settings = getSettings('default');
    const status = {
      productId: 'LIBRARY_STORE',
      phase: 'READY',
      licenseState: 'ACTIVE',
      version: '1.0.0',
      build: '2026092201',
      branding: settings.branding,
      business: settings.business,
      localization: settings.localization,
      pos: settings.pos,
      modules: { supermarket: true, pos: true, purchasing: true, inventory: true, customers: true, reports: true, stocktaking: true },
      tenantId: 'default',
    };
    const tables = [
      ['products', 'Product'],
      ['categories', 'Category'],
      ['suppliers', 'Supplier'],
      ['customers', 'Customer'],
      ['batches', 'Batch'],
      ['purchases', 'Purchase'],
      ['sales', 'Sale'],
      ['returns', 'Return'],
      ['stocktakeSessions', 'StocktakeSession'],
      ['loyaltyEvents', 'LoyaltyEvent'],
      ['users', 'User'],
      ['auditLogs', 'AuditLog'],
      ['backupRecords', 'BackupRecord'],
    ];
    const tenantTableCounts = {};
    for (const [key, tbl] of tables) {
      try {
        tenantTableCounts[key] = db.prepare(`SELECT COUNT(*) as c FROM "${tbl}" WHERE tenantId=@tenantId`).get({ tenantId: 'default' }).c;
      } catch {
        tenantTableCounts[key] = 0;
      }
    }
    const lastBackup = db.prepare('SELECT createdAt FROM "BackupRecord" WHERE tenantId=@tenantId ORDER BY createdAt DESC LIMIT 1').get({ tenantId: 'default' });
    ok(res, {
      status,
      db: { ok: true },
      licenseServer: {
        url: 'offline',
        reachable: false,
        latencyMs: null,
        checkedAt: new Date().toISOString(),
      },
      lastBackupAt: lastBackup ? (typeof lastBackup.createdAt === 'string' ? lastBackup.createdAt : new Date(lastBackup.createdAt).toISOString()) : null,
      activation: null,
      artifactPolicy: null,
      tenantTableCounts,
      generatedAt: new Date().toISOString(),
    });
  });
});

module.exports = router;
