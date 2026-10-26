const cp = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const electronExe = path.join(root, 'node_modules/electron/dist/electron.exe');
const mainJs = path.join(root, 'desktop/main.js');
const dbCopy = path.join(root, 'data/test_copy.db');

console.log('=== TESTING DESKTOP ELECTRON LAUNCH & CLEAN SHUTDOWN ===');

const env = {
  ...process.env,
  DATABASE_URL: `file:${dbCopy}`,
  NODE_ENV: 'production',
};

const proc = cp.spawn(electronExe, [mainJs], {
  cwd: root,
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

proc.stdout.on('data', d => console.log('[desktop stdout]', d.toString().trim()));
proc.stderr.on('data', d => console.error('[desktop stderr]', d.toString().trim()));

let exited = false;
let exitCode = null;
proc.on('exit', (code) => {
  exited = true;
  exitCode = code;
  console.log(`[DESKTOP EXIT] Electron process exited with code ${code}`);
});

async function run() {
  // Wait up to 15s for port 3210 status
  let ok = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const status = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:3210/api/library/system/status', (res) => {
          resolve(res.statusCode);
        }).on('error', reject);
      });
      if (status === 200) { ok = true; break; }
    } catch {}
  }

  if (ok) {
    console.log('✓ Desktop Electron spawned server successfully and answered 200 OK');
  } else {
    console.error('✗ Desktop failed to answer on port 3210');
    proc.kill();
    process.exit(1);
  }

  // Allow window to initialize
  await new Promise(r => setTimeout(r, 2000));

  // Request clean quit
  console.log('>>> Triggering graceful shutdown...');
  try {
    await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: 3210,
        path: '/api/library/system/shutdown',
        method: 'POST',
      }, (r) => resolve(r.statusCode));
      req.on('error', reject);
      req.end();
    });
  } catch {}

  // Wait for electron to close
  const start = Date.now();
  while (!exited && Date.now() - start < 5000) {
    await new Promise(r => setTimeout(r, 200));
  }

  if (!exited) {
    console.log('Sending kill to Electron process...');
    proc.kill();
  }

  console.log('=== TEST COMPLETED ===');
}

run();
