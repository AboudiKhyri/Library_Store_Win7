/**
 * Forensic script to update server/api.js:
 * 1. Switch batch ordering from FEFO (expiryDate ASC) to FIFO (createdAt ASC, id ASC)
 * 2. Set expiryDate to null on Batch/SaleItem/PurchaseItem creation and queries
 * 3. Remove expiry/near filters from /inventory/batches and /inventory/expiry/sweep
 * 4. Remove expiry reports and stockExpired fields
 * 5. Remove nearExpiryCount and expiredCount from Dashboard calculation
 * 6. Map EXPIRY_WRITEOFF to generic label for historical movements
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const apiPath = path.join(root, 'server', 'api.js');
let code = fs.readFileSync(apiPath, 'utf8').replace(/\r\n/g, '\n');

// 1. Line 697: Product details batches order & expiryDate
code = code.replace(
  'SELECT b.*, s.name as supplierName FROM "Batch" b LEFT JOIN "Supplier" s ON b.supplierId=s.id WHERE b.productId=@id AND b.tenantId=@tenantId ORDER BY b.expiryDate ASC NULLS LAST, b.createdAt ASC',
  'SELECT b.*, s.name as supplierName FROM "Batch" b LEFT JOIN "Supplier" s ON b.supplierId=s.id WHERE b.productId=@id AND b.tenantId=@tenantId ORDER BY b.createdAt DESC, b.id DESC'
);
code = code.replace(
  'expiryDate: b.expiryDate ? (typeof b.expiryDate === \'string\' ? b.expiryDate : new Date(b.expiryDate).toISOString()) : null,',
  'expiryDate: null, /* DEPRECATED */'
);

// 2. Lines 805-885: /inventory/batches route
const oldBatchesSection = `    const filter = req.query.filter; // 'expired' | 'near' | 'valid' | 'depleted'
    const status = req.query.status;

    const settings = getSettings('default');
    const warningDays = (settings.pos && settings.pos.expiryWarningDays) || 30;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();
    const nearCutoff = new Date(today.getTime() + warningDays * 86400000).toISOString();

    let where = 'WHERE b.tenantId=@tenantId';
    const params = { tenantId: 'default' };
    if (productId) { where += ' AND b.productId=@productId'; params.productId = productId; }
    if (status) { where += ' AND b.status=@status'; params.status = status; }
    if (q) {
      where += ' AND (p.nameAr LIKE @q OR p.nameEn LIKE @q OR p.sku LIKE @q OR b.batchNo LIKE @q)';
      params.q = q;
    }

    if (filter === 'expired') {
      where += " AND (b.status='EXPIRED' OR (b.expiryDate IS NOT NULL AND b.expiryDate < @todayIso))";
      params.todayIso = todayIso;
    } else if (filter === 'near') {
      where += " AND b.status='ACTIVE' AND b.quantity > 0 AND b.expiryDate >= @todayIso AND b.expiryDate <= @nearCutoff";
      params.todayIso = todayIso;
      params.nearCutoff = nearCutoff;
    } else if (filter === 'valid') {
      where += " AND b.status='ACTIVE' AND b.quantity > 0 AND (b.expiryDate IS NULL OR b.expiryDate > @nearCutoff)";
      params.nearCutoff = nearCutoff;
    } else if (filter === 'depleted') {
      where += " AND b.quantity <= 0";
    }

    const countSql = \`SELECT COUNT(*) as c FROM "Batch" b JOIN "Product" p ON b.productId=p.id \${where}\`;
    const total = db.prepare(countSql).get(params).c;

    const selectSql = \`SELECT b.*, p.nameAr as productName, p.sku, s.name as supplierName, pu.invoiceNo as purchaseInvoiceNo
      FROM "Batch" b
      JOIN "Product" p ON b.productId=p.id
      LEFT JOIN "Supplier" s ON b.supplierId=s.id
      LEFT JOIN "Purchase" pu ON b.purchaseId=pu.id
      \${where}
      ORDER BY b.expiryDate ASC NULLS LAST, b.createdAt ASC
      LIMIT @take OFFSET @skip\`;

    const rows = db.prepare(selectSql).all({ ...params, take, skip });

    const statsExpired = db.prepare("SELECT COUNT(*) as c FROM \\"Batch\\" WHERE tenantId=@tenantId AND (status='EXPIRED' OR (expiryDate IS NOT NULL AND expiryDate < @todayIso))").get({ tenantId: 'default', todayIso }).c;
    const statsNear = db.prepare("SELECT COUNT(*) as c FROM \\"Batch\\" WHERE tenantId=@tenantId AND status='ACTIVE' AND quantity > 0 AND expiryDate >= @todayIso AND expiryDate <= @nearCutoff").get({ tenantId: 'default', todayIso, nearCutoff }).c;
    const statsValid = db.prepare("SELECT COUNT(*) as c FROM \\"Batch\\" WHERE tenantId=@tenantId AND status='ACTIVE' AND quantity > 0 AND (expiryDate IS NULL OR expiryDate > @nearCutoff)").get({ tenantId: 'default', nearCutoff }).c;

    const items = rows.map(b => {
      let daysLeft = null;
      if (b.expiryDate) {
        const exp = new Date(b.expiryDate);
        daysLeft = Math.round((new Date(exp.getFullYear(), exp.getMonth(), exp.getDate()).getTime() - today.getTime()) / 86400000);
      }
      return {
        id: b.id,
        productId: b.productId,
        productName: b.productName,
        sku: b.sku,
        batchNo: b.batchNo,
        expiryDate: b.expiryDate ? (typeof b.expiryDate === 'string' ? b.expiryDate : new Date(b.expiryDate).toISOString()) : null,
        daysLeft,
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
      warningDays,
      stats: { expired: statsExpired, near: statsNear, valid: statsValid },
    });`;

