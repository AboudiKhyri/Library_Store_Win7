const fs = require('fs');
const path = require('path');

function updateMoney(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    `  if (typeof val === 'number') {\n    const d = new Date(val)\n    return isNaN(d.getTime()) ? null : d\n  }`,
    `  if (typeof val === 'number') {\n    if (!Number.isFinite(val) || val <= 0) return null\n    const d = new Date(val)\n    return isNaN(d.getTime()) ? null : d\n  }`
  );
  fs.writeFileSync(file, content, 'utf8');
  console.log('Updated toSafeDate number checks in:', file);
}

updateMoney(path.resolve(__dirname, '../src/lib/library/money.ts'));
updateMoney(path.resolve(__dirname, '../../src/lib/library/money.ts'));
