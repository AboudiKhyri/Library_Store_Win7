const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.resolve(__dirname, '..');

const apiFiles = [
  path.join(rootDir, 'server/api.js'),
  path.join(rootDir, 'dist-desktop/win-unpacked/resources/server/api.js')
];

for (const filePath of apiFiles) {
  if (!fs.existsSync(filePath)) continue;

  let code = fs.readFileSync(filePath, 'utf8');

  // Fix the extra `});` after suppliers, customers, products
  code = code.replace(
    /router\.delete\('\/suppliers\/:id',[\s\S]*?\}\);\s*\}\);\s*\}\);/,
    (match) => match.replace(/\}\);\s*\}\);\s*\}\);$/, '});\n});')
  );

  code = code.replace(
    /router\.delete\('\/customers\/:id',[\s\S]*?\}\);\s*\}\);\s*\}\);/,
    (match) => match.replace(/\}\);\s*\}\);\s*\}\);$/, '});\n});')
  );

  code = code.replace(
    /router\.delete\('\/products\/:id',[\s\S]*?\}\);\s*\}\);\s*\}\);/,
    (match) => match.replace(/\}\);\s*\}\);\s*\}\);$/, '});\n});')
  );

  try {
    new vm.Script(code);
    fs.writeFileSync(filePath, code, 'utf8');
    console.log('✓ Validated and saved clean syntax in', path.relative(rootDir, filePath));
  } catch (err) {
    console.error('✗ Validation error in', filePath, err.message);
  }
}