const newBatchesSection = `    const filter = req.query.filter; // 'depleted' | 'active'
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

    const countSql = \`SELECT COUNT(*) as c FROM "Batch" b JOIN "Product" p ON b.productId=p.id \${where}\`;
    const total = db.prepare(countSql).get(params).c;

    const selectSql = \`SELECT b.*, p.nameAr as productName, p.sku, s.name as supplierName, pu.invoiceNo as purchaseInvoiceNo
      FROM "Batch" b
      JOIN "Product" p ON b.productId=p.id
      LEFT JOIN "Supplier" s ON b.supplierId=s.id
      LEFT JOIN "Purchase" pu ON b.purchaseId=pu.id
      \${where}
      ORDER BY b.createdAt DESC, b.id DESC
      LIMIT @take OFFSET @skip\`;

    const rows = db.prepare(selectSql).all({ ...params, take, skip });

    const statsActive = db.prepare("SELECT COUNT(*) as c FROM \\"Batch\\" WHERE tenantId=@tenantId AND status='ACTIVE' AND quantity > 0").get({ tenantId: 'default' }).c;
    const statsDepleted = db.prepare("SELECT COUNT(*) as c FROM \\"Batch\\" WHERE tenantId=@tenantId AND quantity <= 0").get({ tenantId: 'default' }).c;

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
    });`;

if (!code.includes(oldBatchesSection)) {
  console.error('Error: oldBatchesSection not found in server/api.js');
  process.exit(1);
}
code = code.replace(oldBatchesSection, newBatchesSection);

// 3. /inventory/adjust newStatus & /inventory/expiry/sweep no-op
code = code.replace(
  "const newStatus = counted === 0 && adjType === 'EXPIRY_WRITEOFF' ? 'EXPIRED' : counted === 0 ? 'DEPLETED' : batch.status === 'DEPLETED' ? 'ACTIVE' : batch.status;",
  "const newStatus = counted === 0 ? 'DEPLETED' : batch.status === 'DEPLETED' ? 'ACTIVE' : batch.status;"
);

const oldSweep = `router.post('/inventory/expiry/sweep', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'INVENTORY_ADJUST');
    const db = openDb();
    const result = db.prepare("UPDATE \\"Batch\\" SET status='EXPIRED',updatedAt=@t WHERE tenantId=@tenantId AND status='ACTIVE' AND expiryDate IS NOT NULL AND date(expiryDate) < date('now')").run({ t: now(), tenantId: 'default' });
    ok(res, { swept: result.changes });
  });
});`;

const newSweep = `router.post('/inventory/expiry/sweep', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'INVENTORY_ADJUST');
    // Stationery store: products do not expire. Sweep is a safe no-op.
    ok(res, { swept: 0 });
  });
});`;

if (!code.includes(oldSweep)) {
  console.error('Error: oldSweep not found in server/api.js');
  process.exit(1);
}
code = code.replace(oldSweep, newSweep);

