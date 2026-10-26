const assert = require('assert');
const path = require('path');
const fs = require('fs');

const serverNodeModules = path.resolve(__dirname, '../server/node_modules');
module.paths.unshift(serverNodeModules);

const express = require('express');
const cookieParser = require('cookie-parser');
const http = require('http');

const { openDb, ensureBootstrap, ensureSystemData, createSession, SESSION_COOKIE, newId, now } = require('../server/db');

console.log('--- TESTING INITIAL STOCK LOGIC & API ---');

ensureBootstrap();
ensureSystemData();

const db = openDb();

// 1. Verify UI and Chunk Assets
console.log('1. Verifying UI files and compiled chunks for initialStock...');
const filesToCheck = [
  path.resolve(__dirname, '../src/components/library/screens/products.tsx'),
  path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js'),
  path.resolve(__dirname, '../out/_next/static/chunks/18yoqc7d05wnq.js'),
];
if (fs.existsSync(path.resolve(__dirname, '../../src/components/library/screens/products.tsx'))) {
  filesToCheck.push(path.resolve(__dirname, '../../src/components/library/screens/products.tsx'));
}

filesToCheck.forEach((fp) => {
  assert(fs.existsSync(fp), `File does not exist: ${fp}`);
  const content = fs.readFileSync(fp, 'utf8');
  assert(content.includes('pf-initialStock'), `Missing pf-initialStock in ${fp}`);
  assert(content.includes('العدد المبدئي الموجود في المخزن'), `Missing Arabic label in ${fp}`);
  console.log(`  ✓ Verified ${path.basename(fp)}`);
});

// 2. Test server/api.js via mock request
console.log('2. Testing POST /products with initialStock...');
const admin = db.prepare('SELECT id FROM "User" WHERE roleKey = ?').get('OWNER') || db.prepare('SELECT id FROM "User" LIMIT 1').get();
assert(admin, 'Admin user must exist in DB');
const { token } = createSession(admin.id);

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api', require('../server/api'));

