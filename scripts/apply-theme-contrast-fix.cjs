const fs = require('fs');
const path = require('path');
const vm = require('vm');

const baseDir = path.resolve(__dirname, '..');

// 1. Update src/components/library/parts/permanent-delete-dialog.tsx
const srcFile = path.join(baseDir, 'src/components/library/parts/permanent-delete-dialog.tsx');
if (fs.existsSync(srcFile)) {
  let content = fs.readFileSync(srcFile, 'utf8');

  content = content.replace(
    'sm:max-w-md bg-[#131b26] border-[#223041] text-foreground p-0 overflow-hidden shadow-2xl',
    'sm:max-w-md p-0 overflow-hidden shadow-2xl'
  );

  content = content.replace(
    'p-5 pb-4 border-b border-[#223041]',
    'p-5 pb-4 border-b border-border'
  );

  content = content.replace(
    'flex items-start gap-3 rounded-lg border border-[#223041] p-3.5 bg-[#0e141c]',
    'flex items-start gap-3 rounded-lg border border-border p-3.5 bg-muted/40 transition-colors'
  );

  content = content.replace(
    'bg-muted/50 border-t border-border',
    'bg-muted/30 border-t border-border'
  );

  // Remove duplicate variant props if present
  content = content.replace('variant="outline"\r\n            variant="outline"', 'variant="outline"');
  content = content.replace('variant="outline"\n            variant="outline"', 'variant="outline"');
  content = content.replace('variant="destructive"\r\n            variant="destructive"', 'variant="destructive"');
  content = content.replace('variant="destructive"\n            variant="destructive"', 'variant="destructive"');

  fs.writeFileSync(srcFile, content, 'utf8');
  console.log('✓ Successfully patched permanent-delete-dialog.tsx');
} else {
  console.error('✗ Could not find srcFile:', srcFile);
}

// 2. Update compiled chunks
const chunkFiles = [
  path.join(baseDir, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(baseDir, 'out/_next/static/chunks/18yoqc7d05wnq.js')
];

for (const chunkPath of chunkFiles) {
  if (!fs.existsSync(chunkPath)) {
    console.log('- Chunk file does not exist, skipping:', chunkPath);
    continue;
  }

  let code = fs.readFileSync(chunkPath, 'utf8');
  const targetSnippet = 'className:"sm:max-w-md bg-[#131b26] border-[#223041] text-foreground p-0 overflow-hidden shadow-2xl"';

  if (!code.includes(targetSnippet)) {
    console.log('? Snippet not found or already patched in:', chunkPath);
    continue;
  }

  // Replace DialogContent classes
  code = code.replace(
    'className:"sm:max-w-md bg-[#131b26] border-[#223041] text-foreground p-0 overflow-hidden shadow-2xl"',
    'className:"sm:max-w-md p-0 overflow-hidden shadow-2xl"'
  );

  // Replace DialogHeader classes
  code = code.replace(
    'className:"p-5 pb-4 border-b border-[#223041]"',
    'className:"p-5 pb-4 border-b border-border"'
  );

  // Replace checkbox card classes
  code = code.replace(
    'className:"flex items-start gap-3 rounded-lg border border-[#223041] p-3.5 bg-[#0e141c]"',
    'className:"flex items-start gap-3 rounded-lg border border-border p-3.5 bg-muted/40 transition-colors"'
  );

  // Replace footer classes and hardcoded dark buttons
  code = code.replace(
    'className:"p-4 px-5 bg-[#0e141c] border-t border-[#223041] gap-2 sm:gap-2 justify-end",children:[(0,N.jsx)(F.Button,{variant:"outline",className:"border-gray-700 bg-transparent text-gray-300 hover:bg-gray-800 hover:text-white"',
    'className:"p-4 px-5 bg-muted/30 border-t border-border gap-2 sm:gap-2 justify-end",children:[(0,N.jsx)(F.Button,{variant:"outline"'
  );

  // In case the confirm button has hardcoded shadow/colors or standard:
  code = code.replace(
    'className:"bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md shadow-red-600/30",onClick:c,disabled:l,children:l?"جارٍ الحذف النهائي...":"تأكيد الحذف النهائي"',
    'onClick:c,disabled:l,children:l?"جارٍ الحذف النهائي...":"تأكيد الحذف النهائي"'
  );

  // Validate syntax
  try {
    new vm.Script(code);
    fs.writeFileSync(chunkPath, code, 'utf8');
    console.log('✓ Successfully validated and patched chunk:', path.basename(chunkPath), 'at', chunkPath);
  } catch (err) {
    console.error('✗ Syntax validation failed for chunk:', chunkPath, err);
  }
}

console.log('--- Theme Contrast Fix script completed ---');
