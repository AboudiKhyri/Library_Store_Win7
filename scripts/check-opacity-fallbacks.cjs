const fs = require('fs');
const path = require('path');

const srcDir = path.resolve('src');
const globalsCss = fs.readFileSync(path.resolve('src/app/globals.css'), 'utf8');

function scanDir(dir, list = []) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) scanDir(full, list);
    else if (f.endsWith('.tsx') || f.endsWith('.ts')) list.push(full);
  }
  return list;
}

const opacityRegex = /\b(bg|text|border|ring)-[a-zA-Z0-9_\-\[\]\(\)]+\/([0-9]{1,3})\b/g;
const usedOpacityClasses = new Set();

for (const file of scanDir(srcDir)) {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = opacityRegex.exec(content)) !== null) {
    usedOpacityClasses.add(match[0]);
  }
}

console.log(`Found ${usedOpacityClasses.size} unique opacity classes used in src/:`);
const missing = [];
for (const cls of Array.from(usedOpacityClasses).sort()) {
  // Check if globalsCss has an override for it
  // Escape for regex in CSS
  const escaped = cls.replace('/', '\\/').replace('[', '\\[').replace(']', '\\]').replace('(', '\\(').replace(')', '\\)');
  const hasOverride = globalsCss.includes(`.${cls.replace('/', '\\/')}`) || globalsCss.includes(cls);
  if (!hasOverride) {
    missing.push(cls);
  }
}

console.log(`\nClasses without explicit RGBA override in globals.css (${missing.length}):`);
missing.forEach(m => console.log(' - ' + m));
