const serverDb = require('../server/db');
const db = serverDb.openDb();

const cols = db.prepare('PRAGMA table_info(Product)').all();
console.log('Product columns:');
cols.filter(c => c.name === 'sku' || c.name === 'barcode').forEach(c => {
  console.log(` - ${c.name}: type=${c.type}, notnull=${c.notnull}, dflt=${c.dflt_value}`);
});

const indexes = db.prepare('PRAGMA index_list(Product)').all();
console.log('\nProduct indexes:');
indexes.forEach(idx => {
  const info = db.prepare(`PRAGMA index_info("${idx.name}")`).all();
  console.log(` - ${idx.name}: unique=${idx.unique}, cols=${info.map(i => i.name).join(', ')}`);
});

// Check if any product has empty string barcode
const emptyCount = db.prepare("SELECT COUNT(*) as c FROM Product WHERE barcode = ''").get().c;
const nullCount = db.prepare("SELECT COUNT(*) as c FROM Product WHERE barcode IS NULL").get().c;
console.log(`\nBarcodes in custom.db: empty string ("") = ${emptyCount}, NULL = ${nullCount}`);
