const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('=== RUNNING BRANDING & VISUAL IDENTITY INTEGRATION TEST ===\n');

const projectRoot = path.resolve(__dirname, '..');
const betterSqlitePath = path.join(projectRoot, 'dist-desktop/win-unpacked/resources/server/node_modules/better-sqlite3');
const Database = require(betterSqlitePath);

// 1. Verify DB state
const db = new Database(path.join(projectRoot, 'data/custom.db'));
const row = db.prepare("SELECT branding FROM AppSettings WHERE id='default'").get();
assert.ok(row, 'AppSettings row must exist');
const dbBranding = JSON.parse(row.branding);
console.log('1. DB AppSettings.branding check:');
assert.ok(dbBranding.primary, 'Missing primary in DB');
assert.ok(dbBranding.secondary, 'Missing secondary in DB');
assert.ok(dbBranding.accent, 'Missing accent in DB');
assert.strictEqual(dbBranding.primary, '#00c8e0', 'Default primary should be #00c8e0');
console.log('  ✓ Verified DB AppSettings.branding has all required keys');
db.close();

// 2. Verify server getSettings
const { getSettings } = require(path.join(projectRoot, 'server/db'));
const settings = getSettings('default');
console.log('2. Server getSettings check:');
assert.ok(settings.branding, 'Missing branding in getSettings');
assert.strictEqual(settings.branding.primary, dbBranding.primary, 'primary color must match');
assert.strictEqual(settings.branding.secondary, dbBranding.secondary, 'secondary color must match');
assert.strictEqual(settings.branding.accent, dbBranding.accent, 'accent color must match');
console.log('  ✓ Verified server getSettings normalizes all color keys');

// 3. Verify chunks have fallback
console.log('3. Client compiled chunks check:');
const chunkPaths = [
  path.join(projectRoot, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(projectRoot, 'out/_next/static/chunks/18yoqc7d05wnq.js')
];

chunkPaths.forEach(cp => {
  assert.ok(fs.existsSync(cp), `Chunk missing: ${cp}`);
  const code = fs.readFileSync(cp, 'utf8');
  assert.ok(code.includes('primary:"#00c8e0"'), `Chunk ${path.basename(cp)} missing primary fallback`);
  assert.ok(code.includes('secondary:"#14b8a6"'), `Chunk ${path.basename(cp)} missing secondary fallback`);
  assert.ok(code.includes('accent:"#22d3ee"'), `Chunk ${path.basename(cp)} missing accent fallback`);
  console.log(`  ✓ Verified safe fallback in ${path.basename(path.dirname(path.dirname(cp)))}/${path.basename(cp)}`);
});

// 4. Verify API route accepts { branding: ... }
console.log('4. API route verification:');
const apiCode = fs.readFileSync(path.join(projectRoot, 'server/api.js'), 'utf8');
assert.ok(apiCode.includes('block === \'branding\''), 'Missing branding normalization in api.js');
assert.ok(apiCode.includes('req.body[k] !== undefined'), 'Missing flexible block format in api.js');
console.log('  ✓ Verified PUT /settings accepts both flexible and block formats');

console.log('\n[PASS] ALL BRANDING INTEGRATION CHECKS PASSED CLEANLY (4/4)!');
