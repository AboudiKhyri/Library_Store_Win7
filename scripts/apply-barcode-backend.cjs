/**
 * Forensic script to update server/db.js, server/api.js, server/index.js,
 * and desktop/engine/main/window-manager.js for barcode normalization,
 * EAN-13 BARCODE_EXISTS enforcement, CSP media-src, and Electron camera permissions.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// 1. Update server/db.js
const dbPath = path.join(root, 'server', 'db.js');
let dbCode = fs.readFileSync(dbPath, 'utf8').replace(/\r\n/g, '\n');

dbCode = dbCode.replace('const SCHEMA_VERSION = 2;', 'const SCHEMA_VERSION = 3;');

const oldMigrationV2 = `      db.pragma('user_version = 2');
    } catch (e) {
      console.warn("[DB] Migration to v2 warning:", e && e.message);
    }
  }`;

const newMigrationV3 = `      db.pragma('user_version = 2');
    } catch (e) {
      console.warn("[DB] Migration to v2 warning:", e && e.message);
    }
  }

  // Idempotent migration v2 -> v3: Clean any empty string barcodes to NULL
  // Ensures Product_tenantId_barcode_key UNIQUE index does not fail on products without barcode
  if (version < 3) {
    try {
      db.prepare("UPDATE Product SET barcode = NULL WHERE barcode IS NOT NULL AND (barcode = '' OR TRIM(barcode) = '')").run();
      db.pragma('user_version = 3');
    } catch (e) {
      console.warn("[DB] Migration to v3 warning:", e && e.message);
    }
  }`;

if (!dbCode.includes(oldMigrationV2)) {
  console.error('Error: oldMigrationV2 not found in server/db.js');
  process.exit(1);
}
dbCode = dbCode.replace(oldMigrationV2, newMigrationV3);
dbCode = dbCode.replace(/\n/g, '\r\n');
fs.writeFileSync(dbPath, dbCode, 'utf8');
console.log('✓ server/db.js updated to SCHEMA_VERSION = 3 with v3 migration');

// 2. Update server/api.js
const apiPath = path.join(root, 'server', 'api.js');
let apiCode = fs.readFileSync(apiPath, 'utf8').replace(/\r\n/g, '\n');

// Add normalizeBarcode function near top helper section
const helperAnchor = 'function productRow(p, availMap, totalMap) {';
const normalizeBarcodeFn = `function normalizeBarcode(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).replace(/[\\x00-\\x1F\\x7F]/g, '').trim();
  return s.length > 0 ? s : null;
}

`;

if (!apiCode.includes(normalizeBarcodeFn)) {
  if (!apiCode.includes(helperAnchor)) {
    console.error('Error: helperAnchor not found in server/api.js');
    process.exit(1);
  }
  apiCode = apiCode.replace(helperAnchor, normalizeBarcodeFn + helperAnchor);
}

// In POST /products
const oldPostCheck = `    if (barcode && db.prepare('SELECT id FROM "Product" WHERE tenantId=@tenantId AND barcode=@barcode').get({ tenantId: 'default', barcode: barcode.trim() })) throw ApiError('BARCODE_DUPLICATE', 'الباركود مستخدم لمنتج آخر', 409);`;
const newPostCheck = `    const normBarcode = normalizeBarcode(barcode);
    if (normBarcode) {
      const existing = db.prepare('SELECT id, nameAr, sku FROM "Product" WHERE tenantId=@tenantId AND barcode=@barcode').get({ tenantId: 'default', barcode: normBarcode });
      if (existing) {
        throw ApiError('BARCODE_EXISTS', \`الباركود مستخدم لمنتج آخر: \${existing.nameAr} (\${existing.sku})\`, 409, { existingProduct: { id: existing.id, nameAr: existing.nameAr, sku: existing.sku } });
      }
    }`;

if (!apiCode.includes(oldPostCheck)) {
  console.error('Error: oldPostCheck not found in server/api.js');
  process.exit(1);
}
apiCode = apiCode.replace(oldPostCheck, newPostCheck);

// In POST /products insert run params
apiCode = apiCode.replace(
  'barcode: barcode || null,',
  'barcode: normBarcode,'
);

// In POST /products/bulk
apiCode = apiCode.replace(
  'barcode: item.barcode || null,',
  'barcode: normalizeBarcode(item.barcode),'
);

// In PUT /products/:id
const oldPutTarget = `    const b = req.body || {};
    db.prepare('UPDATE "Product" SET nameAr=@nameAr,nameEn=@nameEn,genericName=@genericName,barcode=@barcode,categoryId=@categoryId,manufacturer=@manufacturer,unit=@unit,packSize=@packSize,isWeighable=@isWeighable,purchasePrice=@purchasePrice,sellingPrice=@sellingPrice,minSellingPrice=@minSellingPrice,taxRate=@taxRate,reorderLevel=@reorderLevel,active=@active,notes=@notes,updatedAt=@t WHERE id=@id')
      .run({ nameAr: b.nameAr || row.nameAr, nameEn: b.nameEn !== undefined ? b.nameEn : row.nameEn, genericName: b.genericName !== undefined ? b.genericName : row.genericName, barcode: b.barcode !== undefined ? b.barcode : row.barcode,`;

const newPutTarget = `    const b = req.body || {};
    const normBarcode = b.barcode !== undefined ? normalizeBarcode(b.barcode) : row.barcode;
    if (normBarcode) {
      const existing = db.prepare('SELECT id, nameAr, sku FROM "Product" WHERE tenantId=@tenantId AND barcode=@barcode AND id!=@id').get({ tenantId: 'default', barcode: normBarcode, id: req.params.id });
      if (existing) {
        throw ApiError('BARCODE_EXISTS', \`الباركود مستخدم لمنتج آخر: \${existing.nameAr} (\${existing.sku})\`, 409, { existingProduct: { id: existing.id, nameAr: existing.nameAr, sku: existing.sku } });
      }
    }
    db.prepare('UPDATE "Product" SET nameAr=@nameAr,nameEn=@nameEn,genericName=@genericName,barcode=@barcode,categoryId=@categoryId,manufacturer=@manufacturer,unit=@unit,packSize=@packSize,isWeighable=@isWeighable,purchasePrice=@purchasePrice,sellingPrice=@sellingPrice,minSellingPrice=@minSellingPrice,taxRate=@taxRate,reorderLevel=@reorderLevel,active=@active,notes=@notes,updatedAt=@t WHERE id=@id')
      .run({ nameAr: b.nameAr || row.nameAr, nameEn: b.nameEn !== undefined ? b.nameEn : row.nameEn, genericName: b.genericName !== undefined ? b.genericName : row.genericName, barcode: normBarcode,`;

if (!apiCode.includes(oldPutTarget)) {
  console.error('Error: oldPutTarget not found in server/api.js');
  process.exit(1);
}
apiCode = apiCode.replace(oldPutTarget, newPutTarget);

apiCode = apiCode.replace(/\n/g, '\r\n');
fs.writeFileSync(apiPath, apiCode, 'utf8');
console.log('✓ server/api.js updated with normalizeBarcode and BARCODE_EXISTS');

// 3. Update server/index.js (CSP media-src)
const indexPath = path.join(root, 'server', 'index.js');
let indexCode = fs.readFileSync(indexPath, 'utf8').replace(/\r\n/g, '\n');

indexCode = indexCode.replace(
  "font-src 'self' data:;\"",
  "font-src 'self' data:; media-src 'self' blob: data:;\""
);

indexCode = indexCode.replace(/\n/g, '\r\n');
fs.writeFileSync(indexPath, indexCode, 'utf8');
console.log('✓ server/index.js updated with media-src CSP');

// 4. Update desktop/engine/main/window-manager.js (camera permissions)
const wmPath = path.join(root, 'desktop', 'engine', 'main', 'window-manager.js');
let wmCode = fs.readFileSync(wmPath, 'utf8').replace(/\r\n/g, '\n');

const oldNavGuard = `        // 1. Navigation Guard: Never navigate away from local trusted loopback
        const allowedOrigin = \`http://127.0.0.1:\${this.serverManager.getPort()}\`;
        this.mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
            if (!targetUrl.startsWith(allowedOrigin)) {
                this.logger.warn(\`[SECURITY] Blocked external navigation to: \${targetUrl}\`);
                event.preventDefault();
            }
        });`;

const newNavGuard = `        // 1. Navigation Guard: Never navigate away from local trusted loopback
        const allowedOrigin = \`http://127.0.0.1:\${this.serverManager.getPort()}\`;
        this.mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
            if (!targetUrl.startsWith(allowedOrigin)) {
                this.logger.warn(\`[SECURITY] Blocked external navigation to: \${targetUrl}\`);
                event.preventDefault();
            }
        });

        // 1b. Camera / Media Permission Guard: Allow only "media" for local trusted loopback
        this.mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback, details) => {
            const url = details.requestingUrl || webContents.getURL();
            if (permission === 'media' && url.startsWith(allowedOrigin)) {
                this.logger.info(\`[SECURITY] Granted media permission to loopback origin: \${url}\`);
                return callback(true);
            }
            this.logger.warn(\`[SECURITY] Denied \${permission} permission to: \${url}\`);
            return callback(false);
        });
        this.mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
            if (permission === 'media' && requestingOrigin === allowedOrigin) {
                return true;
            }
            return false;
        });`;

if (!wmCode.includes(oldNavGuard)) {
  console.error('Error: oldNavGuard not found in desktop/engine/main/window-manager.js');
  process.exit(1);
}
wmCode = wmCode.replace(oldNavGuard, newNavGuard);

wmCode = wmCode.replace(/\n/g, '\r\n');
fs.writeFileSync(wmPath, wmCode, 'utf8');
console.log('✓ desktop/engine/main/window-manager.js updated with secure camera permission handler');
