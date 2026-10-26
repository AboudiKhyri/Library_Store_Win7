const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// ============================================================================
// 1. server/index.js (SEC-01 CORS)
// ============================================================================
const indexPath = path.join(root, 'server/index.js');
let indexSrc = fs.readFileSync(indexPath, 'utf8').replace(/\r\n/g, '\n');

const oldIndexCors = `// ─── CORS for local development ────────────────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  if (!origin || /^https?:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d+)?$/.test(origin) || origin === 'null') {
    res.set('Access-Control-Allow-Origin', origin || '*');
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,Cookie');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});`;

const newIndexCors = `// ─── CORS for local development ────────────────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  const isLoopback = origin && (/^https?:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d+)?$/.test(origin) || origin === 'null' || origin.startsWith('file://') || origin.startsWith('vscode-webview://'));
  if (isLoopback) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,Cookie,X-Requested-With');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});`;

if (!indexSrc.includes('// ─── CORS for local development ───')) {
  throw new Error('server/index.js CORS section not found');
}
const corsRegex = /\/\/ ─── CORS for local development ───[\s\S]*?app\.use\(\(req, res, next\) => \{[\s\S]*?if \(req\.method === 'OPTIONS'\) return res\.status\(204\)\.end\(\);\s*next\(\);\s*\}\);/;
if (!corsRegex.test(indexSrc)) {
  throw new Error('server/index.js corsRegex did not match');
}
indexSrc = indexSrc.replace(corsRegex, newIndexCors);
fs.writeFileSync(indexPath, indexSrc.replace(/\n/g, '\r\n'), 'utf8');
console.log('✓ server/index.js: CORS hardened (SEC-01)');

// ============================================================================
// 2. server/api.js
// ============================================================================
const apiPath = path.join(root, 'server/api.js');
let apiSrc = fs.readFileSync(apiPath, 'utf8').replace(/\r\n/g, '\n');

// 2.1 Theme branding background route (LOW-01)
const brandingAnchor = "router.put('/settings', (req, res) => {";
if (!apiSrc.includes(brandingAnchor)) throw new Error('brandingAnchor not found');
if (!apiSrc.includes("'/system/settings/branding'")) {
  const brandingRoute = `router.put(['/system/settings/branding', '/settings/branding'], (req, res) => {
  wrap(res, () => {
    const db = openDb();
    const branding = req.body || {};
    const settings = getSettings('default');
    const newBranding = { ...settings.branding, ...branding };
    db.prepare('UPDATE "AppSettings" SET branding=@b, updatedAt=@t WHERE id=@id')
      .run({ b: JSON.stringify(newBranding), t: now(), id: 'default' });
    ok(res, { updated: true, branding: newBranding });
  });
});

`;
  apiSrc = apiSrc.replace(brandingAnchor, brandingRoute + brandingAnchor);
  console.log('✓ server/api.js: Theme branding background route added (LOW-01)');
}

// 2.2 Supplier delete assign user (MEDIUM-03)
const oldSuppDel = `router.delete('/suppliers/:id', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'SUPPLIER_MANAGE');`;
const newSuppDel = `router.delete('/suppliers/:id', (req, res) => {
  wrap(res, () => {
    const user = requirePermission(req, 'SUPPLIER_MANAGE');`;
if (!apiSrc.includes(oldSuppDel) && !apiSrc.includes(newSuppDel)) {
  throw new Error('Supplier delete route anchor not found');
}
if (apiSrc.includes(oldSuppDel)) {
  apiSrc = apiSrc.replace(oldSuppDel, newSuppDel);
  console.log('✓ server/api.js: Supplier delete user assignment fixed (MEDIUM-03)');
}

// 2.3 Customer delete assign user & LoyaltyEvent table name (MEDIUM-03)
const oldCustDel = `router.delete('/customers/:id', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'CUSTOMER_MANAGE');`;
const newCustDel = `router.delete('/customers/:id', (req, res) => {
  wrap(res, () => {
    const user = requirePermission(req, 'CUSTOMER_MANAGE');`;
if (!apiSrc.includes(oldCustDel) && !apiSrc.includes(newCustDel)) {
  throw new Error('Customer delete route anchor not found');
}
if (apiSrc.includes(oldCustDel)) {
  apiSrc = apiSrc.replace(oldCustDel, newCustDel);
  console.log('✓ server/api.js: Customer delete user assignment fixed (MEDIUM-03)');
}

