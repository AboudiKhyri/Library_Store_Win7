const fs = require('fs');
const path = require('path');

const srcDir = path.resolve('src');

const physicalUtils = [
  /\b(ml|mr|pl|pr|left|right)-[0-9\[]/,
  /\btext-(left|right)\b/,
  /\brounded-([lr]|tl|tr|bl|br)-/,
  /\bborder-([lr]|t-l|t-r|b-l|b-r)-/,
  /\bspace-x-/,
  /\btranslate-x-/,
];

const hardcodedColors = [
  /\btext-white\b/,
  /\bbg-white\b/,
  /\btext-black\b/,
  /\bbg-black\b/,
  /\btext-(gray|slate|zinc|neutral|stone)-[0-9]{2,3}\b/,
  /\bbg-(gray|slate|zinc|neutral|stone)-[0-9]{2,3}\b/,
  /#(fff|ffffff|000|000000)\b/i,
];

function scanDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      scanDir(full, fileList);
    } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      fileList.push(full);
    }
  }
  return fileList;
}

const allFiles = scanDir(srcDir);
console.log(`Scanning ${allFiles.length} files in src/...\n`);

const colorFindings = [];
const dirFindings = [];

for (const file of allFiles) {
  const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check hardcoded colors
    for (const pat of hardcodedColors) {
      const match = line.match(pat);
      if (match) {
        colorFindings.push({ file: rel, line: i + 1, match: match[0], text: line.trim() });
      }
    }

    // Check physical directions
    for (const pat of physicalUtils) {
      const match = line.match(pat);
      if (match) {
        dirFindings.push({ file: rel, line: i + 1, match: match[0], text: line.trim() });
      }
    }
  }
}

console.log(`=== HARDCODED COLOR FINDINGS (${colorFindings.length}) ===`);
colorFindings.slice(0, 30).forEach(f => console.log(`${f.file}:${f.line} -> ${f.match} :: ${f.text.slice(0, 80)}`));
if (colorFindings.length > 30) console.log(`... and ${colorFindings.length - 30} more`);

console.log(`\n=== PHYSICAL DIRECTION FINDINGS (${dirFindings.length}) ===`);
dirFindings.slice(0, 30).forEach(f => console.log(`${f.file}:${f.line} -> ${f.match} :: ${f.text.slice(0, 80)}`));
if (dirFindings.length > 30) console.log(`... and ${dirFindings.length - 30} more`);
