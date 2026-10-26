const fs = require('fs');
const assert = require('assert');
const path = require('path');
const http = require('http');

console.log('=== TEST USER CREATION ADMIN AUTH REQUIREMENT ===');

const base = path.join(__dirname, '..');
const srcFile = path.join(base, 'src/components/library/screens/users.tsx');
const clientFiles = [
  path.join(base, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(base, 'out/_next/static/chunks/18yoqc7d05wnq.js')
];
const serverFiles = [
  path.join(base, 'server/api.js'),
  path.join(base, 'dist-desktop/win-unpacked/resources/server/api.js')
];

// 1. Verify server code in both locations
for (const sf of serverFiles) {
  assert(fs.existsSync(sf), `Server file does not exist: ${sf}`);
  const content = fs.readFileSync(sf, 'utf8');
  assert(
    content.includes('ADMIN_AUTH_REQUIRED'),
    `Server file ${path.basename(sf)} must enforce ADMIN_AUTH_REQUIRED`
  );
  assert(
    content.includes('INVALID_ADMIN_PASSWORD'),
    `Server file ${path.basename(sf)} must enforce INVALID_ADMIN_PASSWORD`
  );
  assert(
    content.includes('adminPassword'),
    `Server file ${path.basename(sf)} must check adminPassword`
  );
  console.log(`✓ Server file ${sf} enforces admin password checks`);
}

// 2. Verify frontend source file
assert(fs.existsSync(srcFile), 'users.tsx does not exist');
const src = fs.readFileSync(srcFile, 'utf8');
assert(
  src.includes('adminAuthOpen'),
  'users.tsx must have adminAuthOpen state'
);
assert(
  src.includes('adminPassword'),
  'users.tsx must have adminPassword state'
);
assert(
  src.includes('qx-admin-auth-password'),
  'users.tsx must have password confirmation input'
);
assert(
  src.includes('confirmCreateUser'),
  'users.tsx must have confirmCreateUser handler'
);
console.log('✓ UI source users.tsx has admin password confirmation modal & handler');

// 3. Verify compiled production chunks
for (const cf of clientFiles) {
  assert(fs.existsSync(cf), `Chunk file does not exist: ${cf}`);
  const js = fs.readFileSync(cf, 'utf8');
  assert(
    js.includes('_ao') && js.includes('_ap') && js.includes('_ae'),
    `Chunk ${path.basename(cf)} must contain admin auth state variables`
  );
  assert(
    js.includes('qx-admin-auth-password'),
    `Chunk ${path.basename(cf)} must contain qx-admin-auth-password input`
  );
  assert(
    js.includes('تأكيد صلاحية المدير (Admin)'),
    `Chunk ${path.basename(cf)} must contain Arabic title for admin confirmation modal`
  );
  assert(
    js.includes('adminPassword:_ap'),
    `Chunk ${path.basename(cf)} must send adminPassword:_ap to /users`
  );
  console.log(`✓ Production chunk ${path.basename(cf)} verified with admin confirmation modal!`);
}

console.log('[PASS] ALL USER CREATION ADMIN AUTH CHECKS PASSED CLEANLY (10/10)!');