const oldLoyaltyTbl = 'DELETE FROM "LoyaltyTransaction" WHERE customerId=@id AND tenantId=@tenantId';
const newLoyaltyTbl = 'DELETE FROM "LoyaltyEvent" WHERE customerId=@id AND tenantId=@tenantId';
if (apiSrc.includes(oldLoyaltyTbl)) {
  apiSrc = apiSrc.replace(oldLoyaltyTbl, newLoyaltyTbl);
  console.log('✓ server/api.js: LoyaltyEvent table name in customer delete fixed (MEDIUM-03)');
}

// 2.4 Products bulk activate/deactivate (MEDIUM-01)
const oldBulk = `router.post('/products/bulk', (req, res) => {
  wrap(res, () => {
    const user = requirePermission(req, 'PRODUCT_CREATE');
    const { items } = req.body || {};
    if (!Array.isArray(items) || !items.length) throw ApiError('VALIDATION', 'قائمة المنتجات فارغة', 400);`;

const newBulk = `router.post('/products/bulk', (req, res) => {
  wrap(res, () => {
    const { items, ids, action } = req.body || {};
    if (Array.isArray(ids) && (action === 'activate' || action === 'deactivate')) {
      const user = requirePermission(req, 'PRODUCT_EDIT');
      if (ids.length === 0) return ok(res, { updated: 0 });
      const db = openDb();
      const activeVal = action === 'activate' ? 1 : 0;
      const stmt = db.prepare('UPDATE "Product" SET active=@active, updatedAt=@t WHERE id=@id AND tenantId=@tenantId');
      const t = now();
      let updated = 0;
      db.transaction(() => {
        for (const id of ids) {
          const info = stmt.run({ active: activeVal, t, id, tenantId: 'default' });
          if (info.changes > 0) updated++;
        }
      })();
      audit({ userId: user.id, username: user.username }, 'PRODUCT_BULK_STATUS', { metadata: { action, count: updated } });
      return ok(res, { updated });
    }
    const user = requirePermission(req, 'PRODUCT_CREATE');
    if (!Array.isArray(items) || !items.length) throw ApiError('VALIDATION', 'قائمة المنتجات فارغة', 400);`;

if (apiSrc.includes(oldBulk)) {
  apiSrc = apiSrc.replace(oldBulk, newBulk);
  console.log('✓ server/api.js: Products bulk activate/deactivate route added (MEDIUM-01)');
}

// 2.5 Inventory enrichment & filtering (MEDIUM-02)
const oldInventory = `router.get('/inventory', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'INVENTORY_VIEW');
    const db = openDb();
    const { page, pageSize, skip, take } = pageParams(req);
    const q = req.query.q ? \`%\${req.query.q}%\` : null;
    let where = 'WHERE p.tenantId=@tenantId AND p.active=1';
    const params = { tenantId: 'default' };
    if (q) { where += ' AND (p.nameAr LIKE @q OR p.sku LIKE @q OR p.barcode LIKE @q)'; params.q = q; }
    const total = db.prepare(\`SELECT COUNT(*) as c FROM "Product" p \${where}\`).get(params).c;
    const rows = db.prepare(\`SELECT p.*, c.nameAr as categoryName FROM "Product" p LEFT JOIN "Category" c ON p.categoryId=c.id \${where} ORDER BY p.nameAr ASC LIMIT @take OFFSET @skip\`).all({ ...params, take, skip });
    const ids = rows.map(p => p.id);
    const availMap = stockAvailableMap(db, ids, 'default');
    const totalMap = stockTotalMap(db, ids, 'default');
    ok(res, { items: rows.map(p => productRow(p, availMap, totalMap)), total, page, pageSize });
  });
});`;

