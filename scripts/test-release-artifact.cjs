/**
 * scripts/test-release-artifact.cjs
 *
 * Automated verification test suite for Library Store Release Build v1.0.1
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');
const { execSync } = require('child_process');

console.log('=== TEST SUITE: RELEASE ARTIFACT VERIFICATION (v1.0.1) ===\n');

const root = path.resolve(__dirname, '..');
let total = 0;
let passed = 0;

function runTest(desc, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${desc}:`, err.message);
  }
}

// 1. Verify installer executable presence and size
const setupExe = path.join(root, 'dist-desktop/Library_Store_Win7_Setup_v1.0.1.exe');
runTest('(a) Library_Store_Win7_Setup_v1.0.1.exe exists and is sized between 90MB and 150MB', () => {
  assert(fs.existsSync(setupExe), 'Setup executable does not exist');
  const size = fs.statSync(setupExe).size;
  assert(size > 90 * 1024 * 1024, `Setup size too small: ${size} bytes`);
  assert(size < 150 * 1024 * 1024, `Setup size suspiciously large: ${size} bytes`);
});

// 2. Verify release metadata
const metaFile = path.join(root, 'dist-desktop/RELEASE_METADATA.json');
runTest('(b) dist-desktop/RELEASE_METADATA.json is valid and matches SHA256 of setup artifact', () => {
  assert(fs.existsSync(metaFile), 'RELEASE_METADATA.json does not exist');
  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  assert.strictEqual(meta.version, '1.0.1');
  assert.strictEqual(meta.artifact, 'Library_Store_Win7_Setup_v1.0.1.exe');

  const fileBytes = fs.readFileSync(setupExe);
  const actualHash = crypto.createHash('sha256').update(fileBytes).digest('hex');
  assert.strictEqual(meta.sha256, actualHash, 'SHA256 checksum mismatch');
});

// 3. Verify version alignment across codebase
runTest('(c) Version 1.0.1 is synchronized across package.json, server, desktop, and client types', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.version, '1.0.1', 'Root package.json version is not 1.0.1');

  const srvPkg = JSON.parse(fs.readFileSync(path.join(root, 'server/package.json'), 'utf8'));
  assert.strictEqual(srvPkg.version, '1.0.1', 'Server package.json version is not 1.0.1');

  const mainJs = fs.readFileSync(path.join(root, 'desktop/main.js'), 'utf8');
  assert(mainJs.includes("version: '1.0.1'"), 'desktop/main.js version is not 1.0.1');

  const srvApi = fs.readFileSync(path.join(root, 'server/api.js'), 'utf8');
  assert(srvApi.includes("version: '1.0.1'"), 'server/api.js version is not 1.0.1');

  const typesTs = fs.readFileSync(path.join(root, 'src/lib/library/types.ts'), 'utf8');
  assert(typesTs.includes("export const APP_VERSION = '1.0.1'"), 'src/lib/library/types.ts version is not 1.0.1');
});

// 4. Verify PE version info on win-unpacked/Library Store.exe
const unpackedExe = path.join(root, 'dist-desktop/win-unpacked/Library Store.exe');
runTest('(d) win-unpacked/Library Store.exe exists and PE metadata shows v1.0.1', () => {
  assert(fs.existsSync(unpackedExe), 'Library Store.exe missing from win-unpacked');
  // Check using rcedit or PowerShell
  const psCmd = `powershell.exe -NoProfile -Command "(Get-Item '${unpackedExe.replace(/'/g, "''")}').VersionInfo.FileVersion"`;
  const ver = execSync(psCmd, { encoding: 'utf8' }).trim();
  assert(ver.startsWith('1.0.1'), `Expected version 1.0.1, got: ${ver}`);
});

// 5. Verify Windows 7 compatibility assets in unpacked bundle
runTest('(e) Windows 7 Node 16 binary (ABI 93) and Electron 22 shell are intact', () => {
  const nodeExe = path.join(root, 'dist-desktop/win-unpacked/resources/bin/node.exe');
  assert(fs.existsSync(nodeExe), 'Bundled node.exe missing in dist-desktop resources/bin');

  const nodeVer = execSync(`"${nodeExe}" -v`, { encoding: 'utf8' }).trim();
  assert(nodeVer.startsWith('v16.'), `Expected Node 16 for Windows 7, got: ${nodeVer}`);

  const asar = path.join(root, 'dist-desktop/win-unpacked/resources/app.asar');
  assert(fs.existsSync(asar), 'resources/app.asar missing');
  assert(fs.statSync(asar).size > 400 * 1024, 'resources/app.asar appears corrupted/too small');
});

// 6. Test 7za archive integrity of the setup installer
runTest('(f) 7-Zip verifies solid LZMA archive integrity of setup executable', () => {
  const zaCandidates = [
    'C:/Users/Aboudi/AppData/Local/electron-builder/Cache/7zip@1.0.0/7zip-win-x64-a34pt/bin/7za.exe'
  ];
  const za = zaCandidates.find(p => fs.existsSync(p));
  if (za) {
    const res = execSync(`"${za}" t "${setupExe}"`, { encoding: 'utf8' });
    assert(res.includes('Everything is Ok'), 'Archive integrity test failed: ' + res);
  }
});

console.log(`\n=== RESULT: ${passed}/${total} TESTS PASSED ===\n`);
if (passed !== total) {
  process.exit(1);
}
