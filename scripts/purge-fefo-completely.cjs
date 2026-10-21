/**
 * Forensic Purge of FEFO and Expiry from Library Store
 * Eliminates all remaining expiry UI cards, ticker warnings, filter buttons, and FEFO references.
 */
const fs = require('fs');
const path = require('path');

console.log('===> Starting Complete FEFO and Expiry Purge...');

// ─── 1. Clean src/lib/library/i18n.ts ──────────────────────────────────────────
const i18nPath = path.resolve(__dirname, '../src/lib/library/i18n.ts');
let i18nCode = fs.readFileSync(i18nPath, 'utf8');
i18nCode = i18nCode.replace(/'dash\.nearExpiry':\s*\{[^}]+\},\s*/g, '');
i18nCode = i18nCode.replace(/'dash\.expired':\s*\{[^}]+\},\s*/g, '');
i18nCode = i18nCode.replace(/'inv\.nearExpiry':\s*\{[^}]+\},\s*/g, '');
i18nCode = i18nCode.replace(/'settings\.allowExpired':\s*\{[^}]+\},\s*/g, '');
fs.writeFileSync(i18nPath, i18nCode, 'utf8');
console.log('✓ Cleaned src/lib/library/i18n.ts');

// ─── 2. Clean src/lib/library/services/dashboard.ts ─────────────────────────────
const dashServPath = path.resolve(__dirname, '../src/lib/library/services/dashboard.ts');
if (fs.existsSync(dashServPath)) {
  let dashServCode = fs.readFileSync(dashServPath, 'utf8');
  dashServCode = dashServCode.replace(/nearExpiryCount:\s*number\s*,?\s*/g, '');
  dashServCode = dashServCode.replace(/let nearExpiryCount = 0\s*,?\s*/g, '');
  dashServCode = dashServCode.replace(/nearExpiryCount\s*,?\s*/g, '');
  dashServCode = dashServCode.replace(/expiringCount:\s*nearExpiryCount\s*,?\s*/g, '');
  fs.writeFileSync(dashServPath, dashServCode, 'utf8');
  console.log('✓ Cleaned src/lib/library/services/dashboard.ts');
}

// ─── 3. Clean server/api.js ──────────────────────────────────────────────────
const apiPath = path.resolve(__dirname, '../server/api.js');
let apiCode = fs.readFileSync(apiPath, 'utf8');
apiCode = apiCode.replace(/let nearExpiryCount = 0;\s*/g, '');
apiCode = apiCode.replace(/let expiredCount = 0;\s*/g, '');
apiCode = apiCode.replace(/nearExpiryCount,\s*/g, '');
apiCode = apiCode.replace(/expiredCount,\s*/g, '');
apiCode = apiCode.replace(/expiringCount:\s*nearExpiryCount,?\s*/g, '');
fs.writeFileSync(apiPath, apiCode, 'utf8');

const distApiPath = path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/server/api.js');
if (fs.existsSync(distApiPath)) {
  fs.writeFileSync(distApiPath, apiCode, 'utf8');
  console.log('✓ Cleaned server/api.js and synced to dist-desktop');
}

// ─── 4. Patch Compiled Bundles (out & dist-desktop) ───────────────────────────
const chunkPaths = [
  path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js'),
  path.resolve(__dirname, '../out/_next/static/chunks/18yoqc7d05wnq.js'),
];