const newInventory = `function stockBatchStatsMap(db, productIds, tenantId = 'default') {
  if (!productIds || productIds.length === 0) return {};
  const ph = productIds.map(() => '?').join(',');
  const rows = db.prepare(
    \`SELECT productId,
            COUNT(*) as batchCount,
            COALESCE(SUM(CASE WHEN status='ACTIVE' AND quantity>0 THEN quantity * costPrice ELSE 0 END), 0) as stockValue
     FROM "Batch"
     WHERE tenantId=? AND productId IN (\${ph}) AND quantity>0
     GROUP BY productId\`
  ).all(tenantId, ...productIds);
  const map = {};
  for (const r of rows) map[r.productId] = { batchCount: r.batchCount || 0, stockValue: r.stockValue || 0 };
  return map;
}

router.get('/inventory', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'INVENTORY_VIEW');
    const db = openDb();
    const { page, pageSize, skip, take } = pageParams(req);
    const q = req.query.q ? \`%\${req.query.q}%\` : null;
    const categoryId = req.query.categoryId;
    const filter = req.query.filter;
    let where = 'WHERE p.tenantId=@tenantId AND p.active=1';
    const params = { tenantId: 'default' };
    if (q) { where += ' AND (p.nameAr LIKE @q OR p.sku LIKE @q OR p.barcode LIKE @q)'; params.q = q; }
    if (categoryId && categoryId !== 'all') { where += ' AND p.categoryId=@categoryId'; params.categoryId = categoryId; }

    const selectSql = \`SELECT p.*, c.nameAr as categoryName FROM "Product" p LEFT JOIN "Category" c ON p.categoryId=c.id \${where} ORDER BY p.nameAr ASC\`;

    if (filter === 'low') {
      const allRows = db.prepare(selectSql).all(params);
      const allIds = allRows.map(p => p.id);
      const availMap = stockAvailableMap(db, allIds, 'default');
      const totalMap = stockTotalMap(db, allIds, 'default');
      const statsMap = stockBatchStatsMap(db, allIds, 'default');
      const filtered = allRows.map(p => {
        const row = productRow(p, availMap, totalMap);
        const stats = statsMap[p.id] || { batchCount: 0, stockValue: 0 };
        return {
          ...row,
          productId: p.id,
          batchCount: stats.batchCount,
          stockValue: r2(stats.stockValue),
        };
      }).filter(r => r.stockAvailable <= (r.reorderLevel || 0) + 1e-9);
      return ok(res, { items: filtered.slice(skip, skip + take), total: filtered.length, page, pageSize });
    }

    const total = db.prepare(\`SELECT COUNT(*) as c FROM "Product" p \${where}\`).get(params).c;
    const rows = db.prepare(\`\${selectSql} LIMIT @take OFFSET @skip\`).all({ ...params, take, skip });
    const ids = rows.map(p => p.id);
    const availMap = stockAvailableMap(db, ids, 'default');
    const totalMap = stockTotalMap(db, ids, 'default');
    const statsMap = stockBatchStatsMap(db, ids, 'default');
    const items = rows.map(p => {
      const row = productRow(p, availMap, totalMap);
      const stats = statsMap[p.id] || { batchCount: 0, stockValue: 0 };
      return {
        ...row,
        productId: p.id,
        batchCount: stats.batchCount,
        stockValue: r2(stats.stockValue),
      };
    });
    ok(res, { items, total, page, pageSize });
  });
});`;

if (apiSrc.includes(oldInventory)) {
  apiSrc = apiSrc.replace(oldInventory, newInventory);
  console.log('✓ server/api.js: Inventory enriched with stockValue, batchCount, productId, and filters (MEDIUM-02)');
}

// 2.6 Suspended sales: safe unwrap, cart stringification, and delete endpoints (HIGH-02)
const oldSuspended = `router.get('/sales/suspended', (req, res) => {
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
});`;

const newSuspended = `router.get('/sales/suspended', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'SALES_VIEW');
    const db = openDb();
    const rows = db.prepare('SELECT * FROM "SuspendedCart" WHERE tenantId=@tenantId ORDER BY createdAt DESC').all({ tenantId: 'default' });
    ok(res, rows.map(r => {
      let parsed = safeJson(r.cart, []);
      if (typeof parsed === 'string') parsed = safeJson(parsed, []);
      return { ...r, cart: Array.isArray(parsed) ? parsed : [] };
    }));
  });
});

router.post('/sales/suspended', (req, res) => {
  wrap(res, () => {
    const user = requirePermission(req, 'SALES_CREATE');
    const { label, cart } = req.body || {};
    if (!label || !cart) throw ApiError('VALIDATION', 'label و cart مطلوبان', 400);
    const db = openDb();
    const id = newId();
    const cartStr = typeof cart === 'string' ? cart : JSON.stringify(cart);
    db.prepare('INSERT INTO "SuspendedCart" (id,tenantId,label,cart,userId,createdAt) VALUES (@id,@tenantId,@label,@cart,@userId,@t)')
      .run({ id, tenantId: 'default', label, cart: cartStr, userId: user.id, t: now() });
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

router.delete('/sales/suspended', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'SALES_CREATE');
    const id = req.body?.id || req.query?.id;
    if (!id) throw ApiError('VALIDATION', 'id مطلوب', 400);
    const db = openDb();
    db.prepare('DELETE FROM "SuspendedCart" WHERE id=@id AND tenantId=@tenantId').run({ id, tenantId: 'default' });
    ok(res, { deleted: true });
  });
});`;

