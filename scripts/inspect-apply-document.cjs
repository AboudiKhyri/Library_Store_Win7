const fs = require('fs');
const path = require('path');

const store = fs.readFileSync(path.resolve(__dirname, '../src/components/library/store.ts'), 'utf8');

const lines = store.split('\n');
lines.forEach((l, i) => {
  if (l.includes('applyDocument') || l.includes('dir') || l.includes('lang')) {
    console.log(`L${i+1}: ${l}`);
  }
});
