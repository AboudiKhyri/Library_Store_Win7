const fs = require('fs');
const path = require('path');

console.log('=== APPLYING LBC FONT AS THE PRIMARY SYSTEM FONT ===\n');

const fontSource = path.resolve(__dirname, '../../LBC.otf');
if (!fs.existsSync(fontSource)) {
  console.error('Source font not found at:', fontSource);
  process.exit(1);
}

const fontTargets = [
  path.resolve(__dirname, '../../public/fonts/LBC.otf'),
  path.resolve(__dirname, '../public/fonts/LBC.otf'),
  path.resolve(__dirname, '../out/fonts/LBC.otf'),
  path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/client/fonts/LBC.otf'),
];

fontTargets.forEach(target => {
  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.copyFileSync(fontSource, target);
  console.log('✓ Copied LBC.otf to:', target);
});

// 2. CSS font-face declaration
const fontFaceCss = `
/* Primary Arabic Brand Font — LBC */
@font-face {
  font-family: 'LBC';
  src: url('/fonts/LBC.otf') format('opentype');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

html, body, button, input, select, textarea, [data-slot] {
  font-family: 'LBC', var(--font-cairo), "Segoe UI", Tahoma, "Noto Sans Arabic", sans-serif;
}

code, kbd, samp, pre, .font-mono, [dir="ltr"].font-mono, .tabular-nums {
  font-family: var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
}
`;

// 3. Update globals.css in both workspaces
const globalsFiles = [
  path.resolve(__dirname, '../../src/app/globals.css'),
  path.resolve(__dirname, '../src/app/globals.css'),
];

globalsFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // Update --font-sans in @theme inline
  content = content.replace(
    /--font-sans:\s*[^;]+;/g,
    `--font-sans: 'LBC', var(--font-cairo), "Segoe UI", Tahoma, "Noto Sans Arabic", sans-serif;`
  );

  // Append font-face if not present
  if (!content.includes(`font-family: 'LBC'`)) {
    content += '\n' + fontFaceCss;
  }

  fs.writeFileSync(file, content, 'utf8');
  console.log('✓ Injected LBC font-face into:', file);
});

// 4. Update compiled client CSS in out and dist-desktop
const compiledCssFiles = [
  path.resolve(__dirname, '../out/_next/static/chunks/3oa5e4nmj08il.css'),
  path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/client/_next/static/chunks/3oa5e4nmj08il.css'),
];

compiledCssFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // Prepend or append LBC font-face
  if (!content.includes(`font-family:'LBC'`) && !content.includes(`font-family: 'LBC'`)) {
    content = fontFaceCss + '\n' + content;
    // Also replace default font-sans variable
    content = content.replace(
      /--font-sans:[^;]+;/g,
      `--font-sans:'LBC', var(--font-cairo), "Segoe UI", Tahoma, "Noto Sans Arabic", sans-serif;`
    );
    fs.writeFileSync(file, content, 'utf8');
    console.log('✓ Injected LBC font-face into compiled CSS:', file);
  } else {
    console.log('  LBC font already present in:', file);
  }
});

console.log('\n=== LBC FONT SUCCESSFULLY APPLIED ===');