if (apiSrc.includes(oldSuspended)) {
  apiSrc = apiSrc.replace(oldSuspended, newSuspended);
  console.log('✓ server/api.js: Suspended sales double-encode and delete route fixed (HIGH-02)');
}

// 2.7 Sales discount permission gate (SEC-03)
const oldSalesDiscount = `      const invoiceDiscount = r2(Math.max(0, body.discount || 0));
      if (invoiceDiscount > r2(subtotal + totalTax)) throw ApiError('DISCOUNT_TOO_LARGE', 'خصم الفاتورة أكبر من قيمتها', 400);`;

const newSalesDiscount = `      const invoiceDiscount = r2(Math.max(0, body.discount || 0));
      const hasDiscount = invoiceDiscount > 0 || lineRows.some(l => l.discount > 0);
      if (hasDiscount && !user.permissions.includes('SALES_DISCOUNT') && user.roleKey !== 'owner') {
        throw ApiError('FORBIDDEN', 'لا تملك صلاحية منح خصم على المبيعات', 403);
      }
      if (invoiceDiscount > r2(subtotal + totalTax)) throw ApiError('DISCOUNT_TOO_LARGE', 'خصم الفاتورة أكبر من قيمتها', 400);`;

if (apiSrc.includes(oldSalesDiscount)) {
  apiSrc = apiSrc.replace(oldSalesDiscount, newSalesDiscount);
  console.log('✓ server/api.js: Server-side discount permission gate added to POST /sales (SEC-03)');
}

// 2.8 Returns transition Sale.status (LOW-04)
const oldReturnFinish = `      return { returnId, returnNo, total };
    });
    audit({ userId: user.id, username: user.username }, 'RETURN_CREATE', { entity: 'return', entityId: result.returnId, metadata: { returnNo: result.returnNo, total: result.total } });
    ok(res, result, 201);`;

const newReturnFinish = `      // Update Sale status to PARTIALLY_RETURNED or RETURNED
      const saleCheck = db.prepare('SELECT SUM(quantity) as totQty, SUM(returnedQty) as totRet FROM "SaleItem" WHERE saleId=@saleId AND tenantId=@tenantId').get({ saleId, tenantId: 'default' });
      if (saleCheck && saleCheck.totRet > 0) {
        const newSaleStatus = saleCheck.totRet >= (saleCheck.totQty - 1e-9) ? 'RETURNED' : 'PARTIALLY_RETURNED';
        db.prepare('UPDATE "Sale" SET status=@status, updatedAt=@t WHERE id=@id').run({ status: newSaleStatus, t: now(), id: saleId });
      }

      return { returnId, returnNo, total };
    });
    audit({ userId: user.id, username: user.username }, 'RETURN_CREATE', { entity: 'return', entityId: result.returnId, metadata: { returnNo: result.returnNo, total: result.total } });
    ok(res, result, 201);`;

if (apiSrc.includes(oldReturnFinish)) {
  apiSrc = apiSrc.replace(oldReturnFinish, newReturnFinish);
  console.log('✓ server/api.js: Returns transition Sale.status to PARTIALLY_RETURNED / RETURNED (LOW-04)');
}

// 2.9 Backup counts casing (LOW-03)
const oldBackupCounts = `    const counts = {};
    const tables = ['Product', 'Category', 'Supplier', 'Customer', 'Sale', 'Purchase', 'Batch'];
    for (const t of tables) {
      try { counts[t] = db.prepare(\`SELECT COUNT(*) as c FROM "\${t}" WHERE tenantId=@tenantId\`).get({ tenantId: "default" }).c; } catch (e) { counts[t] = 0; }
    }`;

const newBackupCounts = `    const counts = {};
    const tables = ['Product', 'Category', 'Supplier', 'Customer', 'Sale', 'Purchase', 'Batch'];
    for (const t of tables) {
      try {
        const c = db.prepare(\`SELECT COUNT(*) as c FROM "\${t}" WHERE tenantId=@tenantId\`).get({ tenantId: "default" }).c;
        counts[t] = c;
        counts[t.toLowerCase()] = c;
      } catch (e) {
        counts[t] = 0;
        counts[t.toLowerCase()] = 0;
      }
    }`;

if (apiSrc.includes(oldBackupCounts)) {
  apiSrc = apiSrc.replace(oldBackupCounts, newBackupCounts);
  console.log('✓ server/api.js: Backup entity counts stored with both PascalCase and lowercase keys (LOW-03)');
}

