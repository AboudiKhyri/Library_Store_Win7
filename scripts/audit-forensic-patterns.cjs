const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const serverDir = path.join(rootDir, 'server');
const desktopDir = path.join(rootDir, 'desktop');

function walk(dir) {
  let files = [];
  if (!fs.existsSync(dir)) return files;
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (f !== 'node_modules' && f !== '.next' && f !== 'dist-desktop' && f !== 'out') {
        files = files.concat(walk(full));
      }
    } else if (/\.(ts|tsx|js|cjs|mjs)$/.test(f)) {
      files.push(full);
    }
  }
  return files;
}

const allFiles = [...walk(srcDir), ...walk(serverDir), ...walk(desktopDir)];
console.log('Total files to scan:', allFiles.length);

const emptyCatches = [];
const rawSqlConcat = [];
const getTimeUnsafe = [];
const cdnOrHttpUrls = [];

for (const file of allFiles) {
  const code = fs.readFileSync(file, 'utf8');
  const lines = code.split('\n');
  lines.forEach((l, idx) => {
    // empty catch
    if (/catch\s*(\([^\)]*\))?\s*\{\s*\}/.test(l)) {
      emptyCatches.push({ file, line: idx + 1, text: l.trim() });
    }
    // raw sql concatenation in server
    if (file.includes('server') && /prepare\s*\(`[^`]*\$\{/.test(l)) {
      rawSqlConcat.push({ file, line: idx + 1, text: l.trim() });
    }
    // getTime in src
    if (file.includes('src') && /\.getTime\(\)/.test(l) && !file.includes('money.ts')) {
      getTimeUnsafe.push({ file, line: idx + 1, text: l.trim() });
    }
    // external CDN or non-localhost URLs in src/server
    if ((file.includes('src') || file.includes('server')) && /(https?:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)[a-zA-Z0-9_\-\.]+)/.test(l)) {
      // ignore schema.org or xml schemas or documentation comments
      if (!l.includes('http://www.w3.org') && !l.includes('https://raw.githubusercontent.com') && !l.includes('github.com/advisories')) {
        cdnOrHttpUrls.push({ file, line: idx + 1, text: l.trim() });
      }
    }
  });
}

console.log('\n--- 1. Empty Catches (' + emptyCatches.length + ' found):');
emptyCatches.forEach(c => console.log('  ' + path.relative(rootDir, c.file) + ':' + c.line + ' -> ' + c.text));

console.log('\n--- 2. Raw SQL Template Interpolations in server (' + rawSqlConcat.length + ' found):');
rawSqlConcat.forEach(c => console.log('  ' + path.relative(rootDir, c.file) + ':' + c.line + ' -> ' + c.text));

console.log('\n--- 3. getTime() outside money.ts (' + getTimeUnsafe.length + ' found):');
getTimeUnsafe.forEach(c => console.log('  ' + path.relative(rootDir, c.file) + ':' + c.line + ' -> ' + c.text));

console.log('\n--- 4. Outbound External URLs in src/server (' + cdnOrHttpUrls.length + ' found):');
cdnOrHttpUrls.forEach(c => console.log('  ' + path.relative(rootDir, c.file) + ':' + c.line + ' -> ' + c.text));
