const fs = require('fs');
const path = require('path');

const partsDir = path.resolve(__dirname, '../src/components/library/parts');
const files = fs.readdirSync(partsDir).filter(f => f.endsWith('.tsx'));

console.log('--- Checking parts for potentially problematic hardcoded color classes ---');

files.forEach(f => {
  const code = fs.readFileSync(path.join(partsDir, f), 'utf8');
  const lines = code.split('\n');
  lines.forEach((l, i) => {
    if (l.includes('text-white') && !l.includes('bg-') && !l.includes('Button') && !l.includes('Badge') && !l.includes('gradient')) {
      console.log(`${f}:L${i+1} potentially bare text-white: ${l.trim()}`);
    }
    if (l.includes('text-black')) {
      console.log(`${f}:L${i+1} potentially bare text-black: ${l.trim()}`);
    }
  });
});