// 4. Stocktake batches query & scan order
code = code.replace(
  'SELECT p.id, p.nameAr, b.id as batchId, b.batchNo, b.quantity, b.expiryDate FROM "Product" p LEFT JOIN "Batch" b ON p.id=b.productId AND b.quantity>0 AND b.tenantId=@tenantId WHERE p.tenantId=@tenantId AND p.active=1 ORDER BY p.nameAr ASC',
  'SELECT p.id, p.nameAr, b.id as batchId, b.batchNo, b.quantity FROM "Product" p LEFT JOIN "Batch" b ON p.id=b.productId AND b.quantity>0 AND b.tenantId=@tenantId WHERE p.tenantId=@tenantId AND p.active=1 ORDER BY p.nameAr ASC'
);
code = code.replace(
  'if (row.batchId) { byProduct[row.id].systemQty = r3(byProduct[row.id].systemQty + row.quantity); byProduct[row.id].batches.push({ id: row.batchId, batchNo: row.batchNo, qty: row.quantity, expiryDate: row.expiryDate }); }',
  'if (row.batchId) { byProduct[row.id].systemQty = r3(byProduct[row.id].systemQty + row.quantity); byProduct[row.id].batches.push({ id: row.batchId, batchNo: row.batchNo, qty: row.quantity, expiryDate: null }); }'
);
code = code.replace(
  'SELECT * FROM "Batch" WHERE productId IN (${productIds.map((_, i) => `@p${i}`).join(\',\')}) AND tenantId=@tenantId AND quantity > 0 ORDER BY expiryDate ASC NULLS LAST, createdAt ASC',
  'SELECT * FROM "Batch" WHERE productId IN (${productIds.map((_, i) => `@p${i}`).join(\',\')}) AND tenantId=@tenantId AND quantity > 0 ORDER BY createdAt ASC, id ASC'
);
code = code.replace(
  'SELECT * FROM "Batch" WHERE productId=@productId AND tenantId=@tenantId AND quantity>0 ORDER BY expiryDate ASC NULLS LAST, createdAt ASC',
  'SELECT * FROM "Batch" WHERE productId=@productId AND tenantId=@tenantId AND quantity>0 ORDER BY createdAt ASC, id ASC'
);

// 5. Receipt builder allocations
code = code.replace(
  'expiry: item.expiryDate ? (typeof item.expiryDate === \'string\' ? item.expiryDate : new Date(item.expiryDate).toISOString()) : null,',
  'expiry: null,'
);

// 6. Sales checkout FIFO allocation
const oldFefoAlloc = `        // FEFO allocation
        const batches = db.prepare(\`SELECT * FROM "Batch" WHERE productId=@productId AND tenantId=@tenantId AND status='ACTIVE' AND quantity>0 AND (expiryDate IS NULL OR date(expiryDate)>=date(@today)) ORDER BY expiryDate ASC NULLS LAST, createdAt ASC\`).all({ productId: item.productId, tenantId: 'default', today });
        const allocations = [];
        let remaining = item.quantity;
        for (const batch of batches) {
          if (remaining <= 1e-9) break;
          const take = r3(Math.min(batch.quantity, remaining));
          if (take <= 0) continue;
          allocations.push({ batchId: batch.id, batchNo: batch.batchNo, expiryDate: batch.expiryDate, qty: take, costPrice: batch.costPrice });
          remaining = r3(remaining - take);
        }`;

const newFifoAlloc = `        // FIFO allocation (oldest batch first by createdAt, then id tie-breaker)
        const batches = db.prepare(\`SELECT * FROM "Batch" WHERE productId=@productId AND tenantId=@tenantId AND status='ACTIVE' AND quantity>0 ORDER BY createdAt ASC, id ASC\`).all({ productId: item.productId, tenantId: 'default' });
        const allocations = [];
        let remaining = item.quantity;
        for (const batch of batches) {
          if (remaining <= 1e-9) break;
          const take = r3(Math.min(batch.quantity, remaining));
          if (take <= 0) continue;
          allocations.push({ batchId: batch.id, batchNo: batch.batchNo, expiryDate: null, qty: take, costPrice: batch.costPrice });
          remaining = r3(remaining - take);
        }`;

if (!code.includes(oldFefoAlloc)) {
  console.error('Error: oldFefoAlloc not found in server/api.js');
  process.exit(1);
}
code = code.replace(oldFefoAlloc, newFifoAlloc);

// Remove `const today = new Date().toISOString().split('T')[0];` if unused in sales
code = code.replace('      const today = new Date().toISOString().split(\'T\')[0];\n', '');

// SaleItem insert with null expiryDate
code = code.replace(
  'expiryDate: alloc.expiryDate,',
  'expiryDate: null,'
);

// Purchases receive batch insert
code = code.replace(
  'expiryDate: item.expiryDate || null, quantity: item.quantity, costPrice: item.unitCost, sellPrice: product.sellingPrice, supplierId: purchase.supplierId, purchaseId, t: now()',
  'expiryDate: null, quantity: item.quantity, costPrice: item.unitCost, sellPrice: product.sellingPrice, supplierId: purchase.supplierId, purchaseId, t: now()'
);
code = code.replace(
  'expiryDate: v.item.expiryDate || null, quantity: v.qty, unitCost: v.unitCost, total: r2(v.qty * v.unitCost)',
  'expiryDate: null, quantity: v.qty, unitCost: v.unitCost, total: r2(v.qty * v.unitCost)'
);

