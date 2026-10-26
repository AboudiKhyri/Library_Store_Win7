const http = require('http');
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { openDb, createSession, SESSION_COOKIE } = require('../server/db.js');
const cookieParser = require('../server/node_modules/cookie-parser');
const express = require('../server/node_modules/express');

console.log('--- TESTING SEQUENTIAL SKU GENERATION & VERIFICATION ---');

// 1. Verify UI and compiled chunks
console.log('1. Verifying source and compiled chunks...');
const filesToCheck = [
  path.join(__dirname, '../src/components/library/screens/products.tsx'),
  path.join(__dirname, '../out/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(__dirname, '../dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js')
];

for (const f of filesToCheck) {
  const content = fs.readFileSync(f, 'utf8');
  assert(!content.includes('Math.floor(1000+Math.random()*9000)'), `Found random SKU generator in ${f}`);
  assert(content.includes('SKU-0001'), `Missing SKU-0001 in ${f}`);
  assert(content.includes('/products/next-sku'), `Missing /products/next-sku in ${f}`);
  console.log(`  ✓ Verified ${path.basename(f)}`);
}

// 2. Setup server with session authentication
console.log('2. Setting up test session & server...');
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
  console.log(`  Mini test server running on port ${port}`);

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

  const createdIds = [];

  try {
    // 3. Test GET /api/products/next-sku
    console.log('3. Testing GET /api/products/next-sku...');
    const nextSkuRes = await makeReq('/api/products/next-sku');
    assert.strictEqual(nextSkuRes.status, 200, `GET /products/next-sku failed: ${JSON.stringify(nextSkuRes)}`);
    assert(nextSkuRes.body.ok, 'Expected ok: true');
    const initialNextSku = nextSkuRes.body.data.nextSku;
    console.log(`  Current nextSku returned: ${initialNextSku}`);
    assert.ok(/^SKU-\d{4,}$/.test(initialNextSku), `Expected SKU format, got ${initialNextSku}`);
    const currentNum = parseInt(initialNextSku.replace('SKU-', ''), 10);
    const expectedNext1 = 'SKU-' + String(currentNum + 1).padStart(4, '0');
    const expectedNext2 = 'SKU-' + String(currentNum + 2).padStart(4, '0');
    console.log(`  ✓ Correctly returned sequential ${initialNextSku}`);

    // 4. Test POST /api/products without sku (auto-generation)
    console.log(`4. Testing POST /api/products without SKU (server-side auto-generation with ${initialNextSku})...`);
    const autoCreate = await makeReq('/api/products', 'POST', {
      nameAr: `صنف تسلسل تجريبي ${currentNum}`,
      sellingPrice: 50
    });
    assert.strictEqual(autoCreate.status, 201, `Failed to create product: ${JSON.stringify(autoCreate)}`);
    assert.strictEqual(autoCreate.body.data.sku, initialNextSku, `Expected ${initialNextSku}, got ${autoCreate.body.data.sku}`);
    createdIds.push(autoCreate.body.data.id);
    console.log(`  ✓ Product created automatically with ${initialNextSku}`);

    // 5. Test nextSku after product was created
    console.log(`5. Testing nextSku incrementation to ${expectedNext1}...`);
    const nextSkuRes2 = await makeReq('/api/products/next-sku');
    assert.strictEqual(nextSkuRes2.body.data.nextSku, expectedNext1, `Expected next SKU to be ${expectedNext1}`);
    console.log(`  ✓ Next SKU successfully incremented to ${expectedNext1}`);

    // 6. Test creating next product explicitly
    console.log(`6. Testing POST /api/products with explicit ${expectedNext1}...`);
    const explicitCreate = await makeReq('/api/products', 'POST', {
      sku: expectedNext1,
      nameAr: `صنف تسلسل تجريبي ${currentNum + 1}`,
      sellingPrice: 75
    });
    assert.strictEqual(explicitCreate.status, 201);
    assert.strictEqual(explicitCreate.body.data.sku, expectedNext1);
    createdIds.push(explicitCreate.body.data.id);
    console.log(`  ✓ Product created with explicit ${expectedNext1}`);

    // 7. Test nextSku incrementation to expectedNext2
    console.log(`7. Testing nextSku incrementation to ${expectedNext2}...`);
    const nextSkuRes3 = await makeReq('/api/products/next-sku');
    assert.strictEqual(nextSkuRes3.body.data.nextSku, expectedNext2, `Expected next SKU to be ${expectedNext2}`);
    console.log(`  ✓ Next SKU successfully incremented to ${expectedNext2}`);

    // 8. Test collision prevention when a gap exists
    console.log('8. Testing collision prevention...');
    const duplicateCreate = await makeReq('/api/products', 'POST', {
      sku: expectedNext1,
      nameAr: 'صنف مكرر',
      sellingPrice: 100
    });
    assert.strictEqual(duplicateCreate.status, 409, 'Expected duplicate SKU to be rejected with 409');
    console.log('  ✓ Duplicate SKU correctly rejected with 409 SKU_DUPLICATE');

    console.log('\n[PASS] ALL SEQUENTIAL SKU TESTS PASSED CLEANLY (8/8)!');
  } catch (err) {
    console.error('\n[FAIL] Test encountered error:', err);
    process.exitCode = 1;
  } finally {
    // 9. Clean up created products from database
    for (const id of createdIds) {
      db.prepare('DELETE FROM "StockMovement" WHERE productId = ?').run(id);
      db.prepare('DELETE FROM "Batch" WHERE productId = ?').run(id);
      db.prepare('DELETE FROM "Product" WHERE id = ?').run(id);
    }
    server.close();
    process.exit(process.exitCode || 0);
  }
});
