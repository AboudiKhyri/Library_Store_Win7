const fs = require('fs');
const Database = require('../server/node_modules/better-sqlite3');
const p = process.env.LOCALAPPDATA + '\\com.library.supermarket\\custom.db';

if (fs.existsSync(p)) {
  const db = new Database(p);
  const counts = {
    user_version: db.pragma('user_version', { simple: true }),
    batches: db.prepare('SELECT COUNT(*) as c FROM Batch').get().c,
    expiredBatches: db.prepare("SELECT COUNT(*) as c FROM Batch WHERE status='EXPIRED'").get().c,
    activeBatches: db.prepare("SELECT COUNT(*) as c FROM Batch WHERE status='ACTIVE'").get().c,
    products: db.prepare('SELECT COUNT(*) as c FROM Product').get().c,
    sales: db.prepare('SELECT COUNT(*) as c FROM Sale').get().c,
  };
  console.log('AppData counts:', counts);
  db.close();
} else {
  console.log('No AppData DB found');
}
