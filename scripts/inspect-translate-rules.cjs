const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.resolve(__dirname, '../out/_next/static/chunks/3oa5e4nmj08il.css'), 'utf8');

let pos = 0;
while (true) {
  const idx = css.indexOf('--tw-translate-x', pos);
  if (idx === -1) break;
  console.log('--- Found at', idx, '---');
  console.log(css.slice(Math.max(0, idx - 100), Math.min(css.length, idx + 200)));
  pos = idx + 20;
}
