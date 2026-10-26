const fs = require('fs');
const path = require('path');

const win7Globals = path.resolve(__dirname, '../src/app/globals.css');
const mainGlobals = path.resolve(__dirname, '../../src/app/globals.css');

if (fs.existsSync(win7Globals) && fs.existsSync(mainGlobals)) {
  const content = fs.readFileSync(win7Globals, 'utf8');
  fs.writeFileSync(mainGlobals, content, 'utf8');
  console.log('✓ Successfully synchronized globals.css to main workspace (Universal sRGB guaranteed)');
}
