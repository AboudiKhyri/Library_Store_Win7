const fs = require('fs');
const path = require('path');

const g1 = path.resolve(__dirname, '../../src/app/globals.css');
const g2 = path.resolve(__dirname, '../src/app/globals.css');

console.log('g1 exists:', fs.existsSync(g1));
console.log('g2 exists:', fs.existsSync(g2));

if (fs.existsSync(g1)) {
  const c = fs.readFileSync(g1, 'utf8');
  console.log('g1 has switch rules:', c.includes('RTL Switch Thumb Transitions'));
}
if (fs.existsSync(g2)) {
  const c = fs.readFileSync(g2, 'utf8');
  console.log('g2 has switch rules:', c.includes('RTL Switch Thumb Transitions'));
}
