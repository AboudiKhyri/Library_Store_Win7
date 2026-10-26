const fs = require('fs');
const path = require('path');

const p = path.resolve(__dirname, '../server/api.js');
let c = fs.readFileSync(p, 'utf8');

const oldCustomerQuery = `    let where = 'WHERE tenantId=@tenantId';
    const params = { tenantId: 'default' };
    if (q) { where += ' AND (name LIKE @q OR phone LIKE @q)'; params.q = q; }
    const total = db.prepare(\`SELECT COUNT(*) as c FROM "Customer" \${where}\`).get(params).c;
    const rows = db.prepare(\`SELECT * FROM "Customer" \${where} ORDER BY name ASC LIMIT @take OFFSET @skip\`).all({ ...params, take, skip });
    ok(res, { items: rows.map(r => ({ ...r, active: fromBool(r.active) })), total, page, pageSize });`;

const newCustomerQuery = `    let where = 'WHERE c.tenantId=@tenantId';
    const params = { tenantId: 'default' };
    if (q) { where += ' AND (c.name LIKE @q OR c.phone LIKE @q)'; params.q = q; }
    const total = db.prepare(\`SELECT COUNT(*) as c FROM "Customer" c \${where}\`).get(params).c;
    const rows = db.prepare(\`SELECT c.*,
      COALESCE((SELECT SUM(points) FROM "LoyaltyEvent" le WHERE le.customerId=c.id), 0) as loyaltyBalance,
      COALESCE((SELECT SUM(points) FROM "LoyaltyEvent" le WHERE le.customerId=c.id AND le.points > 0), 0) as loyaltyLifetime,
      COALESCE((SELECT COUNT(*) FROM "Sale" s WHERE s.customerId=c.id AND s.status='COMPLETED'), 0) as salesCount,
      COALESCE((SELECT SUM(total) FROM "Sale" s WHERE s.customerId=c.id AND s.status='COMPLETED'), 0) as totalSpent
      FROM "Customer" c \${where} ORDER BY c.name ASC LIMIT @take OFFSET @skip\`).all({ ...params, take, skip });
    ok(res, { items: rows.map(r => ({ ...r, active: fromBool(r.active) })), total, page, pageSize });`;

// Handle CRLF vs LF
if (c.includes(oldCustomerQuery)) {
  c = c.replace(oldCustomerQuery, newCustomerQuery);
  fs.writeFileSync(p, c, 'utf8');
  console.log('[PASS] Updated Customer queries in server/api.js (LF).');
} else if (c.includes(oldCustomerQuery.replace(/\n/g, '\r\n'))) {
  c = c.replace(oldCustomerQuery.replace(/\n/g, '\r\n'), newCustomerQuery.replace(/\n/g, '\r\n'));
  fs.writeFileSync(p, c, 'utf8');
  console.log('[PASS] Updated Customer queries in server/api.js (CRLF).');
} else {
  console.log('[WARN] Could not match oldCustomerQuery');
}
