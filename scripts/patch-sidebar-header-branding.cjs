/**
 * scripts/patch-sidebar-header-branding.cjs
 *
 * Patches:
 * 1. src/components/library/app.tsx:
 *    - Sidebar top header binds to status?.business?.displayName || status?.branding?.appName || 'Library Store'
 *    - Sidebar subtitle binds to status?.business?.businessName || status?.branding?.tagline || 'نظام إدارة المتاجر'
 * 2. src/components/library/screens/settings.tsx:
 *    - Automatically calls refreshStatus() on saving 'business' settings so the sidebar header updates immediately
 * 3. out/_next/static/chunks/18yoqc7d05wnq.js:
 *    - Top header: a?.business?.displayName||a?.branding?.appName||"Library Store"
 *    - Subtitle: a?.business?.businessName||a?.branding?.tagline||"نظام إدارة المتاجر"
 *    - Settings save hook: ("business"===t||"branding"===t||"localization"===t||"pos"===t)&&(await i(),
 * 4. Sync out/ to dist-desktop/win-unpacked/resources/out and resources/client
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');

console.log('=== PATCHING SIDEBAR HEADER BRANDING & DYNAMIC BINDINGS ===\n');

// 1. Update src/components/library/app.tsx
const appSrcPath = path.join(root, 'src/components/library/app.tsx');
if (fs.existsSync(appSrcPath)) {
  let appSrc = fs.readFileSync(appSrcPath, 'utf8');

  const oldTopHeader = "{status?.branding?.appName || 'Library Store'}";
  const newTopHeader = "{status?.business?.displayName || status?.branding?.appName || 'Library Store'}";

  const oldSubHeader = "{(status?.branding as any)?.tagline || 'نظام إدارة المتاجر'}";
  const newSubHeader = "{status?.business?.businessName || (status?.branding as any)?.tagline || (lang === 'ar' ? 'نظام إدارة المتاجر' : 'Library Store')}";

  let appChanged = false;
  if (appSrc.includes(oldTopHeader)) {
    appSrc = appSrc.replace(oldTopHeader, newTopHeader);
    appChanged = true;
  }
  if (appSrc.includes(oldSubHeader)) {
    appSrc = appSrc.replace(oldSubHeader, newSubHeader);
    appChanged = true;
  }

  if (appChanged) {
    fs.writeFileSync(appSrcPath, appSrc, 'utf8');
    console.log('✓ Updated src/components/library/app.tsx');
  } else if (appSrc.includes(newTopHeader) && appSrc.includes(newSubHeader)) {
    console.log('✓ src/components/library/app.tsx already has new bindings');
  } else {
    console.warn('! Warning: Target strings not found in app.tsx, checking current contents...');
  }
}

// 2. Update src/components/library/screens/settings.tsx
const settingsSrcPath = path.join(root, 'src/components/library/screens/settings.tsx');
if (fs.existsSync(settingsSrcPath)) {
  let settingsSrc = fs.readFileSync(settingsSrcPath, 'utf8');
  const oldCondition = "if (key === 'branding' || key === 'localization' || key === 'pos') {";
  const newCondition = "if (key === 'business' || key === 'branding' || key === 'localization' || key === 'pos') {";

  if (settingsSrc.includes(oldCondition)) {
    settingsSrc = settingsSrc.replace(oldCondition, newCondition);
    fs.writeFileSync(settingsSrcPath, settingsSrc, 'utf8');
    console.log('✓ Updated src/components/library/screens/settings.tsx (refreshStatus on business save)');
  } else if (settingsSrc.includes(newCondition)) {
    console.log('✓ src/components/library/screens/settings.tsx already updated');
  }
}

// 3. Update out/_next/static/chunks/18yoqc7d05wnq.js
const chunkPath = path.join(root, 'out/_next/static/chunks/18yoqc7d05wnq.js');
if (!fs.existsSync(chunkPath)) {
  console.error(`[FATAL] Target chunk file not found: ${chunkPath}`);
  process.exit(1);
}

let chunkCode = fs.readFileSync(chunkPath, 'utf8');

const oldHeaderTarget = 'children:[(0,N.jsx)("p",{className:"text-sm font-extrabold tracking-wide",children:a?.branding?.appName||"Library Store"}),(0,N.jsx)("p",{className:"text-[10px] text-muted-foreground",children:a?.branding?.tagline||"نظام إدارة المتاجر"})]';
const newHeaderTarget = 'children:[(0,N.jsx)("p",{className:"text-sm font-extrabold tracking-wide",children:a?.business?.displayName||a?.branding?.appName||"Library Store"}),(0,N.jsx)("p",{className:"text-[10px] text-muted-foreground",children:a?.business?.businessName||a?.branding?.tagline||"نظام إدارة المتاجر"})]';

const oldSettingsSaveTarget = '("branding"===t||"localization"===t||"pos"===t)&&(await i(),';
const newSettingsSaveTarget = '("business"===t||"branding"===t||"localization"===t||"pos"===t)&&(await i(),';

let chunkModified = false;

if (chunkCode.includes(oldHeaderTarget)) {
  chunkCode = chunkCode.replace(oldHeaderTarget, newHeaderTarget);
  chunkModified = true;
  console.log('✓ Replaced sidebar header bindings in 18yoqc7d05wnq.js');
} else if (chunkCode.includes(newHeaderTarget)) {
  console.log('✓ 18yoqc7d05wnq.js already has new sidebar header bindings');
} else {
  console.error('[FATAL] Target header code not found in 18yoqc7d05wnq.js!');
  process.exit(1);
}

if (chunkCode.includes(oldSettingsSaveTarget)) {
  chunkCode = chunkCode.replace(oldSettingsSaveTarget, newSettingsSaveTarget);
  chunkModified = true;
  console.log('✓ Replaced settings save refresh trigger in 18yoqc7d05wnq.js');
} else if (chunkCode.includes(newSettingsSaveTarget)) {
  console.log('✓ 18yoqc7d05wnq.js already has settings save refresh trigger');
}

if (chunkModified) {
  fs.writeFileSync(chunkPath, chunkCode, 'utf8');
  console.log(`✓ Saved patched ${chunkPath}`);
}

// 4. Validate syntax of patched chunk
try {
  execSync(`"${process.execPath}" -c "${chunkPath}"`, { stdio: 'pipe' });
  console.log('✓ Syntax check passed for patched chunk');
} catch (err) {
  console.error('[FATAL] Syntax check failed on patched chunk:', err.message);
  process.exit(1);
}

// 5. Sync out/ to dist-desktop targets
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

console.log('\n=== SIDEBAR HEADER BRANDING PATCH APPLIED SUCCESSFULLY ===');