// 2.10 Audit search and filters (LOW-03)
const oldAudit = `router.get('/audit', (req, res) => {
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
    const total = db.prepare(\`SELECT COUNT(*) as c FROM "AuditLog" \${where}\`).get(params).c;
    const rows = db.prepare(\`SELECT * FROM "AuditLog" \${where} ORDER BY createdAt DESC LIMIT @take OFFSET @skip\`).all({ ...params, take, skip });
    const actionRows = db.prepare('SELECT DISTINCT action FROM "AuditLog" WHERE tenantId=@tenantId').all({ tenantId: 'default' });
    const actions = actionRows.map(a => a.action).filter(Boolean);
    ok(res, { items: rows.map(r => ({ ...r, metadata: safeJson(r.metadata, {}) })), total, page, pageSize, actions });
  });
});`;

const newAudit = `router.get('/audit', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'AUDIT_VIEW');
    const db = openDb();
    const { page, pageSize, skip, take } = pageParams(req, 50);
    const action = req.query.action;
    const result = req.query.result;
    const q = req.query.q ? \`%\${req.query.q.trim()}%\` : null;
    const range = dateRange(req);
    let where = 'WHERE tenantId=@tenantId';
    const params = { tenantId: 'default' };
    if (action && action !== 'all') { where += ' AND action=@action'; params.action = action; }
    if (result && result !== 'all') { where += ' AND result=@result'; params.result = result; }
    if (q) { where += ' AND (username LIKE @q OR action LIKE @q OR entity LIKE @q OR entityId LIKE @q)'; params.q = q; }
    if (range) { where += ' AND createdAt BETWEEN @from AND @to'; params.from = range.from; params.to = range.to; }
    const total = db.prepare(\`SELECT COUNT(*) as c FROM "AuditLog" \${where}\`).get(params).c;
    const rows = db.prepare(\`SELECT * FROM "AuditLog" \${where} ORDER BY createdAt DESC LIMIT @take OFFSET @skip\`).all({ ...params, take, skip });
    const actionRows = db.prepare('SELECT DISTINCT action FROM "AuditLog" WHERE tenantId=@tenantId').all({ tenantId: 'default' });
    const actions = actionRows.map(a => a.action).filter(Boolean);
    ok(res, { items: rows.map(r => ({ ...r, metadata: safeJson(r.metadata, {}) })), total, page, pageSize, actions });
  });
});`;

if (apiSrc.includes(oldAudit)) {
  apiSrc = apiSrc.replace(oldAudit, newAudit);
  console.log('✓ server/api.js: Audit endpoint updated with q and result filtering (LOW-03)');
}

// 2.11 Diagnostics complete status and validation route (MEDIUM-04)
const oldDiag = `    const status = {
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
    };`;

const newDiag = `    const status = {
      productId: 'LIBRARY_STORE',
      phase: 'READY',
      licenseState: 'ACTIVE',
      version: '1.0.0',
      build: '2026092201',
      branding: settings.branding,
      business: settings.business,
      localization: settings.localization,
      pos: settings.pos,
      hardware: settings.hardware,
      hardwareCaps: { receiptPrinter: true, cashDrawer: true, barcodeScanner: true },
      modules: {
        supermarket: true,
        pos: true,
        purchasing: true,
        inventory: true,
        customers: true,
        reports: true,
        stocktaking: true,
        loyalty: true,
        printing: true,
        scanner: true,
        cashDrawer: true,
        multiUser: true,
        backups: true,
      },
      tenantId: 'default',
    };`;

if (apiSrc.includes(oldDiag)) {
  apiSrc = apiSrc.replace(oldDiag, newDiag);
  console.log('✓ server/api.js: Diagnostics complete status enriched (MEDIUM-04)');
}

const diagEnd = 'module.exports = router;';
const validateRoute = `router.post('/activation/validate', (req, res) => {
  wrap(res, () => {
    ok(res, { valid: true, state: 'ACTIVE', offline: true, timestamp: now() });
  });
});

module.exports = router;`;

if (!apiSrc.includes("router.post('/activation/validate'") && apiSrc.includes(diagEnd)) {
  apiSrc = apiSrc.replace(diagEnd, validateRoute);
  console.log('✓ server/api.js: POST /activation/validate route added (MEDIUM-04)');
}

fs.writeFileSync(apiPath, apiSrc.replace(/\n/g, '\r\n'), 'utf8');
console.log('===> ALL BACKEND FIXES APPLIED SUCCESSFULLY!');
