/**
 * Discovery Script for Expiry/FEFO references
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve('.');

const patterns = [
  /expiry/i,
  /expired/i,
  /expiring/i,
  /near[-_]?expiry/i,
  /shelf[-_]?life/i,
  /\bsweep\b/i,
  /\bFEFO\b/i,
  /days[-_]?left/i,
  /EXPIRY_WRITEOFF/,
  /تاريخ الانتهاء/,
  /منتهي/,
  /صلاحية/,
  /الصلاحية/,
  /قارب/,
];

const ignoreDirs = ['node_modules', '.git', 'dist-desktop', 'out', '.next'];

function scan(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoreDirs.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scan(full, results);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (['.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs', '.json', '.md', '.sql'].includes(ext)) {
        try {
          const content = fs.readFileSync(full, 'utf8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            for (const pat of patterns) {
              if (pat.test(line)) {
                results.push({
                  file: path.relative(rootDir, full).replace(/\\/g, '/'),
                  line: i + 1,
                  pattern: pat.toString(),
                  text: line.trim(),
                });
                break; // avoid duplicate match on same line
              }
            }
          }
        } catch (e) {
          // ignore binary / unreadable
        }
      }
    }
  }
  return results;
}

const findings = scan(rootDir);
console.log(`Total occurrences found: ${findings.length}`);

// Group by file
const byFile = {};
for (const f of findings) {
  if (!byFile[f.file]) byFile[f.file] = [];
  byFile[f.file].push(f);
}

fs.writeFileSync('scripts/expiry-discovery-raw.json', JSON.stringify(byFile, null, 2), 'utf8');
console.log(`Saved raw discovery to scripts/expiry-discovery-raw.json. Files count: ${Object.keys(byFile).length}`);
for (const [file, items] of Object.entries(byFile)) {
  console.log(` - ${file}: ${items.length} lines`);
}
