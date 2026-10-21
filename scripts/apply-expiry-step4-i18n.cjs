const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const p = path.join(root, 'src', 'lib', 'library', 'i18n.ts');
let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

c = c.replace(
  "'inv.writeoff': { ar: 'إعدام منتهي الصلاحية', en: 'Expiry write-off' },",
  "'inv.writeoff': { ar: 'إعدام/تسوية مخزنية', en: 'Write-off adjustment' },"
);

c = c.replace(
  "'inv.fefo': { ar: 'FEFO — الأقرب انتهاءً يصرف أولاً', en: 'FEFO — First Expiry, First Out' },",
  `'inv.fefo': { ar: 'FIFO — الأقدم وصولاً يصرف أولاً', en: 'FIFO — First In, First Out' },
  'inv.fifo': { ar: 'FIFO — الأقدم وصولاً يصرف أولاً', en: 'FIFO — First In, First Out' },`
);

c = c.replace(/\n/g, '\r\n');
fs.writeFileSync(p, c, 'utf8');
console.log('✓ i18n.ts updated');
