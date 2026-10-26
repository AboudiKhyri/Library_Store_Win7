/**
 * scripts/patch-remove-header-duplicate-branding.cjs
 * Removes the duplicate header logo + store name from the top header bar,
 * keeping the branding only on the right sidebar header as requested.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
console.log('=== REMOVING DUPLICATE HEADER BRANDING ===');

// 1. Edit src/components/library/app.tsx
const appTsxPath = path.join(root, 'src/components/library/app.tsx');
let appTsx = fs.readFileSync(appTsxPath, 'utf8');

const targetHeaderBlock = `          <div className="flex min-w-0 items-center gap-2">
            {status?.branding?.logoDataUrl ? (
              <img src={status?.branding?.logoDataUrl} alt={displayName} className="h-8 w-8 rounded-lg object-contain" />
            ) : (
              <Image src="/logo.png" alt="Library Store" width={32} height={32} className="rounded-lg object-contain" />
            )}
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-bold">{displayName}</p>
              <p className="truncate text-[11px] text-muted-foreground">{appName}</p>
            </div>
          </div>`;

const targetNorm = targetHeaderBlock.replace(/\r\n/g, '\n');
const appTsxNorm = appTsx.replace(/\r\n/g, '\n');

if (appTsxNorm.includes(targetNorm)) {
  const isCrlf = appTsx.includes('\r\n');
  const replaced = appTsxNorm.replace(targetNorm, '');
  appTsx = isCrlf ? replaced.replace(/\n/g, '\r\n') : replaced;
  fs.writeFileSync(appTsxPath, appTsx, 'utf8');
  console.log('✓ Removed duplicate header branding from src/components/library/app.tsx');
} else {
  console.log('ℹ Duplicate header branding already removed from src/components/library/app.tsx');
}

// Ensure the sidebar header in src/ is intact
assert(appTsx.includes('SidebarContent'), 'SidebarContent must remain in app.tsx');
assert(appTsx.includes('width={28} height={28}'), 'Sidebar logo (width=28) must remain in app.tsx');
assert(appTsx.includes('text-sm font-extrabold tracking-wide'), 'Sidebar title must remain in app.tsx');
console.log('✓ Verified right-hand sidebar branding remains intact in src/components/library/app.tsx');

// 2. Patch out/_next/static/chunks/18yoqc7d05wnq.js
const outChunkPath = path.join(root, 'out/_next/static/chunks/18yoqc7d05wnq.js');
let chunkContent = fs.readFileSync(outChunkPath, 'utf8');

const chunkTarget = ',(0,N.jsxs)("div",{className:"flex min-w-0 items-center gap-2",children:[e?.branding?.logoDataUrl?(0,N.jsx)("img",{src:e?.branding?.logoDataUrl,alt:b,className:"h-8 w-8 rounded-lg object-contain"}):(0,N.jsx)(S.default,{src:"/logo.png",alt:"Library Store",width:32,height:32,className:"rounded-lg object-contain"}),(0,N.jsxs)("div",{className:"min-w-0 leading-tight",children:[(0,N.jsx)("p",{className:"truncate text-sm font-bold",children:b}),(0,N.jsx)("p",{className:"truncate text-[11px] text-muted-foreground",children:j})]})]})';

if (chunkContent.includes(chunkTarget)) {
  chunkContent = chunkContent.replace(chunkTarget, '');
  fs.writeFileSync(outChunkPath, chunkContent, 'utf8');
  console.log('✓ Removed duplicate header branding from out/_next/static/chunks/18yoqc7d05wnq.js');
} else {
  console.log('ℹ Duplicate header branding already removed or not found in chunk');
}

// Verify that the sidebar header with width:28,height:28 is still in the chunk
assert(chunkContent.includes('width:28,height:28'), 'Sidebar logo (width:28,height:28) must remain in chunk');
console.log('✓ Verified right-hand sidebar branding remains intact in chunk');

// 3. Mirror to dist-desktop
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

console.log('=== DUPLICATE HEADER BRANDING REMOVAL COMPLETE ===');
