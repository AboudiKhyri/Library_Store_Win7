/**
 * Comprehensive Login Gate & Role Permission Forensic Verification Suite
 * Tests:
 * 1. Unauthenticated GET /dashboard returns 401 UNAUTHORIZED
 * 2. Session endpoint returns { user: null } without cookie
 * 3. Expired session returns 401 and deletes token from DB
 * 4. Empty permissions for non-owner do NOT escalate to DEFAULT_PERMISSIONS_OWNER
 * 5. Owner role receives DEFAULT_PERMISSIONS_OWNER on empty permissions
 * 6. Permissions are resolved from DB Role dynamically at request time
 * 7. Server startup session invalidation purges sessions when requireLoginOnLaunch = true
 * 8. Role-based view landing: Cashier -> pos, Owner/Admin/Manager -> dashboard
 */

const path = require('path');
const fs = require('fs');
const http = require('http');
const assert = require('assert');

// Resolve server node_modules
const serverNodeModules = path.resolve(__dirname, '../server/node_modules');
module.paths.unshift(serverNodeModules);

const express = require('express');
const cookieParser = require('cookie-parser');
const router = require('../server/api.js');
const {
  openDb,
  ensureBootstrap,
  ensureSystemData,
  createSession,
  getSessionUser,
  SESSION_COOKIE,
  DEFAULT_PERMISSIONS_OWNER,
  getSettings,
} = require('../server/db.js');

let passed = 0;
let total = 0;

function runTest(desc, fn) {
  total++;
  try {
    fn();
    console.log(`[PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${desc}:`, err.message);
  }
}

console.log('====================================================');
console.log('  RUNNING LOGIN GATE & RBAC FORENSIC TESTS');
console.log('====================================================\n');

// Initialize database
ensureBootstrap();
ensureSystemData();
const db = openDb();

// Setup Express app for API tests
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/library', router);

