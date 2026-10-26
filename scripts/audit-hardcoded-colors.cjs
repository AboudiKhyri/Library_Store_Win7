const fs = require('fs');
const path = require('path');

const screensDir = path.resolve(__dirname, '../src/components/library/screens');
const files = fs.readdirSync(screensDir).filter(f => f.endsWith('.tsx'));

console.log('--- Checking for potentially problematic hardcoded color classes ---');

files.forEach(f => {
  const code = fs.readFileSync(path.join(screensDir, f), 'utf8');
  const lines = code.split('\n');
  lines.forEach((l, i) => {
    // Check for text-white that is NOT on a button or badge with dark/colored bg
    if (l.includes('text-white') && !l.includes('bg-') && !l.includes('Button') && !l.includes('Badge') && !l.includes('gradient')) {
      console.log(`${f}:L${i+1} potentially bare text-white: ${l.trim()}`);
    }
    // Check for text-black
    if (l.includes('text-black')) {
      console.log(`${f}:L${i+1} potentially bare text-black: ${l.trim()}`);
    }
  });
});
