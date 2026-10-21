/**
 * Test Dashboard Endpoint with real session cookie
 */
const path = require('path');
const fs = require('fs');
const http = require('http');

const serverNodeModules = path.resolve(__dirname, '../server/node_modules');
module.paths.unshift(serverNodeModules);

const express = require('express');
const cookieParser = require('cookie-parser');
const router = require('../server/api.js');
const { openDb, ensureBootstrap, ensureSystemData, createSession, SESSION_COOKIE } = require('../server/db.js');

ensureBootstrap();
ensureSystemData();

const db = openDb();
const admin = db.prepare('SELECT id FROM "User" WHERE roleKey = ?').get('OWNER') || db.prepare('SELECT id FROM "User" LIMIT 1').get();
console.log('Using admin user id:', admin.id);

const { token } = createSession(admin.id);
console.log('Session token created');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/library', router);

const server = http.createServer(app);

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  console.log(`Test server listening on port ${port}`);

  const options = {
    hostname: '127.0.0.1',
    port: port,
    path: '/api/library/dashboard',
    method: 'GET',
    headers: {
      'Cookie': `${SESSION_COOKIE}=${token}`,
    },
  };

  const req = http.request(options, (res) => {
    let raw = '';
    res.on('data', (chunk) => { raw += chunk; });
    res.on('end', () => {
      console.log('Response Status Code:', res.statusCode);
      server.close();

      try {
        const body = JSON.parse(raw);
        if (res.statusCode !== 200) {
          console.error('API Error Response:', body);
          process.exit(1);
        }

        console.log('\n--- Dashboard Data Verified ---');
        console.log('✓ todaySales:', body.data.todaySales);
        console.log('✓ monthSales:', body.data.monthSales);
        console.log('✓ lowStockCount:', body.data.lowStockCount);
        console.log('✓ activeProducts:', body.data.activeProducts);
        console.log('✓ weeklySales data points:', body.data.weeklySales.length);
        console.log('✓ recentSales count:', body.data.recentSales.length);

        console.log('\n======================================================');
        console.log('✓ DASHBOARD API RETRIEVED SUCCESSFULLY (200 OK)');
        console.log('✓ ReferenceError: warningDays is not defined IS RESOLVED');
        console.log('======================================================');
        process.exit(0);
      } catch (err) {
        console.error('Failed to parse response:', err.message, raw);
        process.exit(1);
      }
    });
  });

  req.on('error', (err) => {
    console.error('Request error:', err);
    server.close();
    process.exit(1);
  });

  req.end();
});
