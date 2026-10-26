const { openDb } = require('../server/db.js');

const db = openDb();

// 1. Delete test products left over from past tests
const testProds = db.prepare("SELECT id, sku, nameAr FROM Product WHERE sku LIKE 'TEST-%'").all();
console.log(`Deleting ${testProds.length} test products...`);
for (const p of testProds) {
  db.prepare('DELETE FROM StockMovement WHERE productId = ?').run(p.id);
  db.prepare('DELETE FROM Batch WHERE productId = ?').run(p.id);
  db.prepare('DELETE FROM Product WHERE id = ?').run(p.id);
}

// 2. Fetch remaining real products
const realProds = db.prepare('SELECT id, sku, nameAr, createdAt FROM Product ORDER BY createdAt ASC, id ASC').all();
console.log('Real products before re-sequencing:', realProds);

// 3. Re-sequence to SKU-0001, SKU-0002, etc.
const updateSku = db.prepare('UPDATE Product SET sku = ? WHERE id = ?');
realProds.forEach((p, idx) => {
  const newSku = `SKU-${String(idx + 1).padStart(4, '0')}`;
  console.log(`Updating product "${p.nameAr}" (${p.id}): ${p.sku} -> ${newSku}`);
  updateSku.run(newSku, p.id);
});

// 4. Verify results
const updated = db.prepare('SELECT id, sku, nameAr FROM Product ORDER BY sku ASC').all();
console.log('\nFinal products in database:');
console.table(updated);
