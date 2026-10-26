const http = require('http');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { openDb, createSession, SESSION_COOKIE } = require('../server/db.js');
const cookieParser = require('../server/node_modules/cookie-parser');
const express = require('../server/node_modules/express');

console.log('================================================================');
console.log('   PERMANENT DELETE & CASCADE REMOVAL INTEGRATION AUDIT         ');
console.log('================================================================\n');

const db = openDb();
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
  console.log(`✓ Test server running on port ${port}`);

  function makeReq(url, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : null;
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: url,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `${SESSION_COOKIE}=${token}`,
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
        }
      }, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode, body: raw });
          }
        });
      });
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  }

  try {
    // 1. Create a test product with initial stock
    console.log('\n--- 1. Creating Test Product with Stock ---');
    const createRes = await makeReq('/api/products', 'POST', {
      nameAr: 'صنف اختبار الحذف النهائي',
      sellingPrice: 150,
      purchasePrice: 100,
      initialStock: 10
    });
    assert.ok(createRes.status === 200 || createRes.status === 201, 'Product creation failed: ' + JSON.stringify(createRes.body));
    const testProdId = createRes.body.data ? createRes.body.data.id : createRes.body.id;
    console.log(`✓ Created test product ID: ${testProdId}`);

    // Verify DB records exist
    const p1 = db.prepare('SELECT * FROM "Product" WHERE id=?').get(testProdId);
    assert.ok(p1, 'Product must exist in DB');
    const b1 = db.prepare('SELECT * FROM "Batch" WHERE productId=?').all(testProdId);
    assert.strictEqual(b1.length, 1, 'Batch must exist for initial stock');
    const m1 = db.prepare('SELECT * FROM "StockMovement" WHERE productId=?').all(testProdId);
    assert.strictEqual(m1.length, 1, 'StockMovement must exist for initial stock');
    console.log('✓ Verified DB has Product, Batch, and StockMovement records');

    // 2. Create a Sale referencing this product
    console.log('\n--- 2. Creating Sale with Test Product ---');
    const saleRes = await makeReq('/api/sales', 'POST', {
      items: [
        {
          productId: testProdId,
          quantity: 2,
          unitPrice: 150
        }
      ],
      subtotal: 300,
      discount: 0,
      tax: 0,
      total: 300,
      paidAmount: 300,
      changeAmount: 0,
      paymentMethod: 'cash'
    });
    assert.ok(saleRes.status === 200 || saleRes.status === 201, 'Sale creation failed: ' + JSON.stringify(saleRes.body));
    const testSaleId = saleRes.body.data ? saleRes.body.data.id : saleRes.body.id;
    console.log(`✓ Created test sale ID: ${testSaleId}`);

    const si1 = db.prepare('SELECT * FROM "SaleItem" WHERE productId=?').all(testProdId);
    assert.strictEqual(si1.length, 1, 'SaleItem must exist for test product');

    // 3. Attempt permanent delete WITHOUT deleteSales -> MUST fail with 409
    console.log('\n--- 3. Testing Force Delete WITHOUT deleteSales (Must Fail 409) ---');
    const failRes = await makeReq(`/api/products/${testProdId}?force=true&deleteSales=false`, 'DELETE');
    assert.strictEqual(failRes.status, 409, 'Should fail with 409 PRODUCT_IN_USE when sales exist');
    console.log('✓ Successfully rejected delete with 409 when deleteSales=false and sales exist');

    // 4. Permanent delete WITH deleteSales=true -> MUST succeed and cascade
    console.log('\n--- 4. Testing Force Delete WITH deleteSales=true ---');
    const forceRes = await makeReq(`/api/products/${testProdId}?force=true&deleteSales=true`, 'DELETE');
    assert.strictEqual(forceRes.status, 200, 'Force delete with deleteSales=true failed: ' + JSON.stringify(forceRes.body));
    console.log('✓ Server responded 200 OK to permanent delete with cascade');

    // 5. Verify product and ALL related records are completely wiped from DB
    console.log('\n--- 5. Verifying DB Records are 100% Removed ---');
    const pCheck = db.prepare('SELECT * FROM "Product" WHERE id=?').get(testProdId);
    assert.strictEqual(pCheck, undefined, 'Product must be completely deleted from Product table');
    const bCheck = db.prepare('SELECT * FROM "Batch" WHERE productId=?').all(testProdId);
    assert.strictEqual(bCheck.length, 0, 'All batches for product must be deleted');
    const mCheck = db.prepare('SELECT * FROM "StockMovement" WHERE productId=?').all(testProdId);
    assert.strictEqual(mCheck.length, 0, 'All movements for product must be deleted');
    const siCheck = db.prepare('SELECT * FROM "SaleItem" WHERE productId=?').all(testProdId);
    assert.strictEqual(siCheck.length, 0, 'SaleItem must be deleted');
    const sCheck = db.prepare('SELECT * FROM "Sale" WHERE id=?').get(testSaleId);
    assert.strictEqual(sCheck, undefined, 'Sale must be deleted when cascade deleteSales is true');
    console.log('✓ Confirmed 0 traces remain in Product, Batch, StockMovement, SaleItem, and Sale tables');

    // 6. Verify GET /products does NOT list the deleted product under any filter
    console.log('\n--- 6. Verifying Product is Absent from GET /products ---');
    const listAll = await makeReq('/api/products');
    assert.strictEqual(listAll.status, 200);
    const items = listAll.body.data ? listAll.body.data.items : (listAll.body.items || []);
    const foundInAll = items.some(x => x.id === testProdId);
    assert.strictEqual(foundInAll, false, 'Deleted product must not appear in products list');
    console.log('✓ Verified product is absent from GET /products');

    // 7. Clean up the user-encountered item "حماده" if present
    console.log('\n--- 7. Permanent Delete of Item "حماده" ---');
    const hamada = db.prepare('SELECT * FROM "Product" WHERE nameAr LIKE \'%حماده%\'').get();
    if (hamada) {
      console.log(`Found item "حماده" (ID: ${hamada.id}). Executing permanent delete with cascade...`);
      const delHamadaRes = await makeReq(`/api/products/${hamada.id}?force=true&deleteSales=true`, 'DELETE');
      assert.strictEqual(delHamadaRes.status, 200, 'Permanent delete of حماده failed: ' + JSON.stringify(delHamadaRes.body));
      const checkHamada = db.prepare('SELECT * FROM "Product" WHERE id=?').get(hamada.id);
      assert.strictEqual(checkHamada, undefined, 'Item حماده must be permanently removed');
      const checkHamadaBatches = db.prepare('SELECT * FROM "Batch" WHERE productId=?').all(hamada.id);
      assert.strictEqual(checkHamadaBatches.length, 0, 'Item حماده batches must be permanently removed');
      console.log('✓ Item "حماده" has been permanently removed from DB with all related records');
    } else {
      console.log('Item "حماده" was not found in DB or already deleted');
    }

    server.close();
    console.log('\n[PASS] ALL PERMANENT DELETE & CASCADE CHECKS PASSED CLEANLY (7/7)!');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ TEST FAILED:', err);
    server.close();
    process.exit(1);
  }
});
