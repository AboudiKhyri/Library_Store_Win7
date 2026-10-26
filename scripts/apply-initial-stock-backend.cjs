const fs = require('fs');
const path = require('path');

const apiPath = path.resolve(__dirname, '../server/api.js');
let content = fs.readFileSync(apiPath, 'utf8');

const isCRLF = content.includes('\r\n');
let code = content.replace(/\r\n/g, '\n');

const targetStr = `router.post('/products', (req, res) => {
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
        throw ApiError('BARCODE_EXISTS', \`الباركود مستخدم لمنتج آخر: \${existing.nameAr} (\${existing.sku})\`, 409, { existingProduct: { id: existing.id, nameAr: existing.nameAr, sku: existing.sku } });
      }
    }
    if (categoryId && !db.prepare('SELECT id FROM "Category" WHERE id=@id AND tenantId=@tenantId').get({ id: categoryId, tenantId: 'default' })) throw ApiError('CATEGORY_NOT_FOUND', 'التصنيف غير موجود', 400);
    const id = newId();
    db.prepare('INSERT INTO "Product" (id,tenantId,sku,nameAr,nameEn,genericName,barcode,categoryId,manufacturer,unit,packSize,isWeighable,purchasePrice,sellingPrice,minSellingPrice,taxRate,reorderLevel,active,notes,updatedAt) VALUES (@id,@tenantId,@sku,@nameAr,@nameEn,@genericName,@barcode,@categoryId,@manufacturer,@unit,@packSize,@isWeighable,@purchasePrice,@sellingPrice,@minSellingPrice,@taxRate,@reorderLevel,@active,@notes,@t)')
      .run({ id, tenantId: 'default', sku: sku.trim(), nameAr: nameAr.trim(), nameEn: nameEn || null, genericName: genericName || null, barcode: normBarcode, categoryId: categoryId || null, manufacturer: manufacturer || null, unit: unit || 'piece', packSize: packSize || 1, isWeighable: bool(isWeighable || false), purchasePrice: purchasePrice || 0, sellingPrice: Number(sellingPrice), minSellingPrice: minSellingPrice || null, taxRate: taxRate || 0, reorderLevel: reorderLevel !== undefined ? reorderLevel : 10, active: active !== false ? 1 : 0, notes: notes || null, t: now() });
    audit({ userId: user.id, username: user.username }, 'PRODUCT_CREATE', { entity: 'product', entityId: id, metadata: { sku, nameAr } });
    ok(res, { id, sku: sku.trim(), nameAr: nameAr.trim(), active: active !== false }, 201);
  });
});`;

