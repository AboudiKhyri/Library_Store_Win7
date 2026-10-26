const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const apiFiles = [
  path.join(root, 'server/api.js'),
  path.join(root, 'dist-desktop/win-unpacked/resources/server/api.js')
];

const getNextSkuCode = `function getNextSku(db, tenantId = 'default') {
  const rows = db.prepare('SELECT sku FROM "Product" WHERE tenantId=@tenantId').all({ tenantId });
  const existingSet = new Set();
  const seqNums = [];
  for (const r of rows) {
    if (r && r.sku) {
      const s = String(r.sku).trim();
      existingSet.add(s.toUpperCase());
      const m = s.match(/^SKU-(\\d+)$/i);
      if (m) {
        const val = parseInt(m[1], 10);
        if (val > 0 && val < 500000) seqNums.push(val);
      }
    }
  }
  let nextNum = 1;
  if (seqNums.length > 0) {
    nextNum = Math.max(...seqNums) + 1;
  }
  let candidate = 'SKU-' + String(nextNum).padStart(4, '0');
  while (existingSet.has(candidate.toUpperCase())) {
    nextNum++;
    candidate = 'SKU-' + String(nextNum).padStart(4, '0');
  }
  return candidate;
}
`;

const nextSkuRouteCode = `router.get('/products/next-sku', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'PRODUCT_VIEW');
    const db = openDb();
    const nextSku = getNextSku(db);
    ok(res, { nextSku });
  });
});
`;

for (const filePath of apiFiles) {
  if (!fs.existsSync(filePath)) {
    console.log('Skipping missing file:', filePath);
    continue;
  }
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Add getNextSku if not already present
  if (!content.includes('function getNextSku(')) {
    content = content.replace(
      'router.get(\'/products\', (req, res) => {',
      `${getNextSkuCode}\nrouter.get('/products', (req, res) => {`
    );
  }

  // 2. Add router.get('/products/next-sku') if not present
  if (!content.includes('/products/next-sku')) {
    content = content.replace(
      'router.get(\'/products/:id\', (req, res) => {',
      `${nextSkuRouteCode}\nrouter.get('/products/:id', (req, res) => {`
    );
  }

  // 3. Update router.post('/products') to auto-generate sku if missing or empty
  content = content.replace(
    /const\s*\{\s*sku,\s*nameAr,\s*nameEn/g,
    'let { sku, nameAr, nameEn'
  );
  content = content.replace(
    /if\s*\(\s*!sku\s*\|\|\s*!nameAr\s*\|\|\s*sellingPrice\s*===\s*undefined\s*\)\s*throw\s*ApiError\('VALIDATION',\s*'sku,\s*nameAr,\s*sellingPrice\s*مطلوبة',\s*400\);/g,
    `if (!nameAr || sellingPrice === undefined) throw ApiError('VALIDATION', 'nameAr, sellingPrice مطلوبة', 400);\n    if (!sku || !sku.trim()) {\n      sku = getNextSku(db);\n    }`
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✓ Successfully patched', filePath);
}
