/**
 * scripts/build-win7-release.cjs
 *
 * Automated Release Pipeline for Library Store Windows 7 Edition (v1.0.1)
 *
 * 1. Synchronizes version to 1.0.1 across client, server, and desktop configs.
 * 2. Syncs compiled client and backend assets to dist-desktop/win-unpacked.
 * 3. Repacks app.asar with updated desktop logic and package metadata.
 * 4. Stuffs file and product version 1.0.1.0 into Library Store.exe.
 * 5. Builds standalone NSIS installer Library_Store_Win7_Setup_v1.0.1.exe using electron-builder.
 * 6. Computes and logs SHA256 hashes and binary verification.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const TARGET_VERSION = '1.0.1';
const RC_VERSION = '1.0.1.0';

console.log(`=== STARTING RELEASE BUILD: Library Store v${TARGET_VERSION} ===\n`);

// 1. Version Synchronizer
console.log('--- Step 1: Synchronizing Version to ' + TARGET_VERSION + ' ---');

function updateFile(relPath, replacers) {
  const fullPath = path.join(root, relPath);
  if (!fs.existsSync(fullPath)) return;
  let content = fs.readFileSync(fullPath, 'utf8');
  let changed = false;
  for (const { from, to } of replacers) {
    if (content.includes(from)) {
      content = content.replace(from, to);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✓ Updated ${relPath}`);
  } else {
    console.log(`ℹ Already up-to-date: ${relPath}`);
  }
}

// 1.1 Root package.json
updateFile('package.json', [
  { from: '"version": "1.0.0"', to: `"version": "${TARGET_VERSION}"` }
]);

// 1.2 server/package.json
updateFile('server/package.json', [
  { from: '"version": "1.0.0"', to: `"version": "${TARGET_VERSION}"` }
]);

// 1.3 desktop/main.js
updateFile('desktop/main.js', [
  { from: "version: '1.0.0'", to: `version: '${TARGET_VERSION}'` }
]);

// 1.4 server/index.js
updateFile('server/index.js', [
  { from: "version: '1.0.0'", to: `version: '${TARGET_VERSION}'` }
]);

// 1.5 server/api.js
updateFile('server/api.js', [
  { from: "version: '1.0.0', build: 'win7'", to: `version: '${TARGET_VERSION}', build: 'win7'` },
  { from: "version: '1.0.0', branding:", to: `version: '${TARGET_VERSION}', branding:` },
  { from: "version: '1.0.0',", to: `version: '${TARGET_VERSION}',` }
]);

// 1.6 src/lib/library/types.ts
updateFile('src/lib/library/types.ts', [
  { from: "export const APP_VERSION = '1.0.0'", to: `export const APP_VERSION = '${TARGET_VERSION}'` }
]);

// 1.7 src/components/library/screens/about.tsx
updateFile('src/components/library/screens/about.tsx', [
  { from: "v${status?.version ?? '1.0.0'}", to: `v\${status?.version ?? '${TARGET_VERSION}'}` }
]);

// 1.8 src/components/library/screens/login.tsx
updateFile('src/components/library/screens/login.tsx', [
  { from: "Library Store v{status?.version ?? '1.0.0'}", to: `Library Store v{status?.version ?? '${TARGET_VERSION}'}` }
]);

// 1.9 src/components/library/app.tsx
updateFile('src/components/library/app.tsx', [
  { from: "v{status?.version ?? '1.0.0'}", to: `v{status?.version ?? '${TARGET_VERSION}'}` }
]);

// 1.10 Compiled client chunk fallbacks (out/ and dist-desktop/)
const chunkFiles = [
  'out/_next/static/chunks/18yoqc7d05wnq.js',
  'dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js',
  'dist-desktop/win-unpacked/resources/out/_next/static/chunks/18yoqc7d05wnq.js'
];
for (const cf of chunkFiles) {
  const p = path.join(root, cf);
  if (fs.existsSync(p)) {
    let c = fs.readFileSync(p, 'utf8');
    if (c.includes('"1.0.0"')) {
      c = c.replace(/"1\.0\.0"/g, `"${TARGET_VERSION}"`);
      fs.writeFileSync(p, c, 'utf8');
      console.log(`✓ Updated chunk version fallbacks in ${cf}`);
    }
  }
}

// 2. Sync server and client assets to dist-desktop
console.log('\n--- Step 2: Syncing Server and Client to dist-desktop ---');
execSync(`"${process.execPath}" scripts/sync-to-dist.cjs`, { cwd: root, stdio: 'inherit' });

// 3. Repack app.asar
console.log('\n--- Step 3: Repacking app.asar ---');
execSync(`"${process.execPath}" scripts/repack-asar.cjs`, { cwd: root, stdio: 'inherit' });

// 4. Update Library Store.exe PE metadata
console.log('\n--- Step 4: Updating PE Version Information ---');
const rceditCandidates = [
  'C:/Users/Aboudi/AppData/Local/electron-builder/Cache/winCodeSign/927377655/rcedit-x64.exe',
  'C:/Users/Aboudi/AppData/Local/electron-builder/Cache/winCodeSign/897043655/rcedit-x64.exe'
];
let rceditPath = rceditCandidates.find(p => fs.existsSync(p));
const exePath = path.join(root, 'dist-desktop/win-unpacked/Library Store.exe');

if (rceditPath && fs.existsSync(exePath)) {
  try {
    const cmd = `"${rceditPath}" "${exePath}" --set-file-version "${RC_VERSION}" --set-product-version "${RC_VERSION}" --set-version-string "ProductVersion" "${TARGET_VERSION}" --set-version-string "FileVersion" "${TARGET_VERSION}"`;
    execSync(cmd, { stdio: 'inherit' });
    console.log(`✓ Stamped Library Store.exe with Version ${TARGET_VERSION}`);
  } catch (err) {
    console.warn('⚠ Could not run rcedit:', err.message);
  }
}

// 5. Build NSIS Installer with electron-builder
console.log('\n--- Step 5: Packaging NSIS Release Installer ---');
const nsisCmd = `cmd.exe /c "cd /d ${root} && npx electron-builder --win nsis --prepackaged dist-desktop/win-unpacked"`;
console.log(`Executing: ${nsisCmd}`);
execSync(nsisCmd, { cwd: root, stdio: 'inherit' });

// 6. Verify Artifacts
console.log('\n--- Step 6: Verifying Release Artifact ---');
const setupExe = path.join(root, `dist-desktop/Library_Store_Win7_Setup_v${TARGET_VERSION}.exe`);
if (!fs.existsSync(setupExe)) {
  console.error(`✗ FAILED: Expected artifact not found at ${setupExe}`);
  process.exit(1);
}

const stats = fs.statSync(setupExe);
const sizeMb = (stats.size / 1024 / 1024).toFixed(2);
console.log(`✓ Found: ${path.basename(setupExe)}`);
console.log(`  Size: ${sizeMb} MB (${stats.size.toLocaleString()} bytes)`);

if (stats.size < 80 * 1024 * 1024) {
  console.error('✗ FAILED: Installer file size is suspiciously small (<80MB)');
  process.exit(1);
}

// Calculate SHA256
const fileBuffer = fs.readFileSync(setupExe);
const hashSum = crypto.createHash('sha256');
hashSum.update(fileBuffer);
const sha256 = hashSum.digest('hex');
console.log(`  SHA256: ${sha256}`);

// Test with 7za
const zaCandidates = [
  'C:/Users/Aboudi/AppData/Local/electron-builder/Cache/7zip@1.0.0/7zip-win-x64-a34pt/bin/7za.exe'
];
const zaPath = zaCandidates.find(p => fs.existsSync(p));
if (zaPath) {
  try {
    const tOut = execSync(`"${zaPath}" t "${setupExe}"`, { encoding: 'utf8' });
    if (tOut.includes('Everything is Ok')) {
      console.log('✓ 7-Zip Archive Integrity Verified (Everything is Ok)');
    }
  } catch (e) {
    console.warn('⚠ 7-Zip test warning:', e.message);
  }
}

// Write release metadata
const releaseInfo = {
  version: TARGET_VERSION,
  artifact: path.basename(setupExe),
  sizeBytes: stats.size,
  sizeMb: `${sizeMb} MB`,
  sha256,
  targetPlatform: 'Windows 7 SP1+ (x64)',
  electronVersion: '22.3.27',
  nodeVersion: '16.20.2',
  builtAt: new Date().toISOString()
};

fs.writeFileSync(
  path.join(root, 'dist-desktop/RELEASE_METADATA.json'),
  JSON.stringify(releaseInfo, null, 2),
  'utf8'
);
console.log('✓ Written dist-desktop/RELEASE_METADATA.json');

console.log(`\n========================================================`);
console.log(`🎉 RELEASE BUILD COMPLETE: Library_Store_Win7_Setup_v${TARGET_VERSION}.exe`);
console.log(`========================================================\n`);
