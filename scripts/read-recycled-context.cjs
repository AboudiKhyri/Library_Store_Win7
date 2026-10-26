const fs = require('fs');
const path = require('path');

const dir = 'D:/$RECYCLE.BIN/S-1-5-21-1260221887-920538262-2268369423-1001/$RZDGCR6';
console.log('dir exists:', fs.existsSync(dir));
if (fs.existsSync(dir)) {
  const list = fs.readdirSync(dir);
  console.log('list has PROJECT_CONTEXT.md:', list.includes('PROJECT_CONTEXT.md'));
  const p = path.join(dir, 'PROJECT_CONTEXT.md');
  const txt = fs.readFileSync(p, 'utf8');
  console.log('Size:', txt.length);
  console.log(txt.slice(0, 1500));
}
