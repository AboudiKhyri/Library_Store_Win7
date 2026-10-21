const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const PORT = 3215;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function request(method, pathName, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathName, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: { 'Accept': 'application/json', ...headers }
    };
    if (body) {
      const data = typeof body === 'string' ? body : JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(responseBody); } catch (e) { json = responseBody; }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json,
          raw: responseBody
        });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runTests() {
  console.log('====================================================');
  console.log('  STARTING VERIFICATION TEST FOR LOGIN & LOGO');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name, condition, details = '') {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} -> ${details}`);
      failed++;
    }
  }

  // 1. Assets Check
  console.log('--- Phase 1: Static Logo & Icon Assets ---');
  assert('public/logo.png exists', fs.existsSync(path.resolve('public/logo.png')));
  assert('public/logo1.jpg exists', fs.existsSync(path.resolve('public/logo1.jpg')));
  assert('public/logo.svg exists', fs.existsSync(path.resolve('public/logo.svg')));
  assert('public/favicon.ico exists', fs.existsSync(path.resolve('public/favicon.ico')));
  assert('desktop/icons/icon.ico exists', fs.existsSync(path.resolve('desktop/icons/icon.ico')));
  assert('desktop/icons/icon.png exists', fs.existsSync(path.resolve('desktop/icons/icon.png')));

  // 2. Start Backend Server
  console.log('\n--- Phase 2: Starting Backend Server ---');
  const nodeBin = fs.existsSync(path.resolve('desktop/bin/node.exe'))
    ? path.resolve('desktop/bin/node.exe')
    : 'node';
  const serverJs = fs.existsSync(path.resolve('server/server.js'))
    ? path.resolve('server/server.js')
    : path.resolve('.next/standalone/server.js');
  const serverCwd = fs.existsSync(path.resolve('server/server.js'))
    ? path.resolve('server')
    : path.resolve('.next/standalone');

  let dbFile = path.resolve('data/custom.db');
  if (!fs.existsSync(dbFile)) {
    const home = process.env.USERPROFILE || process.env.HOME || '';
    const localAppData = process.env.LOCALAPPDATA || (home ? path.join(home, 'AppData', 'Local') : '');
    const appDataDb = path.join(localAppData, 'com.library.supermarket', 'custom.db');
    if (fs.existsSync(appDataDb)) dbFile = appDataDb;
  }

  const serverProc = spawn(nodeBin, [serverJs], {
    cwd: serverCwd,
    env: {
      ...process.env,
      PORT: String(PORT),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
      DATABASE_URL: 'file:' + dbFile.replace(/\\/g, '/')
    },
    stdio: 'pipe'
  });

  serverProc.stdout.on('data', (d) => {
    // console.log('[SERVER]', d.toString().trim());
  });
  serverProc.stderr.on('data', (d) => {
    // console.error('[SERVER ERR]', d.toString().trim());
  });

  // Wait for server to become responsive
  let serverReady = false;
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      const res = await request('GET', '/api/library/system/status');
      if (res.status === 200) {
        serverReady = true;
        break;
      }
    } catch (e) {}
  }

  assert('Server started and responding', serverReady);

  if (!serverReady) {
    serverProc.kill();
    process.exit(1);
  }

  try {
    // 3. Unauthenticated Checks (Login Screen / Status / Session)
    console.log('\n--- Phase 3: Unauthenticated Startup Flow ---');
    
    // Check Root response
    const rootRes = await request('GET', '/');
    assert('GET / returns 200', rootRes.status === 200);
    
    // Check Session API without cookie
    const sessionRes = await request('GET', '/api/library/auth/session');
    assert('GET /api/library/auth/session returns null user without cookie', 
      sessionRes.status === 200 && sessionRes.body?.data?.user === null,
      JSON.stringify(sessionRes.body)
    );

    // Protected routes must reject unauthenticated requests
    const protectedDashboard = await request('GET', '/api/library/dashboard');
    assert('GET /api/library/dashboard returns 401 unauthorized', protectedDashboard.status === 401);

    const protectedProducts = await request('GET', '/api/library/products');
    assert('GET /api/library/products returns 401 unauthorized', protectedProducts.status === 401);

    const protectedSales = await request('POST', '/api/library/sales', {}, { items: [] });
    assert('POST /api/library/sales returns 401 unauthorized', protectedSales.status === 401);

    // 4. Authentication Flow (Real Credentials)
    console.log('\n--- Phase 4: Authentication System Verification ---');

    // Test Old username fails
    const oldUserLogin = await request('POST', '/api/library/auth/login', {}, {
      username: 'abdo_test01',
      password: 'Admin@1234'
    });
    assert('Login with old username (abdo_test01) rejected (401)', 
      oldUserLogin.status === 401 && oldUserLogin.body?.error?.code === 'LOGIN_FAILED',
      JSON.stringify(oldUserLogin.body)
    );

    // Test Bad password for new admin
    const badLogin = await request('POST', '/api/library/auth/login', {}, {
      username: 'admin',
      password: 'WrongPassword999!'
    });
    assert('Login with wrong password rejected (401)', 
      badLogin.status === 401 && badLogin.body?.error?.code === 'LOGIN_FAILED',
      JSON.stringify(badLogin.body)
    );

    // Test Good login for new admin
    const goodLogin = await request('POST', '/api/library/auth/login', {}, {
      username: 'admin',
      password: 'Admin@1234'
    });
    assert('Login with valid credentials (admin / Admin@1234) succeeds (200)', 
      goodLogin.status === 200 && goodLogin.body?.data?.user?.username === 'admin',
      JSON.stringify(goodLogin.body)
    );

    // Verify role and permissions
    const userObj = goodLogin.body?.data?.user;
    assert('User role is owner (System Admin)', userObj?.roleKey === 'owner');
    assert('User has full permissions (>= 30 permissions)', Array.isArray(userObj?.permissions) && userObj.permissions.length >= 30, `Perms count: ${userObj?.permissions?.length}`);

    // Extract session cookie
    const setCookie = goodLogin.headers['set-cookie'];
    let sessionCookie = '';
    if (setCookie) {
      const match = (Array.isArray(setCookie) ? setCookie[0] : setCookie).match(/qx_session=[^;]+/);
      if (match) sessionCookie = match[0];
    }
    assert('Login response returns qx_session cookie', sessionCookie.length > 0, setCookie);

    const authHeaders = { 'Cookie': sessionCookie };

    // 5. Authenticated Access
    console.log('\n--- Phase 5: Authenticated User Flow ---');
    const authSession = await request('GET', '/api/library/auth/session', authHeaders);
    assert('GET /api/library/auth/session returns authenticated user (admin / owner)', 
      authSession.status === 200 && authSession.body?.data?.user?.username === 'admin' && authSession.body?.data?.user?.roleKey === 'owner'
    );

    const authDashboard = await request('GET', '/api/library/dashboard', authHeaders);
    assert('GET /api/library/dashboard returns 200 for authenticated admin', authDashboard.status === 200);

    const authProducts = await request('GET', '/api/library/products', authHeaders);
    assert('GET /api/library/products returns 200 for authenticated admin', authProducts.status === 200);

    // 6. Logout Flow
    console.log('\n--- Phase 6: Logout Flow ---');
    const logoutRes = await request('POST', '/api/library/auth/logout', authHeaders);
    assert('POST /api/library/auth/logout returns 200 and loggedOut=true', 
      logoutRes.status === 200 && logoutRes.body?.data?.loggedOut === true
    );

    // After logout, session is destroyed
    const afterLogoutSession = await request('GET', '/api/library/auth/session', authHeaders);
    assert('Session destroyed: GET /api/library/auth/session returns null user after logout',
      afterLogoutSession.status === 200 && afterLogoutSession.body?.data?.user === null
    );

    const afterLogoutDashboard = await request('GET', '/api/library/dashboard', authHeaders);
    assert('Protected dashboard returns 401 after logout', afterLogoutDashboard.status === 401);

    // 7. Server Restart & Persistence Verification
    console.log('\n--- Phase 7: Server Restart & Persistence Verification ---');
    // Clean shutdown first server via shutdown API
    await request('POST', '/api/library/system/shutdown', authHeaders).catch(() => {});
    await sleep(1000);
    try { serverProc.kill(); } catch (e) {}

    // Spawn new server instance
    console.log('Restarting application server...');
    const serverProc2 = spawn(nodeBin, [serverJs], {
      cwd: serverCwd,
      env: {
        ...process.env,
        PORT: String(PORT),
        HOSTNAME: '127.0.0.1',
        NODE_ENV: 'production',
        DATABASE_URL: 'file:' + dbFile.replace(/\\/g, '/')
      },
      stdio: 'pipe'
    });

    let restartedReady = false;
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      try {
        const res = await request('GET', '/api/library/system/status');
        if (res.status === 200) {
          restartedReady = true;
          break;
        }
      } catch (e) {}
    }
    assert('Restarted server is up and responsive', restartedReady);

    try {
      // Re-login with admin / Admin@1234
      const persistLogin = await request('POST', '/api/library/auth/login', {}, {
        username: 'admin',
        password: 'Admin@1234'
      });
      assert('Login after restart succeeds (admin / Admin@1234 persists)', 
        persistLogin.status === 200 && persistLogin.body?.data?.user?.username === 'admin' && persistLogin.body?.data?.user?.roleKey === 'owner'
      );

      // Verify old account is still rejected after restart
      const persistOldLogin = await request('POST', '/api/library/auth/login', {}, {
        username: 'abdo_test01',
        password: 'Admin@1234'
      });
      assert('Login with old username (abdo_test01) still fails after restart (401)', 
        persistOldLogin.status === 401 && persistOldLogin.body?.error?.code === 'LOGIN_FAILED'
      );
    } finally {
      serverProc2.kill();
    }

  } finally {
    try { serverProc.kill(); } catch (e) {}
  }

  console.log('\n====================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
