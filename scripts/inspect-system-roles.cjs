const fs = require('fs');
const path = require('path');

const sys = fs.readFileSync(path.resolve(__dirname, '../../src/lib/library/system.ts'), 'utf8');

const lines = sys.split('\n');
lines.forEach((l, i) => {
  if (l.includes('SYSTEM_ROLES') || l.includes('role') || l.includes('Role')) {
    console.log(`L${i+1}: ${l}`);
  }
});
