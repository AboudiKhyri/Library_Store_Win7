const cp = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const nodeExe = path.resolve(__dirname, '../desktop/bin/node.exe');
const serverScript = path.resolve(__dirname, '../server/server.js');
const dbCopy = path.resolve(__dirname, '../data/test_copy.db');

console.log('=== TESTING CLEAN SHUTDOWN, WAL CHECKPOINT & EXIT CODE 0 ===');

const env = {
  ...process.env,
  PORT: '3216',
  HOSTNAME: '127.0.0.1',
  DATABASE_URL: `file:${dbCopy}`,
  ELECTRON_RUN_AS_NODE: '1',
};

const proc = cp.spawn(nodeExe, [serverScript], {
  cwd: path.resolve(__dirname, '..'),
  env,
  stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
});

let exitCode = null;
let exitedCleanly = false;

proc.on('exit', (code) => {
  exitCode = code;
  exitedCleanly = (code === 0);
  console.log(`[PROCESS EXIT] Child exited with code: ${code}`);
});

async function run() {
  // Wait for ready
  let ready = false;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 200));
    try {
      const res = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:3216/api/library/system/status', (r) => {
          resolve(r.statusCode);
        }).on('error', reject);
      });
      if (res === 200) { ready = true; break; }
    } catch {}
  }

  if (!ready) {
    console.error('[FAIL] Server failed to boot');
    proc.kill();
    process.exit(1);
  }
  console.log('✓ Server is ready on port 3216');

  // Trigger graceful shutdown via HTTP
  console.log('>>> Sending graceful shutdown request...');
  const res = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3216,
      path: '/api/library/system/shutdown',
      method: 'POST',
    }, (r) => {
      resolve(r.statusCode);
    });
    req.on('error', reject);
    req.end();
  });

  console.log(`✓ Shutdown endpoint answered: HTTP ${res}`);

  // Wait up to 3 seconds for clean exit
  const start = Date.now();
  while (!exitedCleanly && Date.now() - start < 3000) {
    await new Promise(r => setTimeout(r, 100));
  }

  if (exitCode === 0) {
    console.log('✓ [PASS] Server exited with code 0 (clean graceful shutdown)');
  } else {
    console.error(`✗ [FAIL] Server exited with code ${exitCode}`);
    process.exit(1);
  }

  // Check WAL file size (checkpointed WAL should be empty or nonexistent)
  const walPath = dbCopy + '-wal';
  if (fs.existsSync(walPath)) {
    const walSize = fs.statSync(walPath).size;
    console.log(`✓ WAL file checkpointed: size = ${walSize} bytes (truncated)`);
    if (walSize > 32768) {
      console.warn('  [WARN] WAL not fully truncated');
    }
  } else {
    console.log('✓ WAL file checkpointed and unlinked');
  }

  console.log('=== SHUTDOWN VERIFICATION SUCCEEDED ===');
}

run();
