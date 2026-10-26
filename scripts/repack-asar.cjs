const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== REPACKING APP.ASAR FOR DIST-DESKTOP ===');

const root = path.resolve(__dirname, '..');
const distResources = path.join(root, 'dist-desktop/win-unpacked/resources');
const currentAsar = path.join(distResources, 'app.asar');
const backupAsar = path.join(distResources, 'app.asar.bak');

// 1. Backup if not already backed up
if (!fs.existsSync(backupAsar) && fs.existsSync(currentAsar)) {
  fs.copyFileSync(currentAsar, backupAsar);
  console.log('✓ Backed up original app.asar to app.asar.bak');
}

// 2. Prepare staging directory
const stagingDir = path.join(root, 'dist-desktop/.staging-asar');
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
fs.mkdirSync(stagingDir, { recursive: true });

// Copy desktop directory
const desktopSrc = path.join(root, 'desktop');
const desktopDest = path.join(stagingDir, 'desktop');
fs.cpSync(desktopSrc, desktopDest, { recursive: true });
// Exclude 62.7MB node.exe from inside app.asar (it is already in resources/bin/node.exe)
const stagedBin = path.join(desktopDest, 'bin');
if (fs.existsSync(stagedBin)) fs.rmSync(stagedBin, { recursive: true, force: true });

// Copy package.json
const pkgSrc = path.join(root, 'package.json');
const pkgDest = path.join(stagingDir, 'package.json');
fs.copyFileSync(pkgSrc, pkgDest);

console.log('✓ Prepared staging directory with latest desktop & package.json');

// 3. Pack asar
try {
  execSync(`cmd.exe /c npx asar pack "${stagingDir}" "${currentAsar}"`, { stdio: 'inherit' });
  console.log('✓ Successfully packed fresh app.asar');
} catch (err) {
  console.error('Failed to pack asar:', err);
  process.exit(1);
} finally {
  // Clean up staging
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

console.log('=== ASAR REPACK COMPLETE ===');