const server = http.createServer(app);
server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  console.log(`  Mini test server running on port ${port}`);

  function makePost(p, body) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: p,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
            'Cookie': `${SESSION_COOKIE}=${token}`,
          },
        },
        (res) => {
          let buf = '';
          res.on('data', (c) => (buf += c));
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, body: JSON.parse(buf) });
            } catch (e) {
              resolve({ status: res.statusCode, raw: buf });
            }
          });
        }
      );
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  function makeGet(p) {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: p,
          method: 'GET',
          headers: {
            'Cookie': `${SESSION_COOKIE}=${token}`,
          },
        },
        (res) => {
          let buf = '';
          res.on('data', (c) => (buf += c));
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, body: JSON.parse(buf) });
            } catch (e) {
              resolve({ status: res.statusCode, raw: buf });
            }
          });
        }
      );
      req.on('error', reject);
      req.end();
    });
  }

  try {
    const testSku = `TEST-INIT-${Date.now().toString().slice(-4)}`;
    console.log(`  Creating product with sku: ${testSku} and initialStock: 35...`);
    const createRes = await makePost('/api/products', {
      sku: testSku,
      nameAr: `صنف تجريبي ${testSku}`,
      purchasePrice: 15.5,
      sellingPrice: 25.0,
      initialStock: 35,
    });

    assert.strictEqual(createRes.status, 201, `Failed to create product: ${JSON.stringify(createRes)}`);
    assert(createRes.body.ok, 'Expected ok: true');
    const prodId = createRes.body.data.id;
    console.log(`  ✓ Product created with ID: ${prodId}`);

    // Verify batch in DB
    const batch = db.prepare('SELECT * FROM "Batch" WHERE productId = ?').get(prodId);
    assert(batch, 'Batch was not created in database');
    assert.strictEqual(batch.quantity, 35, `Batch quantity mismatch: expected 35, got ${batch.quantity}`);
    assert.strictEqual(batch.costPrice, 15.5, `Batch costPrice mismatch: expected 15.5, got ${batch.costPrice}`);
    assert.strictEqual(batch.status, 'ACTIVE', `Batch status mismatch: expected ACTIVE, got ${batch.status}`);
    console.log(`  ✓ Batch correctly created in database (Qty: ${batch.quantity}, Cost: ${batch.costPrice})`);

    // Verify StockMovement in DB
    const movement = db.prepare('SELECT * FROM "StockMovement" WHERE productId = ?').get(prodId);
    assert(movement, 'StockMovement was not created in database');
    assert.strictEqual(movement.type, 'INITIAL', `Movement type mismatch: expected INITIAL, got ${movement.type}`);
    assert.strictEqual(movement.quantity, 35, `Movement quantity mismatch: expected 35, got ${movement.quantity}`);
    assert.strictEqual(movement.unitCost, 15.5, `Movement unitCost mismatch: expected 15.5, got ${movement.unitCost}`);
    console.log(`  ✓ StockMovement correctly created in database (Type: ${movement.type}, Qty: ${movement.quantity})`);

    // Query product via GET /api/products/:id
    const getRes = await makeGet(`/api/products/${prodId}`);
    assert.strictEqual(getRes.status, 200, `Failed to fetch product: ${JSON.stringify(getRes)}`);
    const pBatches = getRes.body.data.batches;
    assert(Array.isArray(pBatches) && pBatches.length === 1, 'Expected 1 batch in product details');
    assert.strictEqual(pBatches[0].quantity, 35, `Batch quantity in product details mismatch: expected 35, got ${pBatches[0].quantity}`);
    console.log(`  ✓ GET /products/:id confirms 1 batch with quantity 35`);

    // Query list via GET /api/products?q=...
    const listRes = await makeGet(`/api/products?q=${testSku}`);
    assert.strictEqual(listRes.status, 200);
    const pItem = listRes.body.data.items.find(i => i.id === prodId);
    assert(pItem, 'Product not found in list response');
    assert.strictEqual(pItem.stockAvailable, 35, `stockAvailable mismatch: expected 35, got ${pItem.stockAvailable}`);
    assert.strictEqual(pItem.stockTotal, 35, `stockTotal mismatch: expected 35, got ${pItem.stockTotal}`);
    console.log(`  ✓ GET /products?q=... confirms stockAvailable=35 and stockTotal=35`);

    // Test product without initialStock
    const noStockSku = `TEST-NO-INIT-${Date.now().toString().slice(-4)}`;
    const createNoStock = await makePost('/api/products', {
      sku: noStockSku,
      nameAr: `صنف بدون رصيد ${noStockSku}`,
      purchasePrice: 10,
      sellingPrice: 15,
      initialStock: 0,
    });
    assert.strictEqual(createNoStock.status, 201);
    const noStockId = createNoStock.body.data.id;
    const noBatches = db.prepare('SELECT * FROM "Batch" WHERE productId = ?').all(noStockId);
    assert.strictEqual(noBatches.length, 0, 'Should not create any batches when initialStock is 0');
    console.log(`  ✓ Product with initialStock: 0 correctly created with 0 batches`);

    // Clean up test products
    if (prodId) {
      db.prepare('DELETE FROM "StockMovement" WHERE productId = ?').run(prodId);
      db.prepare('DELETE FROM "Batch" WHERE productId = ?').run(prodId);
      db.prepare('DELETE FROM "Product" WHERE id = ?').run(prodId);
    }
    if (noStockId) {
      db.prepare('DELETE FROM "StockMovement" WHERE productId = ?').run(noStockId);
      db.prepare('DELETE FROM "Batch" WHERE productId = ?').run(noStockId);
      db.prepare('DELETE FROM "Product" WHERE id = ?').run(noStockId);
    }

    console.log('\n[PASS] ALL INITIAL STOCK INTEGRATION TESTS SUCCEEDED!');
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('\n[FAIL] Test encountered error:', err);
    server.close();
    process.exit(1);
  }
});
