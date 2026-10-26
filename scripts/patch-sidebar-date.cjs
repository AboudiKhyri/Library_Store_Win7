/**
 * scripts/patch-sidebar-date.cjs
 * Patches the compiled Next.js bundle to:
 * 1. Replace "Library Store Offline" with today's real dynamic date (refreshed every 60s, localized ar/en).
 * 2. Bind the sidebar header to branding settings (appName / tagline) with fallbacks.
 *
 * Must be idempotent and fail loudly (non-zero exit code) if targets are not found.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const chunkPath = path.join(root, 'out/_next/static/chunks/18yoqc7d05wnq.js');

if (!fs.existsSync(chunkPath)) {
  console.error(`[ERROR] Target chunk file not found: ${chunkPath}`);
  process.exit(1);
}

let code = fs.readFileSync(chunkPath, 'utf8');

// Idempotency check: if already patched, exit cleanly with 0
if (code.includes('FDate') && code.includes('a?.branding?.appName||"Library Store"') && !code.includes('Library Store Offline')) {
  console.log('[INFO] Chunk is already patched with dynamic sidebar date & branding. Nothing to do.');
  process.exit(0);
}

const targetFooter = '!e&&(0,N.jsx)("span",{children:"Library Store Offline"})';
const targetHeader = 'children:[(0,N.jsx)("p",{className:"text-sm font-extrabold tracking-wide",children:"Library Store"}),(0,N.jsx)("p",{className:"text-[10px] text-muted-foreground",children:"نظام إدارة المتاجر"})]';
const targetD4 = 'function D4({collapsed:e,sections:t,view:r,onSelect:n,status:a}){let i=L(e=>e.t);';

if (!code.includes(targetFooter)) {
  console.error(`[FATAL] Target footer string not found in ${chunkPath}: ${targetFooter}`);
  process.exit(1);
}

if (!code.includes(targetHeader)) {
  console.error(`[FATAL] Target header string not found in ${chunkPath}: ${targetHeader}`);
  process.exit(1);
}

if (!code.includes(targetD4)) {
  console.error(`[FATAL] Target D4 function header not found in ${chunkPath}: ${targetD4}`);
  process.exit(1);
}

// 1. Inject FDate helper and D4 hooks
const newD4 = 'function FDate(l){try{let n=new Date;return"en"===l?new Intl.DateTimeFormat("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"}).format(n):new Intl.DateTimeFormat("ar-u-nu-latn",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(n).replace("،","")}catch{return(new Date).toLocaleDateString("en"===l?"en-US":"ar-EG")}}function D4({collapsed:e,sections:t,view:r,onSelect:n,status:a}){let i=L(e=>e.t),_lng=L(e=>e.lang),[_dt,_sdt]=(0,k.useState)(()=>FDate(_lng));(0,k.useEffect)(()=>{_sdt(FDate(_lng));let _tm=setInterval(()=>_sdt(FDate(_lng)),6e4);return()=>clearInterval(_tm)},[_lng]);';
code = code.replace(targetD4, newD4);

// 2. Bind header to branding settings with fallbacks
const newHeader = 'children:[(0,N.jsx)("p",{className:"text-sm font-extrabold tracking-wide",children:a?.branding?.appName||"Library Store"}),(0,N.jsx)("p",{className:"text-[10px] text-muted-foreground",children:a?.branding?.tagline||"نظام إدارة المتاجر"})]';
code = code.replace(targetHeader, newHeader);

// 3. Replace footer "Library Store Offline" with dynamic date
const newFooter = '!e&&(0,N.jsx)("span",{className:"truncate",children:_dt})';
code = code.replace(targetFooter, newFooter);

fs.writeFileSync(chunkPath, code, 'utf8');
console.log(`✓ Successfully patched ${chunkPath}`);

// 4. Validate JS syntax of patched chunk
try {
  execSync(`"${process.execPath}" -c "${chunkPath}"`, { stdio: 'pipe' });
  console.log('✓ Syntax check passed for patched chunk');
} catch (err) {
  console.error('[FATAL] Syntax check failed on patched chunk:', err.message);
  process.exit(1);
}

// 5. Check if 0yfs-ujhus7x4.js exists and if it needs any patch
const altChunk = path.join(root, 'out/_next/static/chunks/0yfs-ujhus7x4.js');
if (fs.existsSync(altChunk)) {
  let altCode = fs.readFileSync(altChunk, 'utf8');
  if (altCode.includes(targetFooter)) {
    altCode = altCode.replace(targetFooter, newFooter);
    fs.writeFileSync(altChunk, altCode, 'utf8');
    console.log(`✓ Also patched ${altChunk}`);
  }
}

// 6. Copy modified out/ to dist-desktop targets (both resources/out/ and resources/client/)
const distOut = path.join(root, 'dist-desktop/win-unpacked/resources/out');
const distClient = path.join(root, 'dist-desktop/win-unpacked/resources/client');
const outDir = path.join(root, 'out');

if (!fs.existsSync(distOut)) {
  fs.mkdirSync(distOut, { recursive: true });
}
fs.cpSync(outDir, distOut, { recursive: true });
console.log(`✓ Synchronized out/ to ${distOut}`);

if (fs.existsSync(distClient)) {
  fs.cpSync(outDir, distClient, { recursive: true });
  console.log(`✓ Synchronized out/ to ${distClient}`);
}

console.log('=== SIDEBAR DATE & BRANDING PATCH COMPLETE ===');
