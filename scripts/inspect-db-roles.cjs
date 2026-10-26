const fs = require('fs');
const path = require('path');

const dbJs = fs.readFileSync(path.resolve(__dirname, '../server/db.js'), 'utf8');

const lines = dbJs.split('\n');
lines.forEach((l, i) => {
  if (l.includes('SYSTEM_ROLES') || l.includes('roleKey') || l.includes('INSERT INTO Role') || l.includes('inventory_manager')) {
    console.log(`L${i+1}: ${l}`);
  }
});