// 7. Labels & Export headers
code = code.replace(
  "EXPIRY_WRITEOFF: 'إعدام صلاحية',",
  "EXPIRY_WRITEOFF: 'إعدام/تسوية مخزنية',"
);
code = code.replace(
  "    { header: 'منتهي الصلاحية', get: (r) => r.stockExpired },\n",
  ""
);
code = code.replace(
  "'purchases', 'suppliers', 'inventory', 'low-stock', 'expiry', 'returns', 'movements'",
  "'purchases', 'suppliers', 'inventory', 'low-stock', 'returns', 'movements'"
);
code = code.replace(
  "const SNAPSHOT_TYPES = ['inventory', 'low-stock', 'expiry'];",
  "const SNAPSHOT_TYPES = ['inventory', 'low-stock'];"
);

// In case 'inventory': remove stockExpired
const oldInvCase = `        const rows = products.map(p => {
          let stockTotal = 0, stockAvailable = 0, stockExpired = 0, value = 0;
          const pBatches = bMap.get(p.id) || [];
          for (const b of pBatches) {
            stockTotal += b.quantity;
            value += b.quantity * b.costPrice;
            const exp = b.expiryDate ? new Date(b.expiryDate) : null;
            if (exp && exp < todayMid) stockExpired += b.quantity;
            else if (b.status === 'ACTIVE') stockAvailable += b.quantity;
          }
          return {
            productName: p.productName,
            sku: p.sku,
            categoryName: p.categoryName || '—',
            stockTotal: r3(stockTotal),
            stockAvailable: r3(stockAvailable),
            stockExpired: r3(stockExpired),
            value: r2(value),
            reorderLevel: p.reorderLevel,
          };
        }).sort((a, b) => b.value - a.value);`;

const newInvCase = `        const rows = products.map(p => {
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
        }).sort((a, b) => b.value - a.value);`;

if (!code.includes(oldInvCase)) {
  console.error('Error: oldInvCase not found in server/api.js');
  process.exit(1);
}
code = code.replace(oldInvCase, newInvCase);

// low-stock report query: remove expiry condition
code = code.replace(
  'SELECT productId, quantity FROM "Batch" WHERE tenantId=@tenantId AND quantity>0 AND status=\'ACTIVE\' AND (expiryDate IS NULL OR expiryDate>=@todayIso)',
  'SELECT productId, quantity FROM "Batch" WHERE tenantId=@tenantId AND quantity>0 AND status=\'ACTIVE\''
);

// case 'expiry': return empty
const oldExpiryCasePattern = /case 'expiry': \{[\s\S]*?break;\s*\}/;
const newExpiryCase = `case 'expiry': {
        // Expiry report removed for stationery store. Return empty snapshot.
        result = { rows: [], totals: { totalValue: 0, expiredCount: 0, nearCount: 0, validCount: 0, expiredValue: 0, nearValue: 0 } };
        break;
      }`;

if (!oldExpiryCasePattern.test(code)) {
  console.error('Error: oldExpiryCasePattern not matched in server/api.js');
  process.exit(1);
}
code = code.replace(oldExpiryCasePattern, newExpiryCase);

// 8. Dashboard: remove expiry calculation
const oldDashboardBatches = `    const batches = db.prepare("SELECT productId, quantity, costPrice, expiryDate, status FROM \\"Batch\\" WHERE tenantId=@tenantId AND quantity>0 AND status IN ('ACTIVE','EXPIRED')").all({ tenantId: 'default' });

    let stockValue = 0;
    let nearExpiryCount = 0;
    let expiredCount = 0;
    const perProduct = new Map();

    for (const b of batches) {
      stockValue += (b.quantity || 0) * (b.costPrice || 0);
      if (b.expiryDate) {
        const expTime = new Date(b.expiryDate).getTime();
        if (expTime < todayTime) {
          expiredCount++;
        } else if (expTime <= warningLimitTime) {
          nearExpiryCount++;
        }
      }
      perProduct.set(b.productId, (perProduct.get(b.productId) || 0) + (b.quantity || 0));
    }`;

const newDashboardBatches = `    const batches = db.prepare("SELECT productId, quantity, costPrice, status FROM \\"Batch\\" WHERE tenantId=@tenantId AND quantity>0 AND status='ACTIVE'").all({ tenantId: 'default' });

    let stockValue = 0;
    let nearExpiryCount = 0;
    let expiredCount = 0;
    const perProduct = new Map();

    for (const b of batches) {
      stockValue += (b.quantity || 0) * (b.costPrice || 0);
      perProduct.set(b.productId, (perProduct.get(b.productId) || 0) + (b.quantity || 0));
    }`;

if (!code.includes(oldDashboardBatches)) {
  console.error('Error: oldDashboardBatches not found in server/api.js');
  process.exit(1);
}
code = code.replace(oldDashboardBatches, newDashboardBatches);

// Write back with CRLF
code = code.replace(/\n/g, '\r\n');
fs.writeFileSync(apiPath, code, 'utf8');
console.log('✓ server/api.js updated successfully');
