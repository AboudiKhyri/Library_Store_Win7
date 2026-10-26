const fs = require('fs');
const path = require('path');

const apiJs = fs.readFileSync(path.resolve(__dirname, '../server/api.js'), 'utf8');

const lines = apiJs.split('\n');
lines.forEach((l, i) => {
  if (l.includes('/roles') || l.includes('FROM Role')) {
    console.log(`L${i+1}: ${l}`);
  }
});
