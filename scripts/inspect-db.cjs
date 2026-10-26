const path = require('path');
const Database = require(path.join(__dirname, '../server/node_modules/better-sqlite3'));
const db = new Database(path.join(__dirname, '../data/custom.db'));

const products = db.prepare('SELECT id, sku, nameAr, createdAt FROM Product ORDER BY createdAt DESC LIMIT 5').all();
console.log('Recent products:', JSON.stringify(products, null, 2));

const batches = db.prepare('SELECT * FROM Batch ORDER BY createdAt DESC LIMIT 5').all();
console.log('Recent batches:', JSON.stringify(batches, null, 2));

const movements = db.prepare('SELECT * FROM StockMovement ORDER BY createdAt DESC LIMIT 5').all();
console.log('Recent stock movements:', JSON.stringify(movements, null, 2));
