/**
 * Synchronize i18n and screens across both workspaces
 */
'use strict';

const fs = require('fs');
const path = require('path');

const i18nFiles = [
  path.resolve(__dirname, '../src/lib/library/i18n.ts'),
  path.resolve(__dirname, '../../src/lib/library/i18n.ts')
];

for (const f of i18nFiles) {
  if (!fs.existsSync(f)) continue;
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/FIFO — الأقدم وصولاً يصرف أولاً/g, 'متابعة وإدارة كميات الأصناف وحركات المخزون');
  c = c.replace(/FEFO — الأقرب انتهاء يصرف أولا/g, 'متابعة وإدارة كميات الأصناف وحركات المخزون');
  c = c.replace(/تحديث حالات الصلاحية/g, 'تحديث الحالات');
  c = c.replace(/تم تحديث حالات الصلاحية/g, 'تم تحديث الحالات');
  c = c.replace(/سيتم إخراج الكمية من المخزون وتسجيلها كإعدام/g, 'سيتم إخراج الكمية من المخزون وتسجيلها كتسوية');
  fs.writeFileSync(f, c, 'utf8');
  console.log(`[PASS] Synchronized ${f}`);
}

// Ensure screens in root workspace match Library Store clean screens
const screensToSync = [
  'inventory.tsx',
  'settings.tsx',
  'reports.tsx',
  'products.tsx',
  'pos.tsx',
  'purchases.tsx',
  'returns.tsx',
  'sales-history.tsx',
  'stocktake.tsx',
  'dashboard.tsx'
];

for (const s of screensToSync) {
  const src = path.resolve(__dirname, `../src/components/library/screens/${s}`);
  const dest = path.resolve(__dirname, `../../src/components/library/screens/${s}`);
  if (fs.existsSync(src) && fs.existsSync(path.dirname(dest))) {
    fs.copyFileSync(src, dest);
    console.log(`[PASS] Synced screen ${s} to root workspace`);
  }
}

console.log('[SUCCESS] Source files synchronized across both workspaces.');
