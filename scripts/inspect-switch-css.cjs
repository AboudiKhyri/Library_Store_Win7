const fs = require('fs');
const path = require('path');

const outCssDir = path.resolve(__dirname, '../out/_next/static/chunks');
const files = fs.readdirSync(outCssDir).filter(f => f.endsWith('.css'));
console.log('CSS files:', files);

files.forEach(f => {
  const css = fs.readFileSync(path.join(outCssDir, f), 'utf8');
  console.log(`File: ${f}, size: ${css.length}`);
  const matches = css.match(/[^{}]*switch[^{}]*\{[^{}]*\}/gi);
  if (matches) {
    matches.forEach(m => console.log('Match:', m.trim()));
  }
});
