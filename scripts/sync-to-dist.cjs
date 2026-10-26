const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const distResources = path.join(root, 'dist-desktop/win-unpacked/resources');

console.log('=== SYNCING UPDATED BACKEND & CLIENT FILES TO DIST-DESKTOP ===');

// 1. Sync server/
const serverSrc = path.join(root, 'server');
const serverDest = path.join(distResources, 'server');
if (fs.existsSync(serverDest)) {
  fs.cpSync(serverSrc, serverDest, { recursive: true });
  console.log('✓ Synced server/ to dist-desktop/win-unpacked/resources/server/');
}

// 2. Sync out/ to client/
const outSrc = path.join(root, 'out');
const clientDest = path.join(distResources, 'client');
if (fs.existsSync(clientDest)) {
  fs.cpSync(outSrc, clientDest, { recursive: true });
  console.log('✓ Synced out/ to dist-desktop/win-unpacked/resources/client/');
}

console.log('=== SYNC COMPLETE ===');
