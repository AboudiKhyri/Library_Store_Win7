/**
 * UI Fix: Eliminate arbitrary opacity fallbacks on Windows 7 Chromium 109
 * and fix customer loyalty modal contrast & input placeholder
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('====================================================');
console.log('  APPLYING UI CONTRAST & OPACITY BUG FIXES');
console.log('====================================================\n');

// 1. Patch production chunks (18yoqc7d05wnq.js)
const chunkFiles = [
  path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js'),
  path.resolve(__dirname, '../out/_next/static/chunks/18yoqc7d05wnq.js')
];

for (const cf of chunkFiles) {
  if (!fs.existsSync(cf)) continue;
  console.log(`>>> Patching JS chunk: ${path.relative(path.resolve(__dirname, '..'), cf)}`);
  let code = fs.readFileSync(cf, 'utf8');

  // Replace bracketed arbitrary opacity classes with standard Tailwind classes that have verified RGBA fallbacks
  code = code.replace(/bg-primary\/\[0\.06\]/g, 'bg-primary/10');
  code = code.replace(/bg-primary\/\[0\.07\]/g, 'bg-primary/10');
  code = code.replace(/bg-primary\/\[0\.08\]/g, 'bg-primary/10');
  code = code.replace(/bg-primary\/\[0\.05\]/g, 'bg-primary/5');
  code = code.replace(/hover:bg-primary\/\[0\.04\]/g, 'hover:bg-primary/5');

  // Fix loyalty input placeholder from ±نقاط to +10 / -5
  code = code.replace(/placeholder:"±نقاط"/g, 'placeholder:"+10 / -5"');

  // Verify syntax with vm.Script
  try {
    new vm.Script(code);
    console.log('[PASS] vm.Script compilation verified: 0 syntax errors.');
  } catch (err) {
    console.error(`[FATAL] Syntax error in ${cf}:`, err);
    process.exit(1);
  }

  fs.writeFileSync(cf, code, 'utf8');
  console.log(`[PASS] Saved patched JS chunk: ${cf}`);
}

// 2. Patch production CSS (3oa5e4nmj08il.css)
const cssFiles = [
  path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/client/_next/static/chunks/3oa5e4nmj08il.css'),
  path.resolve(__dirname, '../out/_next/static/chunks/3oa5e4nmj08il.css')
];

const cssRule = `
/* Chromium 109 / Windows 7 fallbacks for bracketed arbitrary opacity classes */
.bg-primary\\[0\\.04\\],.bg-primary\\[0\\.05\\],.bg-primary\\[0\\.06\\],.bg-primary\\[0\\.07\\],.bg-primary\\[0\\.08\\],
.bg-primary\\/\\[0\\.04\\],.bg-primary\\/\\[0\\.05\\],.bg-primary\\/\\[0\\.06\\],.bg-primary\\/\\[0\\.07\\],.bg-primary\\/\\[0\\.08\\] {
  background-color: rgba(var(--primary-rgb), 0.08) !important;
}
.hover\\:bg-primary\\/\\[0\\.04\\]:hover, .hover\\:bg-primary\\[0\\.04\\]:hover {
  background-color: rgba(var(--primary-rgb), 0.05) !important;
}
`;

for (const csf of cssFiles) {
  if (!fs.existsSync(csf)) continue;
  console.log(`>>> Patching CSS file: ${path.relative(path.resolve(__dirname, '..'), csf)}`);
  let css = fs.readFileSync(csf, 'utf8');
  if (!css.includes('rgba(var(--primary-rgb), 0.08)')) {
    css += '\n' + cssRule;
    fs.writeFileSync(csf, css, 'utf8');
    console.log(`[PASS] Appended bracketed opacity rules to: ${csf}`);
  } else {
    console.log(`[SKIP] Already contains bracketed opacity rules in: ${csf}`);
  }
}

// 3. Patch Source Files in Library Store and root workspace
const sourceFilesToPatch = [
  {
    path: path.resolve(__dirname, '../src/components/library/screens/customers.tsx'),
    replacements: [
      ['bg-primary/[0.06]', 'bg-primary/10'],
      ['bg-primary/[0.07]', 'bg-primary/10'],
      ['placeholder="±نقاط"', 'placeholder="+10 / -5"']
    ]
  },
  {
    path: path.resolve(__dirname, '../../src/components/library/screens/customers.tsx'),
    replacements: [
      ['bg-primary/[0.06]', 'bg-primary/10'],
      ['bg-primary/[0.07]', 'bg-primary/10'],
      ['placeholder="±نقاط"', 'placeholder="+10 / -5"']
    ]
  },
  {
    path: path.resolve(__dirname, '../src/components/library/parts/kit.tsx'),
    replacements: [
      ['hover:bg-primary/[0.04]', 'hover:bg-primary/5']
    ]
  },
  {
    path: path.resolve(__dirname, '../../src/components/library/parts/kit.tsx'),
    replacements: [
      ['hover:bg-primary/[0.04]', 'hover:bg-primary/5']
    ]
  },
  {
    path: path.resolve(__dirname, '../src/components/library/screens/pos.tsx'),
    replacements: [
      ['bg-primary/[0.06]', 'bg-primary/10']
    ]
  },
  {
    path: path.resolve(__dirname, '../../src/components/library/screens/pos.tsx'),
    replacements: [
      ['bg-primary/[0.06]', 'bg-primary/10']
    ]
  },
  {
    path: path.resolve(__dirname, '../src/components/library/screens/products.tsx'),
    replacements: [
      ['bg-primary/[0.08]', 'bg-primary/10']
    ]
  },
  {
    path: path.resolve(__dirname, '../../src/components/library/screens/products.tsx'),
    replacements: [
      ['bg-primary/[0.08]', 'bg-primary/10']
    ]
  },
  {
    path: path.resolve(__dirname, '../src/components/library/screens/settings.tsx'),
    replacements: [
      ['bg-primary/[0.05]', 'bg-primary/5']
    ]
  },
  {
    path: path.resolve(__dirname, '../../src/components/library/screens/settings.tsx'),
    replacements: [
      ['bg-primary/[0.05]', 'bg-primary/5']
    ]
  }
];

for (const item of sourceFilesToPatch) {
  if (!fs.existsSync(item.path)) continue;
  let src = fs.readFileSync(item.path, 'utf8');
  let changed = false;
  for (const [target, repl] of item.replacements) {
    if (src.includes(target)) {
      src = src.split(target).join(repl);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(item.path, src, 'utf8');
    console.log(`[PASS] Updated source file: ${item.path}`);
  }
}

// 4. Update globals.css in both workspaces
const globalCssFiles = [
  path.resolve(__dirname, '../src/app/globals.css'),
  path.resolve(__dirname, '../../src/app/globals.css')
];

for (const gcf of globalCssFiles) {
  if (!fs.existsSync(gcf)) continue;
  let gcss = fs.readFileSync(gcf, 'utf8');
  if (!gcss.includes('.bg-primary\\/\\[0\\.06\\]')) {
    gcss += '\n' + cssRule;
    fs.writeFileSync(gcf, gcss, 'utf8');
    console.log(`[PASS] Appended fallback rules to: ${gcf}`);
  }
}

console.log('\n[SUCCESS] All UI contrast and opacity fixes successfully applied.');
