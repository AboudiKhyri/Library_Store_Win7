const fs = require('fs');
const path = require('path');

const files = [
  path.resolve(__dirname, '../server/index.js'),
  path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/server/index.js')
];

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/maxAge:\s*'1d',\s*\r?\n\s*immutable:\s*true,/g, 
    `maxAge: 0,
    etag: false,
    lastModified: false,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    },`
  );
  c = c.replace(/app\.get\('\*',\s*\(req,\s*res\)\s*=>\s*\{/g,
    `app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');`
  );
  fs.writeFileSync(f, c, 'utf8');
  console.log('[PASS] Updated cache headers in:', f);
});