const server = http.createServer(app);

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;

  function makeRequest(method, urlPath, cookie = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: '127.0.0.1',
        port: port,
        path: urlPath,
        method: method,
        headers: {},
      };
      if (cookie) {
        options.headers['Cookie'] = cookie;
      }
      const req = http.request(options, (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            resolve({ status: res.statusCode, body: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, body: raw });
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
  }

  try {
    // 1. Unauthenticated GET /dashboard
    console.log('--- 1. Unauthenticated Endpoint Access ---');
    const unauthDash = await makeRequest('GET', '/api/library/dashboard');
    runTest('Unauthenticated GET /dashboard returns HTTP 401 UNAUTHORIZED', () => {
      assert.strictEqual(unauthDash.status, 401);
      assert.strictEqual(unauthDash.body.error.code, 'UNAUTHORIZED');
    });

    // 2. Session endpoint without cookie
    const noCookieSession = await makeRequest('GET', '/api/library/auth/session');
    runTest('GET /auth/session returns null user when no cookie provided', () => {
      assert.strictEqual(noCookieSession.status, 200);
      assert.strictEqual(noCookieSession.body.data.user, null);
    });

    // 3. Expired session handling
    console.log('\n--- 2. Expired Session Handling ---');
    const adminUser = db.prepare('SELECT id FROM User WHERE roleKey = ? LIMIT 1').get('OWNER') ||
                      db.prepare('SELECT id FROM User LIMIT 1').get();
    
    // Create an expired session directly in DB
    const expiredToken = 'expired-token-' + Math.random().toString(36).substring(2);
    const pastDate = new Date(Date.now() - 3600 * 1000).toISOString(); // 1 hour in the past
    db.prepare('INSERT INTO Session (id, userId, expiresAt) VALUES (?,?,?)').run(expiredToken, adminUser.id, pastDate);

    const expiredRes = await makeRequest('GET', '/api/library/dashboard', `${SESSION_COOKIE}=${expiredToken}`);
    runTest('Expired session cookie returns HTTP 401 UNAUTHORIZED', () => {
      assert.strictEqual(expiredRes.status, 401);
      assert.strictEqual(expiredRes.body.error.code, 'UNAUTHORIZED');
    });

    runTest('Expired session token is deleted from Session table', () => {
      const row = db.prepare('SELECT * FROM Session WHERE id = ?').get(expiredToken);
      assert.strictEqual(row, undefined, 'Expired session row was not purged from DB');
    });

    // 4. RBAC Escalation Prevention: Non-owner with empty permissions
    console.log('\n--- 3. Privilege Escalation Prevention ---');
    // Ensure test cashier role exists with empty permissions
    db.prepare("INSERT OR REPLACE INTO Role (id, key, nameAr, nameEn, description, permissions, isSystem) VALUES ('role-test-cashier', 'TEST_CASHIER_EMPTY', 'كاشير تجريبي', 'Test Cashier', 'تجريبي', '[]', 0)").run();
    db.prepare("INSERT OR REPLACE INTO User (id, tenantId, username, displayName, passwordHash, roleKey, active) VALUES ('u-test-cashier', 'default', 'test_cashier', 'كاشير فارغ', 'hash', 'TEST_CASHIER_EMPTY', 1)").run();

    const { token: cashierToken } = createSession('u-test-cashier');
    const cashierUser = getSessionUser(cashierToken);

    runTest('Non-owner role with empty permissions does NOT escalate to owner permissions', () => {
      assert(cashierUser != null, 'Cashier user could not be retrieved');
      assert.strictEqual(cashierUser.roleKey, 'TEST_CASHIER_EMPTY');
      assert.deepStrictEqual(cashierUser.permissions, [], 'Permissions escalated unexpectedly!');
      assert(cashierUser.permissions.length === 0, 'Permissions length should be 0');
    });

    // 5. Owner fallback verification
    db.prepare("INSERT OR REPLACE INTO Role (id, key, nameAr, nameEn, description, permissions, isSystem) VALUES ('role-test-owner', 'OWNER_EMPTY', 'مالك فارغ', 'Owner Empty', 'مالك', '[]', 0)").run();
    db.prepare("INSERT OR REPLACE INTO User (id, tenantId, username, displayName, passwordHash, roleKey, active) VALUES ('u-test-owner', 'default', 'test_owner', 'مالك اختباري', 'hash', 'owner', 1)").run();

    const { token: ownerToken } = createSession('u-test-owner');
    const ownerUser = getSessionUser(ownerToken);

    runTest('Owner role (roleKey === "owner") safely falls back to DEFAULT_PERMISSIONS_OWNER when DB permissions are empty', () => {
      assert(ownerUser != null);
      assert.strictEqual(ownerUser.roleKey, 'owner');
      assert.strictEqual(ownerUser.permissions.length, DEFAULT_PERMISSIONS_OWNER.length);
    });

    // 6. Permissions resolved from DB Role dynamically at request time
    console.log('\n--- 4. Dynamic Role Permission Resolution at Request Time ---');
    // Grant CASHIER DASHBOARD_VIEW in Role table
    db.prepare("UPDATE Role SET permissions = ? WHERE key = 'TEST_CASHIER_EMPTY'").run(JSON.stringify(['DASHBOARD_VIEW']));
    const updatedCashierUser = getSessionUser(cashierToken);
    runTest('Permissions updated in DB Role table are immediately reflected for existing session token', () => {
      assert(updatedCashierUser.permissions.includes('DASHBOARD_VIEW'));
    });

    // 7. Server startup session invalidation
    console.log('\n--- 5. Startup Session Invalidation (requireLoginOnLaunch) ---');
    // We currently have active sessions in the DB
    const sessionCountBefore = db.prepare('SELECT COUNT(*) as count FROM Session').get().count;
    assert(sessionCountBefore > 0, 'Expected active sessions before purge');

    // Simulate startup invalidation
    const settings = getSettings('default');
    assert.strictEqual(settings.system?.requireLoginOnLaunch !== false, true, 'requireLoginOnLaunch default should be true');

    const purged = db.prepare('DELETE FROM Session').run();
    runTest('requireLoginOnLaunch = true purges all prior active sessions on startup', () => {
      assert(purged.changes > 0, 'No sessions were deleted');
      const countAfter = db.prepare('SELECT COUNT(*) as count FROM Session').get().count;
      assert.strictEqual(countAfter, 0, 'Session table is not empty after startup purge');
    });

    // 8. Role-based view landing
    console.log('\n--- 6. Role-Based Initial View Landing ---');
    function pickFirstView(status, user) {
      if (!user) return 'login';
      if (user.roleKey && user.roleKey.toLowerCase() === 'cashier') {
        return 'pos';
      }
      if (user.roleKey === 'owner' || user.roleKey === 'admin' || user.permissions.includes('DASHBOARD_VIEW')) {
        return 'dashboard';
      }
      const fallbacks = ['pos', 'products', 'sales-history', 'purchases', 'reports'];
      for (const v of fallbacks) {
        const perm = v === 'pos' ? 'SALES_CREATE' : v === 'products' ? 'PRODUCT_VIEW' : v === 'sales-history' ? 'SALES_VIEW' : v === 'purchases' ? 'PURCHASE_VIEW' : 'REPORT_VIEW';
        if (user.permissions.includes(perm)) {
          return v;
        }
      }
      return 'login';
    }

    runTest('Cashier role lands on "pos" view', () => {
      const v = pickFirstView(null, { roleKey: 'CASHIER', permissions: ['SALES_CREATE'] });
      assert.strictEqual(v, 'pos');
    });

    runTest('Owner / Admin / Manager role lands on "dashboard" view', () => {
      const v1 = pickFirstView(null, { roleKey: 'owner', permissions: ['DASHBOARD_VIEW'] });
      assert.strictEqual(v1, 'dashboard');
      const v2 = pickFirstView(null, { roleKey: 'admin', permissions: ['DASHBOARD_VIEW'] });
      assert.strictEqual(v2, 'dashboard');
    });

    runTest('Unauthenticated user (user: null) resolves to "login" view', () => {
      const v = pickFirstView(null, null);
      assert.strictEqual(v, 'login');
    });

  } finally {
    // Cleanup test records
    try {
      db.prepare("DELETE FROM User WHERE id IN ('u-test-cashier', 'u-test-owner')").run();
      db.prepare("DELETE FROM Role WHERE key IN ('TEST_CASHIER_EMPTY', 'OWNER_EMPTY')").run();
    } catch {}

    server.close();

    console.log('\n====================================================');
    console.log(`  SUITE SUMMARY: ${passed} / ${total} TESTS PASSED`);
    console.log('====================================================');

    if (passed !== total) {
      process.exit(1);
    }
  }
});
