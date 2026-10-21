const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const apiPath = path.join(root, 'server', 'api.js');
let code = fs.readFileSync(apiPath, 'utf8').replace(/\r\n/g, '\n');

// 1. Line 995
code = code.replace(
  'expiryDate: b.expiryDate ? (typeof b.expiryDate === \'string\' ? b.expiryDate : new Date(b.expiryDate).toISOString()) : null,',
  'expiryDate: null,'
);

// 2. Line 1398
code = code.replace(
  'expiryDate: i.expiryDate ? (typeof i.expiryDate === \'string\' ? i.expiryDate : new Date(i.expiryDate).toISOString()) : null,',
  'expiryDate: null,'
);

// 3. Line 1567
code = code.replace(
  'expiryDate: i.expiryDate ? (typeof i.expiryDate === \'string\' ? i.expiryDate : new Date(i.expiryDate).toISOString()) : null,',
  'expiryDate: null,'
);

// 4. Line 1657
code = code.replace(
  'expiryDate: i.expiryDate ? (typeof i.expiryDate === \'string\' ? i.expiryDate : new Date(i.expiryDate).toISOString()) : null,',
  'expiryDate: null,'
);

// 5. Line 2061 (reports inventory batches)
code = code.replace(
  'SELECT productId, quantity, costPrice, expiryDate, status FROM "Batch" WHERE tenantId=@tenantId AND quantity>0 AND status IN (\'ACTIVE\',\'EXPIRED\')',
  'SELECT productId, quantity, costPrice, status FROM "Batch" WHERE tenantId=@tenantId AND quantity>0 AND status=\'ACTIVE\''
);

// 6. Line 2100 (reports low-stock batches)
code = code.replace(
  'SELECT productId, quantity FROM "Batch" WHERE tenantId=@tenantId AND quantity>0 AND status=\'ACTIVE\' AND (expiryDate IS NULL OR expiryDate>=@todayIso)',
  'SELECT productId, quantity FROM "Batch" WHERE tenantId=@tenantId AND quantity>0 AND status=\'ACTIVE\''
);

// 7. Line 2206 (dashboard warningDays)
code = code.replace(
  '    const warningDays = (settings.pos && settings.pos.expiryWarningDays) || 30;\n',
  ''
);

// 8. Line 1888-1900 (expiry export spec)
code = code.replace(
  /  expiry: \[\n    \{ header: 'الصنف'[\s\S]*?\{ header: 'الحالة', get: \(r\) => CSV_EXPIRY_STATE\[r\.state\] \|\| r\.state \},\n  \],\n/,
  ''
);

code = code.replace(/\n/g, '\r\n');
fs.writeFileSync(apiPath, code, 'utf8');
console.log('✓ server/api.js polished successfully');
