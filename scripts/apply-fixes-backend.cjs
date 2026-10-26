const fs = require('fs');
const path = require('path');

const p = path.resolve(__dirname, '../server/api.js');
let src = fs.readFileSync(p, 'utf8');

// 1. CORS Hardening
const oldCors = `router.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});`;

const newCors = `router.use((req, res, next) => {
  const origin = req.headers.origin;
  const isLoopback = origin && (/^https?:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d+)?$/.test(origin) || origin.startsWith('file://') || origin.startsWith('vscode-webview://'));
  if (origin && isLoopback) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});`;

if (!src.includes(oldCors)) throw new Error('oldCors not found');
src = src.replace(oldCors, newCors);
console.log('✓ 1. CORS hardening applied');

// 2. Background Theme Branding Route
const brandingRouteAnchor = "router.put('/settings', (req, res) => {";
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

if (!src.includes(brandingRouteAnchor)) throw new Error('brandingRouteAnchor not found');
src = src.replace(brandingRouteAnchor, brandingRoute + brandingRouteAnchor);
console.log('✓ 2. Theme branding background route added');

// 3. Supplier delete: assign user
const oldSuppDel = `router.delete('/suppliers/:id', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'SUPPLIER_MANAGE');`;
const newSuppDel = `router.delete('/suppliers/:id', (req, res) => {
  wrap(res, () => {
    const user = requirePermission(req, 'SUPPLIER_MANAGE');`;
if (!src.includes(oldSuppDel)) throw new Error('oldSuppDel not found');
src = src.replace(oldSuppDel, newSuppDel);
console.log('✓ 3. Supplier delete user assignment fixed');

// 4. Customer delete: assign user + LoyaltyEvent table name
const oldCustDel = `router.delete('/customers/:id', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'CUSTOMER_MANAGE');`;
const newCustDel = `router.delete('/customers/:id', (req, res) => {
  wrap(res, () => {
    const user = requirePermission(req, 'CUSTOMER_MANAGE');`;
if (!src.includes(oldCustDel)) throw new Error('oldCustDel not found');
src = src.replace(oldCustDel, newCustDel);

const oldLoyaltyTbl = 'DELETE FROM "LoyaltyTransaction" WHERE customerId=@id AND tenantId=@tenantId';
const newLoyaltyTbl = 'DELETE FROM "LoyaltyEvent" WHERE customerId=@id AND tenantId=@tenantId';
if (!src.includes(oldLoyaltyTbl)) throw new Error('oldLoyaltyTbl not found');
src = src.replace(oldLoyaltyTbl, newLoyaltyTbl);
console.log('✓ 4. Customer delete user assignment and LoyaltyEvent table fixed');

// 5. Products Bulk Actions: support { ids, action }
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

if (!src.includes(oldBulk)) throw new Error('oldBulk not found');
src = src.replace(oldBulk, newBulk);
console.log('✓ 5. Products bulk activate/deactivate route added');

// 6. Inventory helpers and Current Stock enriched endpoint
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

if (!src.includes(oldInventory)) throw new Error('oldInventory not found');
src = src.replace(oldInventory, newInventory);
console.log('✓ 6. Inventory enriched with stockValue, batchCount, productId, and filters');

// 7. Suspended sales: safe unwrap, cart stringification, and delete endpoints
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

if (!src.includes(oldSuspended)) throw new Error('oldSuspended not found');
src = src.replace(oldSuspended, newSuspended);
console.log('✓ 7. Suspended sales double-encode and delete route fixed');

// 8. Server-side discount permission check in POST /sales
const oldSalesDiscount = `      const invoiceDiscount = r2(Math.max(0, body.discount || 0));
      if (invoiceDiscount > r2(subtotal + totalTax)) throw ApiError('DISCOUNT_TOO_LARGE', 'خصم الفاتورة أكبر من قيمتها', 400);`;

const newSalesDiscount = `      const invoiceDiscount = r2(Math.max(0, body.discount || 0));
      const hasDiscount = invoiceDiscount > 0 || lineRows.some(l => l.discount > 0);
      if (hasDiscount && !user.permissions.includes('SALES_DISCOUNT') && user.roleKey !== 'owner') {
        throw ApiError('FORBIDDEN', 'لا تملك صلاحية منح خصم على المبيعات', 403);
      }
      if (invoiceDiscount > r2(subtotal + totalTax)) throw ApiError('DISCOUNT_TOO_LARGE', 'خصم الفاتورة أكبر من قيمتها', 400);`;

if (!src.includes(oldSalesDiscount)) throw new Error('oldSalesDiscount not found');
src = src.replace(oldSalesDiscount, newSalesDiscount);
console.log('✓ 8. Server-side discount permission gate added to POST /sales');

// 9. Returns transition Sale.status
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

if (!src.includes(oldReturnFinish)) throw new Error('oldReturnFinish not found');
src = src.replace(oldReturnFinish, newReturnFinish);
console.log('✓ 9. Returns transition Sale.status to PARTIALLY_RETURNED / RETURNED');

// 10. Backup counts casing
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

if (!src.includes(oldBackupCounts)) throw new Error('oldBackupCounts not found');
src = src.replace(oldBackupCounts, newBackupCounts);
console.log('✓ 10. Backup entity counts stored with both PascalCase and lowercase keys');

// 11. Audit search and filters
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

if (!src.includes(oldAudit)) throw new Error('oldAudit not found');
src = src.replace(oldAudit, newAudit);
console.log('✓ 11. Audit endpoint updated with q and result filtering');

// 12. Diagnostics complete status and validation route
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

if (!src.includes(oldDiag)) throw new Error('oldDiag not found');
src = src.replace(oldDiag, newDiag);

const diagEnd = 'module.exports = router;';
const validateRoute = `router.post('/activation/validate', (req, res) => {
  wrap(res, () => {
    ok(res, { valid: true, state: 'ACTIVE', offline: true, timestamp: now() });
  });
});

module.exports = router;`;

if (!src.includes(diagEnd)) throw new Error('diagEnd not found');
src = src.replace(diagEnd, validateRoute);
console.log('✓ 12. Diagnostics complete status and POST /activation/validate route added');

fs.writeFileSync(p, src, 'utf8');
console.log('===> ALL SERVER/API.JS FIXES SUCCESSFULLY APPLIED!');