const replacementStr = `router.post('/products', (req, res) => {
  wrap(res, () => {
    const user = requirePermission(req, 'PRODUCT_CREATE');
    const db = openDb();
    const { sku, nameAr, nameEn, genericName, barcode, categoryId, manufacturer, unit, packSize, isWeighable, purchasePrice, sellingPrice, minSellingPrice, taxRate, reorderLevel, active, notes, initialStock } = req.body || {};
    if (!sku || !nameAr || sellingPrice === undefined) throw ApiError('VALIDATION', 'sku, nameAr, sellingPrice مطلوبة', 400);
    if (db.prepare('SELECT id FROM "Product" WHERE tenantId=@tenantId AND sku=@sku').get({ tenantId: 'default', sku: sku.trim() })) throw ApiError('SKU_DUPLICATE', 'الكود الداخلي مستخدم لصنف آخر', 409);
    const normBarcode = normalizeBarcode(barcode);
    if (normBarcode) {
      const existing = db.prepare('SELECT id, nameAr, sku FROM "Product" WHERE tenantId=@tenantId AND barcode=@barcode').get({ tenantId: 'default', barcode: normBarcode });
      if (existing) {
        throw ApiError('BARCODE_EXISTS', \`الباركود مستخدم لمنتج آخر: \${existing.nameAr} (\${existing.sku})\`, 409, { existingProduct: { id: existing.id, nameAr: existing.nameAr, sku: existing.sku } });
      }
    }
    if (categoryId && !db.prepare('SELECT id FROM "Category" WHERE id=@id AND tenantId=@tenantId').get({ id: categoryId, tenantId: 'default' })) throw ApiError('CATEGORY_NOT_FOUND', 'التصنيف غير موجود', 400);
    
    const id = newId();
    const initialQty = Number(initialStock || 0);
    if (initialQty < 0) throw ApiError('VALIDATION', 'العدد المبدئي لا يمكن أن يكون سالباً', 400);

    transaction((txDb) => {
      txDb.prepare('INSERT INTO "Product" (id,tenantId,sku,nameAr,nameEn,genericName,barcode,categoryId,manufacturer,unit,packSize,isWeighable,purchasePrice,sellingPrice,minSellingPrice,taxRate,reorderLevel,active,notes,updatedAt) VALUES (@id,@tenantId,@sku,@nameAr,@nameEn,@genericName,@barcode,@categoryId,@manufacturer,@unit,@packSize,@isWeighable,@purchasePrice,@sellingPrice,@minSellingPrice,@taxRate,@reorderLevel,@active,@notes,@t)')
        .run({ id, tenantId: 'default', sku: sku.trim(), nameAr: nameAr.trim(), nameEn: nameEn || null, genericName: genericName || null, barcode: normBarcode, categoryId: categoryId || null, manufacturer: manufacturer || null, unit: unit || 'piece', packSize: packSize || 1, isWeighable: bool(isWeighable || false), purchasePrice: purchasePrice || 0, sellingPrice: Number(sellingPrice), minSellingPrice: minSellingPrice || null, taxRate: taxRate || 0, reorderLevel: reorderLevel !== undefined ? reorderLevel : 10, active: active !== false ? 1 : 0, notes: notes || null, t: now() });

      if (initialQty > 0) {
        const batchId = newId();
        const batchNo = \`INIT-\${Date.now().toString().slice(-6)}\`;
        const cost = Number(purchasePrice || 0);
        const sell = Number(sellingPrice);
        txDb.prepare(\`
          INSERT INTO "Batch" (id, tenantId, productId, batchNo, expiryDate, quantity, costPrice, sellPrice, status, updatedAt)
          VALUES (@id, @tenantId, @productId, @batchNo, NULL, @quantity, @costPrice, @sellPrice, 'ACTIVE', @t)
        \`).run({
          id: batchId,
          tenantId: 'default',
          productId: id,
          batchNo,
          quantity: initialQty,
          costPrice: cost,
          sellPrice: sell,
          t: now()
        });

        txDb.prepare(\`
          INSERT INTO "StockMovement" (id, tenantId, productId, batchId, type, quantity, unitCost, refType, refId, note, userId, createdAt)
          VALUES (@id, @tenantId, @productId, @batchId, 'INITIAL', @quantity, @unitCost, 'product', @refId, @note, @userId, @t)
        \`).run({
          id: newId(),
          tenantId: 'default',
          productId: id,
          batchId,
          quantity: initialQty,
          unitCost: cost,
          refId: id,
          note: 'رصيد افتتاحي عند إضافة الصنف',
          userId: user.id,
          t: now()
        });
      }
    });

    audit({ userId: user.id, username: user.username }, 'PRODUCT_CREATE', { entity: 'product', entityId: id, metadata: { sku, nameAr, initialStock: initialQty } });
    ok(res, { id, sku: sku.trim(), nameAr: nameAr.trim(), active: active !== false, initialStock: initialQty }, 201);
  });
});`;

if (!code.includes(targetStr)) {
  console.error('Target string not found in server/api.js');
  process.exit(1);
}

code = code.replace(targetStr, replacementStr);
const finalContent = isCRLF ? code.replace(/\n/g, '\r\n') : code;
fs.writeFileSync(apiPath, finalContent, 'utf8');
console.log('✓ Successfully patched server/api.js with initialStock support');
