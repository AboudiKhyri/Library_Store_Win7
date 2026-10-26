/**
 * scripts/patch-remove-sidebar-date-logo.cjs
 * Removes the logo next to the sidebar dynamic date in src/, out/, and dist-desktop/.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
console.log('=== REMOVING LOGO NEXT TO SIDEBAR DATE ===');

// 1. Edit src/components/library/app.tsx
const appTsxPath = path.join(root, 'src/components/library/app.tsx');
let appTsx = fs.readFileSync(appTsxPath, 'utf8');

const targetLogoTag = '<Image src="/logo.png" alt="" width={18} height={18} className="rounded object-contain" />';
if (appTsx.includes(targetLogoTag)) {
  // Remove the tag and surrounding whitespace if appropriate
  appTsx = appTsx.replace(/\s*<Image src="\/logo\.png" alt="" width=\{18\} height=\{18\} className="rounded object-contain" \/>/, '');
  fs.writeFileSync(appTsxPath, appTsx, 'utf8');
  console.log('✓ Removed date logo from src/components/library/app.tsx');
} else {
  console.log('ℹ Logo tag already absent in src/components/library/app.tsx');
}

// 2. Patch out/_next/static/chunks/18yoqc7d05wnq.js
const outChunkPath = path.join(root, 'out/_next/static/chunks/18yoqc7d05wnq.js');
let chunkContent = fs.readFileSync(outChunkPath, 'utf8');

const chunkTarget = 'children:[(0,N.jsx)(S.default,{src:"/logo.png",alt:"",width:18,height:18,className:"rounded object-contain"}),!e&&(0,N.jsx)("span",{className:"truncate",children:_dt})]';
const chunkReplacement = 'children:[!e&&(0,N.jsx)("span",{className:"truncate",children:_dt})]';

if (chunkContent.includes(chunkTarget)) {
  chunkContent = chunkContent.replace(chunkTarget, chunkReplacement);
  fs.writeFileSync(outChunkPath, chunkContent, 'utf8');
  console.log('✓ Patched out/_next/static/chunks/18yoqc7d05wnq.js');
} else if (chunkContent.includes(chunkReplacement)) {
  console.log('ℹ out chunk already patched');
} else {
  throw new Error('Target string not found in ' + outChunkPath);
}

// 3. Mirror patched chunk to dist-desktop targets
const targets = [
  path.join(root, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(root, 'dist-desktop/win-unpacked/resources/out/_next/static/chunks/18yoqc7d05wnq.js')
];

for (const dest of targets) {
  if (fs.existsSync(path.dirname(dest))) {
    fs.copyFileSync(outChunkPath, dest);
    console.log(`✓ Copied patched chunk to ${dest}`);
  }
}

// 4. Assert that width:18,height:18 no longer exists anywhere in chunks
function assertNoDateLogo(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) {
      assertNoDateLogo(full);
    } else if (f.name.endsWith('.js') || f.name.endsWith('.tsx')) {
      const c = fs.readFileSync(full, 'utf8');
      assert(!c.includes('width:18,height:18') && !c.includes('width={18} height={18}'), `Date logo still found in ${full}`);
    }
  }
}

assertNoDateLogo(path.join(root, 'out/_next/static/chunks'));
assertNoDateLogo(path.join(root, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks'));
assertNoDateLogo(path.join(root, 'dist-desktop/win-unpacked/resources/out/_next/static/chunks'));
assert(!fs.readFileSync(appTsxPath, 'utf8').includes('width={18} height={18}'), 'Date logo still found in src/components/library/app.tsx');

console.log('=== LOGO REMOVED AND VERIFIED ACROSS ALL TARGETS ===');