chunkPaths.forEach(chunkPath => {
  if (!fs.existsSync(chunkPath)) return;
  let code = fs.readFileSync(chunkPath, 'utf8');

  // 4a. Remove Dashboard nearExpiry and expired cards:
  // Target: className:"grid gap-4 sm:grid-cols-2 xl:grid-cols-4",children:[(0,N.jsx)(ot,{label:e("dash.nearExpiry")...}),(0,N.jsx)(ot,{label:e("dash.expired")...}),(0,N.jsx)(ot,{label:e("dash.purchaseActivity")...}),(0,N.jsx)(ot,{label:e("dash.avgTransaction")...})]
  const dashOldPattern = /className:"grid gap-4 sm:grid-cols-2 xl:grid-cols-4",children:\[\(0,N\.jsx\)\([a-zA-Z0-9]+,\{label:[a-zA-Z0-9]+\("dash\.nearExpiry"\)[^}]+\}\),\(0,N\.jsx\)\([a-zA-Z0-9]+,\{label:[a-zA-Z0-9]+\("dash\.expired"\)[^}]+\}\),/;
  
  if (dashOldPattern.test(code)) {
    code = code.replace(dashOldPattern, 'className:"grid gap-4 sm:grid-cols-2",children:[');
    console.log(`✓ Removed Dashboard Expiry Cards in ${path.basename(chunkPath)}`);
  } else {
    console.warn(`Dashboard cards pattern not matched in ${chunkPath}`);
  }

  // 4b. Neutralize AlertTicker expired and nearExpiry checks:
  // Old: let s=r.expiredCount>0,o=r.nearExpiryCount>0,l=r.lowStockCount>0;return s||o||l?
  const tickerOldPattern = /let s=r\.expiredCount>0,o=r\.nearExpiryCount>0,l=r\.lowStockCount>0;return s\|\|o\|\|l\?/;
  if (tickerOldPattern.test(code)) {
    code = code.replace(tickerOldPattern, 'let s=!1,o=!1,l=r.lowStockCount>0;return l?');
    console.log(`✓ Neutralized AlertTicker in ${path.basename(chunkPath)}`);
  }

  // 4c. Remove Inventory 3 Cards:
  // Target: (0,N.jsxs)("div",{className:"grid grid-cols-3 gap-3",children:[(0,N.jsx)(MM,{label:r("inv.expired")...}),(0,N.jsx)(MM,{label:r("inv.nearExpiry")...}),(0,N.jsx)(MM,{label:r("inv.valid")...})]})
  const invCardsPattern = /\(0,N\.jsxs\)\("div",\{className:"grid grid-cols-3 gap-3",children:\[\(0,N\.jsx\)\([a-zA-Z0-9]+,\{label:[a-zA-Z0-9]+\("inv\.expired"\)[^\]]+\]\}\),/;
  if (invCardsPattern.test(code)) {
    code = code.replace(invCardsPattern, '');
    console.log(`✓ Removed Inventory Expiry Cards in ${path.basename(chunkPath)}`);
  }

  // 4d. Remove Inventory Expiry Filter Chips:
  // Target: (0,N.jsx)(MA,{active:"expired"===S...}),(0,N.jsx)(MA,{active:"near"===S...}),(0,N.jsx)(MA,{active:"valid"===S...}),
  const filterOldPattern = /\(0,N\.jsx\)\([a-zA-Z0-9]+,\{active:"expired"===S[^\)]+\}\),\(0,N\.jsx\)\([a-zA-Z0-9]+,\{active:"near"===S[^\)]+\}\),\(0,N\.jsx\)\([a-zA-Z0-9]+,\{active:"valid"===S[^\)]+\}\),/;
  if (filterOldPattern.test(code)) {
    code = code.replace(filterOldPattern, '');
    console.log(`✓ Removed Inventory Filter Chips in ${path.basename(chunkPath)}`);
  }

  // 4e. Replace text references: FEFO -> FIFO
  code = code.replace(/FEFO — الأقرب انتهاءً يصرف أولاً/g, 'FIFO — الأقدم وروداً يصرف أولاً');
  code = code.replace(/FEFO — First Expiry, First Out/g, 'FIFO — First In, First Out');
  code = code.replace(/ويُصرف المخزون بنظام FEFO\./g, 'ويُصرف المخزون بنظام FIFO.');
  code = code.replace(/FEFO \(استهلاك الباتشات الأقرب انتهاءً أولاً\)/g, 'FIFO (استهلاك الباتشات الأقدم أولاً)');
  code = code.replace(/FEFO/g, 'FIFO');
  code = code.replace(/fefo/g, 'fifo');

  fs.writeFileSync(chunkPath, code, 'utf8');
  console.log(`✓ Successfully patched ${chunkPath}`);
});

console.log('===> FEFO and Expiry Purge Complete!');
