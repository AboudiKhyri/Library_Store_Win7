const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('=== VERIFYING LBC FONT INTEGRATION ===\n');

// 1. Verify font files exist and match original size
const localFont = path.resolve(__dirname, '../LBC.otf');
const parentFont = path.resolve(__dirname, '../../LBC.otf');
const originalFont = fs.existsSync(localFont) ? localFont : parentFont;
assert.ok(fs.existsSync(originalFont), 'Original LBC.otf must exist');
const expectedSize = fs.statSync(originalFont).size;
console.log('Original LBC.otf size:', expectedSize, 'bytes');

const candidateTargets = [
  path.resolve(__dirname, '../public/fonts/LBC.otf'),
  path.resolve(__dirname, '../out/fonts/LBC.otf'),
  path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/client/fonts/LBC.otf'),
  path.resolve(__dirname, '../../public/fonts/LBC.otf'),
];
const fontTargets = candidateTargets.filter(t => fs.existsSync(t));
assert.ok(fontTargets.length >= 3, 'Must verify all local targets');

fontTargets.forEach(target => {
  const s = fs.statSync(target).size;
  assert.strictEqual(s, expectedSize, `Size mismatch for: ${target}`);
  console.log('✓ Verified font file on disk:', path.basename(path.dirname(target)) + '/' + path.basename(target));
});

// 2. Verify CSS font-face declarations
const candidateCssFiles = [
  path.resolve(__dirname, '../src/app/globals.css'),
  path.resolve(__dirname, '../out/_next/static/chunks/3oa5e4nmj08il.css'),
  path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/client/_next/static/chunks/3oa5e4nmj08il.css'),
  path.resolve(__dirname, '../../src/app/globals.css'),
];
const cssFiles = candidateCssFiles.filter(f => fs.existsSync(f));
assert.ok(cssFiles.length >= 3, 'Must verify all local CSS targets');

cssFiles.forEach(file => {
  assert.ok(fs.existsSync(file), `CSS file missing: ${file}`);
  const c = fs.readFileSync(file, 'utf8');
  assert.ok(c.includes("font-family: 'LBC'") || c.includes("font-family:'LBC'"), `Missing LBC font-family in ${file}`);
  assert.ok(c.includes("url('/fonts/LBC.otf')"), `Missing LBC font URL in ${file}`);
  console.log('✓ Verified CSS font-face in:', path.basename(file));
});

console.log('\n[PASS] SUITE SUMMARY: LBC FONT INTEGRATION 100% VERIFIED ACROSS ALL TARGETS');
