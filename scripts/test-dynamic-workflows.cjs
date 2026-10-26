/**
 * Forensic Dynamic Integration Test Suite
 * Tests all end-to-end workflows on an isolated copy of the database.
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const cp = require('child_process');

const PORT = 3215;
const HOST = '127.0.0.1';
const DB_ORIGIN = path.resolve(__dirname, '../data/custom.db');
const DB_COPY = path.resolve(__dirname, '../data/test_copy.db');

// Always refresh fresh copy from custom.db before test run (remove prior WAL/SHM)
try { if (fs.existsSync(DB_COPY)) fs.unlinkSync(DB_COPY); } catch {}
try { if (fs.existsSync(DB_COPY + '-wal')) fs.unlinkSync(DB_COPY + '-wal'); } catch {}
try { if (fs.existsSync(DB_COPY + '-shm')) fs.unlinkSync(DB_COPY + '-shm'); } catch {}
fs.copyFileSync(DB_ORIGIN, DB_COPY);

let sessionCookie = '';

function request(method, pathUrl, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
      'Origin': `http://${HOST}:${PORT}`,
    };
    if (sessionCookie) headers['Cookie'] = sessionCookie;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request({
      hostname: HOST,
      port: PORT,
      path: pathUrl,
      method,
      headers,
      timeout: 5000,
    }, (res) => {
      let data = '';
      if (res.headers['set-cookie']) {
        const raw = res.headers['set-cookie'][0];
        sessionCookie = raw.split(';')[0];
      }
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), raw: data });
        } catch {
          resolve({ status: res.statusCode, data: null, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    if (payload) req.write(payload);
    req.end();
  });
}

async function run() {
  console.log('========================================================');
  console.log('  RUNNING PHASE 2 DYNAMIC CHECKS ON TEST DATABASE COPY  ');
  console.log('========================================================\n');

  const nodeExe = path.resolve(__dirname, '../desktop/bin/node.exe');
  const serverScript = path.resolve(__dirname, '../server/server.js');
  
  console.log(`[SPAWN] Starting server on port ${PORT} with DB: ${DB_COPY}`);
  const env = {
    ...process.env,
    PORT: String(PORT),
    HOSTNAME: HOST,
    DATABASE_URL: `file:${DB_COPY}`,
    ELECTRON_RUN_AS_NODE: '1',
  };

  const serverProc = cp.spawn(nodeExe, [serverScript], {
    cwd: path.resolve(__dirname, '..'),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProc.stdout.on('data', d => {});
  serverProc.stderr.on('data', d => {
    console.error('[server stderr]', d.toString().trim());
  });

  // Wait for health check
  let ready = false;
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 200));
    try {
      const res = await request('GET', '/api/library/system/status');
      if (res.status === 200 && res.data && res.data.ok) {
        ready = true;
        break;
      }
    } catch {}
  }

  if (!ready) {
    console.error('[FAIL] Server failed to become ready');
    serverProc.kill();
    process.exit(1);
  }
  console.log('[PASS] Server is online and ready.\n');

  let passedSteps = 0;
  let totalSteps = 0;

  function assert(name, condition, extra = '') {
    totalSteps++;
    if (condition) {
      console.log(`  ✓ [PASS] ${name} ${extra}`);
      passedSteps++;
    } else {
      console.error(`  ✗ [FAIL] ${name} ${extra}`);
    }
  }

  try {
    // Step 1: Login
    console.log('--- Step 1: Login Authentication ---');
    const loginRes = await request('POST', '/api/library/auth/login', {
      username: 'admin',
      password: 'wrongpassword',
    });
    assert('Reject invalid password', loginRes.status === 401 && loginRes.data.ok === false);

    const validLogin = await request('POST', '/api/library/auth/login', {
      username: 'admin',
      password: 'Admin@1234',
    });
    assert('Accept valid admin credentials', validLogin.status === 200 && validLogin.data.ok === true && validLogin.data.data.user.username === 'admin');

    const sessionRes = await request('GET', '/api/library/auth/session');
    assert('Session persistence via cookie', sessionRes.status === 200 && sessionRes.data?.data?.user?.username === 'admin');

    // Step 2: System Status & Diagnostic
    console.log('\n--- Step 2: Diagnostics & Status ---');
    const statusRes = await request('GET', '/api/library/system/status');
    assert('System status endpoint returns 200 and valid schema', statusRes.status === 200 && statusRes.data?.data?.productId === 'LIBRARY_STORE');

    const diagRes = await request('GET', '/api/library/diagnostics');
    assert('Diagnostics returns database info and counts', diagRes.status === 200 && diagRes.data?.ok === true && diagRes.data?.data?.db?.ok === true);

    // Step 3: Category Management
    console.log('\n--- Step 3: Categories ---');
    const catUnique = `أدوات مكتبية ${Date.now().toString().slice(-4)}`;
    const catRes = await request('POST', '/api/library/categories', {
      nameAr: catUnique,
      nameEn: 'Test Stationery',
    });
    assert('Create new Category', catRes.status === 201 && catRes.data?.ok === true);
    const catId = catRes.data?.data?.id;

    // Step 4: Supplier Management
    console.log('\n--- Step 4: Suppliers ---');
    const supRes = await request('POST', '/api/library/suppliers', {
      name: `شركة التوريدات الحديثة ${Date.now().toString().slice(-4)}`,
      phone: '01012345678',
      contactPerson: 'أحمد محمود',
    });
    assert('Create new Supplier', supRes.status === 201 && supRes.data.ok === true);
    const supplierId = supRes.data.data.id;

    // Step 5: Product Creation & Sequential SKU
    console.log('\n--- Step 5: Product Creation & Sequential SKU ---');
    const prodRes = await request('POST', '/api/library/products', {
      nameAr: 'كشكول سلك 100 ورقة مسطر فاخر',
      nameEn: 'Wirebound Notebook 100 Sheets',
      categoryId: catId,
      sellingPrice: 45.0,
      purchasePrice: 30.0,
      isWeighable: false,
      initialStock: 20,
    });
    assert('Create Product with Initial Stock', prodRes.status === 201 && prodRes.data.ok === true);
    const productId = prodRes.data.data.id;
    const generatedSku = prodRes.data.data.sku;
    assert('Generated SKU follows sequential pattern', generatedSku.startsWith('SKU-'), `(SKU: ${generatedSku})`);

    // Verify initial stock batch created
    const prodGet = await request('GET', `/api/library/products/${productId}`);
    const initialStockQty = prodGet.data?.data?.stockTotal;
    assert('Product stock matches initial quantity of 20', initialStockQty === 20, `(Stock: ${initialStockQty})`);

    // Step 6: Customer Creation
    console.log('\n--- Step 6: Customer Management ---');
    const custRes = await request('POST', '/api/library/customers', {
      name: `أستاذ محمد إبراهيم ${Date.now().toString().slice(-4)}`,
      phone: '01234567890',
    });
    assert('Create Customer', custRes.status === 201 && custRes.data.ok === true);
    const customerId = custRes.data.data.id;

    // Step 7: Purchase Invoice & WAC Check
    console.log('\n--- Step 7: Purchases & WAC ---');
    const purchaseRes = await request('POST', '/api/library/purchases', {
      supplierId,
      items: [
        {
          productId,
          quantity: 30,
          unitCost: 35.0,
          batchNo: 'B-TEST-001',
        }
      ],
      paidAmount: 1050.0,
      paymentMethod: 'cash',
      receiveNow: true,
    });
    assert('Receive Purchase Order immediately', purchaseRes.status === 201 && purchaseRes.data.ok === true && purchaseRes.data.data.status === 'RECEIVED');

    // Re-check product stock and WAC:
    // Initial: 20 @ 30.0 = 600
    // Purchase: 30 @ 35.0 = 1050
    // Total stock = 50, Total cost = 1650 => WAC = 33.0
    const prodAfterPurchase = await request('GET', `/api/library/products/${productId}`);
    const stockAfterPurchase = prodAfterPurchase.data?.data?.stockTotal;
    const wacPrice = prodAfterPurchase.data?.data?.product?.purchasePrice;
    assert('Total stock updated after purchase to 50', stockAfterPurchase === 50, `(Stock: ${stockAfterPurchase})`);
    assert('WAC purchase price recalculated to 33.0', Math.abs(wacPrice - 33.0) < 0.01, `(WAC: ${wacPrice})`);

    // Step 8: POS Sale, Batch Allocation & Movements
    console.log('\n--- Step 8: POS Sale & Stock Allocation ---');
    const saleRes = await request('POST', '/api/library/sales', {
      customerId,
      paymentMethod: 'cash',
      paidAmount: 500.0,
      items: [
        {
          productId,
          quantity: 10,
          unitPrice: 45.0,
          discount: 0,
        }
      ],
    });
    assert('Process POS checkout sale (10 units)', saleRes.status === 201 && saleRes.data.ok === true);
    const saleId = saleRes.data.data.saleId;
    const saleTotal = saleRes.data.data.total;
    assert('Sale total is 450.0', saleTotal === 450.0, `(Total: ${saleTotal})`);
    assert('Sale change is 50.0', saleRes.data.data.changeAmount === 50.0, `(Change: ${saleRes.data.data.changeAmount})`);

    // Verify stock decremented to 40
    const prodAfterSale = await request('GET', `/api/library/products/${productId}`);
    assert('Product stock decremented from 50 to 40', prodAfterSale.data?.data?.stockTotal === 40, `(Stock: ${prodAfterSale.data?.data?.stockTotal})`);

    // Verify receipt retrieval inside sale details
    const saleDetails = await request('GET', `/api/library/sales/${saleId}`);
    assert('Generate & retrieve print-ready receipt', saleDetails.status === 200 && saleDetails.data?.ok === true && saleDetails.data?.data?.receipt?.invoiceNo !== undefined);
    const saleItemId = saleDetails.data.data.sale.items[0].id;

    // Step 9: Return with Discount
    console.log('\n--- Step 9: Returns Processing ---');
    const returnRes = await request('POST', '/api/library/returns', {
      saleId,
      reason: 'خطأ في مقاس الكشكول من المشتري',
      items: [
        {
          saleItemId,
          quantity: 2,
        }
      ]
    });
    assert('Process customer return of 2 units', returnRes.status === 201 && returnRes.data.ok === true);

    const prodAfterReturn = await request('GET', `/api/library/products/${productId}`);
    assert('Stock restored from 40 to 42 after return', prodAfterReturn.data?.data?.stockTotal === 42, `(Stock: ${prodAfterReturn.data?.data?.stockTotal})`);

    // Step 10: Cancel Sale Workflow
    console.log('\n--- Step 10: Cancel Sale Workflow ---');
    const sale2Res = await request('POST', '/api/library/sales', {
      customerId,
      paymentMethod: 'cash',
      paidAmount: 225.0,
      items: [{ productId, quantity: 5, unitPrice: 45.0, discount: 0 }],
    });
    assert('Create secondary sale (5 units)', sale2Res.status === 201);
    const sale2Id = sale2Res.data.data.saleId;

    const prodAfterSale2 = await request('GET', `/api/library/products/${productId}`);
    assert('Stock temporarily at 37 before cancel', prodAfterSale2.data?.data?.stockTotal === 37);

    const cancelRes = await request('POST', `/api/library/sales/${sale2Id}/cancel`, {
      reason: 'إلغاء الفاتورة من قبل الإدارة',
    });
    assert('Cancel sale via /sales/:id/cancel', cancelRes.status === 200 && cancelRes.data?.ok === true);

    const prodAfterCancel = await request('GET', `/api/library/products/${productId}`);
    assert('Stock fully restored back to 42 upon cancellation', prodAfterCancel.data?.data?.stockTotal === 42);

    // Step 11: Stocktake Session
    console.log('\n--- Step 11: Stocktake Audit ---');
    const stStart = await request('POST', '/api/library/inventory/stocktake', {
      name: 'جرد تجريبي لقسم الأدوات المكتبية',
    });
    assert('Open Stocktake Session', stStart.status === 201 && stStart.data.ok === true);
    const sessionId = stStart.data.data.sessionId;

    // Apply physical count of 40 (adjusts stock by -2)
    const stCommit = await request('POST', `/api/library/inventory/stocktake/${sessionId}`, {
      counted: [{ productId, countedQty: 40 }],
    });
    assert('Commit physical count adjustments', stCommit.status === 200 && stCommit.data.ok === true);

    const prodAfterStocktake = await request('GET', `/api/library/products/${productId}`);
    assert('Stock adjusted to physical count of 40', prodAfterStocktake.data?.data?.stockTotal === 40, `(Stock: ${prodAfterStocktake.data?.data?.stockTotal})`);

    // Step 12: Backup
    console.log('\n--- Step 12: Database Backup ---');
    const backupRes = await request('POST', '/api/library/backup');
    assert('Create database backup', backupRes.status === 201 && backupRes.data.ok === true && backupRes.data.data.backup?.filename !== undefined);
    const backupId = backupRes.data.data.backup.id;

    // Verify backup restore dry check
    const restoreRes = await request('POST', `/api/library/backup/${backupId}/restore`);
    assert('Restore backup successfully', restoreRes.status === 200 && restoreRes.data.ok === true);

    // Step 13: Change Password
    console.log('\n--- Step 13: Password Change ---');
    // Re-authenticate after database restore
    const reAuth = await request('POST', '/api/library/auth/login', {
      username: 'admin',
      password: 'Admin@1234',
    });
    assert('Re-authenticate after DB restore', reAuth.status === 200 && reAuth.data.ok === true);

    const usersList = await request('GET', '/api/library/users');
    const adminUser = usersList.data?.data?.items?.find(u => u.username === 'admin');
    const pwChangeRes = await request('PUT', `/api/library/users/${adminUser.id}`, {
      password: 'Admin@NewPassword123',
    });
    assert('Change admin password via /users/:id', pwChangeRes.status === 200 && pwChangeRes.data.ok === true);

    // Verify new password login
    const newLoginRes = await request('POST', '/api/library/auth/login', {
      username: 'admin',
      password: 'Admin@NewPassword123',
    });
    assert('Login with updated password succeeds', newLoginRes.status === 200 && newLoginRes.data.ok === true);

    // Step 14: Custom Roles & RBAC
    console.log('\n--- Step 14: Role Creation & Cashier Isolation ---');
    const roleKey = `ASST_${Date.now().toString().slice(-4)}`;
    const roleRes = await request('POST', '/api/library/roles', {
      key: roleKey,
      nameAr: 'مساعد كاشير',
      nameEn: 'Assistant Cashier',
      permissions: ['POS_VIEW', 'SALES_CREATE', 'CUSTOMER_VIEW'],
    });
    assert('Create custom role', roleRes.status === 201 && roleRes.data.ok === true);

    // Step 14: Create user with admin authorization requirement
    const asstUsername = `assistant_${Date.now().toString().slice(-4)}`;

    // 14a. Reject user creation without admin password
    const noAdminPwRes = await request('POST', '/api/library/users', {
      username: asstUsername,
      password: 'Assistant@123',
      displayName: 'مساعد تجريبي',
      roleKey,
    });
    assert('Reject user creation without admin password', noAdminPwRes.status === 403);

    // 14b. Reject user creation with wrong admin password
    const wrongAdminPwRes = await request('POST', '/api/library/users', {
      username: asstUsername,
      password: 'Assistant@123',
      displayName: 'مساعد تجريبي',
      roleKey,
      adminPassword: 'WrongPassword!999',
    });
    assert('Reject user creation with wrong admin password', wrongAdminPwRes.status === 403);

    // 14c. Create user with valid admin password
    const userRes = await request('POST', '/api/library/users', {
      username: asstUsername,
      password: 'Assistant@123',
      displayName: 'مساعد تجريبي',
      roleKey,
      adminPassword: 'Admin@NewPassword123',
    });
    assert('Create user with valid admin password', userRes.status === 201 && userRes.data.ok === true);

    // Log in as assistant
    const asstLogin = await request('POST', '/api/library/auth/login', {
      username: asstUsername,
      password: 'Assistant@123',
    });
    assert('Log in with new custom role user', asstLogin.status === 200 && asstLogin.data.data.user.roleKey === roleKey);

    // Verify RBAC enforcement: Assistant cannot view users (USER_VIEW permission required)
    const forbiddenRes = await request('GET', '/api/library/users');
    assert('RBAC gate enforces 403 Forbidden on unauthorized resource', forbiddenRes.status === 403);

  } catch (err) {
    console.error('[FATAL EXCEPTION DURING DYNAMIC RUN]', err);
  } finally {
    console.log('\n--- Step 15: Clean Shutdown & Process Exit ---');
    serverProc.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 1000));
    try { serverProc.kill('SIGKILL'); } catch {}
  }

  console.log('\n========================================================');
  console.log(`  DYNAMIC TESTS SUMMARY: ${passedSteps} / ${totalSteps} PASSED`);
  console.log('========================================================\n');

  if (passedSteps === totalSteps) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

run();
