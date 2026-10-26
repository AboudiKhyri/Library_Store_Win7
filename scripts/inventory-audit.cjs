const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function walk(dir) {
  let res = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (item === 'node_modules' || item === '.next' || item === 'dist-desktop') continue;
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      res = res.concat(walk(full));
    } else {
      res.push(full);
    }
  }
  return res;
}

const all = walk(root);
const byExt = {};
const leftovers = [];

for (const f of all) {
  const ext = path.extname(f).toLowerCase() || '[none]';
  byExt[ext] = (byExt[ext] || 0) + 1;
  const base = path.basename(f);
  if (base.endsWith('.bak') || base.endsWith('.old') || base.includes('.bak_') || base.endsWith('.copy') || base.includes('copy.db')) {
    leftovers.push(path.relative(root, f));
  }
}

console.log('=== FILE INVENTORY SUMMARY ===');
console.log('Total non-ignored source & data files:', all.length);
console.log('By Extension:', byExt);
console.log('\nLeftovers / Backups found:', leftovers);
