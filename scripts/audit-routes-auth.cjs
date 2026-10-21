const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.resolve(__dirname, '../server/api.js'), 'utf8');
const lines = content.split('\n');

let routeList = [];
let current = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const m = line.match(/router\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]/);
  if (m) {
    if (current) routeList.push(current);
    current = { method: m[1].toUpperCase(), path: m[2], line: i + 1, hasAuth: false };
  }
  if (current) {
    if (
      line.includes('requirePermission') ||
      line.includes('requireAuth') ||
      current.path.startsWith('/system/status') ||
      current.path.startsWith('/auth/login') ||
      current.path.startsWith('/auth/logout') ||
      current.path.startsWith('/auth/session')
    ) {
      current.hasAuth = true;
    }
  }
}
if (current) routeList.push(current);

console.log('Total routes found:', routeList.length);
const unprot = routeList.filter(r => !r.hasAuth);
console.log('Unprotected routes count:', unprot.length);
unprot.forEach(r => console.log(`UNPROTECTED: [Line ${r.line}] ${r.method} ${r.path}`));
