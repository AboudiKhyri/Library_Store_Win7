/**
 * scripts/patch-simple-progress-bar.cjs
 *
 * Replaces the animated SVG fluid spinner with the clean, distortion-free
 * horizontal progress bar matching media_1792953164603_0383cf8a.png.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');

console.log('=== APPLYING SIMPLE HORIZONTAL PROGRESS BAR PATCH ===\n');

// 1. Update desktop/engine/main/window-manager.js
const wmPath = path.join(root, 'desktop/engine/main/window-manager.js');
let wmCode = fs.readFileSync(wmPath, 'utf8');

const oldWmSpinnerCss = `    .logo-container {
      position: relative;
      width: 68px;
      height: 68px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .custom-spinner {
      width: 64px;
      height: 64px;
      animation: library-spinner-spin 1.25s linear infinite;
      filter: drop-shadow(0 0 8px rgba(0, 210, 255, 0.55));
      transform-origin: center;
    }
    .spinner-arc {
      animation: library-spinner-arc 1.25s ease-in-out infinite;
      transform-origin: center;
    }
    .spinner-pill1 {
      animation: library-spinner-pill1 1.25s ease-in-out infinite;
      transform-origin: 24px 24px;
    }
    .spinner-pill2 {
      animation: library-spinner-pill2 1.25s ease-in-out infinite;
      transform-origin: 24px 24px;
    }
    @keyframes library-spinner-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes library-spinner-arc {
      0% { stroke-dasharray: 74 107; stroke-dashoffset: 0; }
      50% { stroke-dasharray: 56 107; stroke-dashoffset: -10; }
      100% { stroke-dasharray: 74 107; stroke-dashoffset: -20; }
    }
    @keyframes library-spinner-pill1 {
      0%, 100% { transform: rotate(0deg); opacity: 0.95; }
      50% { transform: rotate(-16deg); opacity: 0.6; }
    }
    @keyframes library-spinner-pill2 {
      0%, 100% { transform: rotate(0deg); opacity: 0.9; }
      50% { transform: rotate(18deg); opacity: 1; }
    }`;

const newWmProgressCss = `    .progress-bar-track {
      width: 246px;
      height: 20px;
      border: 1.5px solid #0078d7;
      background: #f1f5f9;
      border-radius: 4px;
      overflow: hidden;
      position: relative;
      margin: 20px auto 8px;
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.08);
    }
    .progress-bar-fill {
      position: absolute;
      top: 0;
      bottom: 0;
      background: #0078d7;
      border-radius: 2px;
      animation: progress-slide 1.5s ease-in-out infinite;
    }
    @keyframes progress-slide {
      0% { left: -40%; width: 40%; }
      50% { left: 25%; width: 55%; }
      100% { left: 100%; width: 40%; }
    }
    .progress-bar-label {
      font-size: 13px;
      font-weight: 600;
      color: #e7eef7;
      margin-bottom: 12px;
    }`;

const oldWmHtml = `    <div class="logo-container">
      <svg class="custom-spinner" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="splash-spinner-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#00d2ff" />
            <stop offset="100%" stop-color="#2563eb" />
          </linearGradient>
        </defs>
        <circle fill="none" cx="24" cy="24" r="17" stroke="url(#splash-spinner-grad)" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="74 107" stroke-dashoffset="0" class="spinner-arc" />
        <circle fill="none" cx="24" cy="24" r="17" stroke="#00d2ff" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="6 107" stroke-dashoffset="-83" class="spinner-pill1" />
        <circle fill="none" cx="24" cy="24" r="17" stroke="#00d2ff" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="4 107" stroke-dashoffset="-95" class="spinner-pill2" />
      </svg>
    </div>
    <h1>\${this.config.productNameAr}</h1>
    <div class="status">جاري تشغيل النظام والاتصال بقاعدة البيانات...</div>
    <div class="hint">برجاء الانتظار لحظات، يتم تجهيز بيئة التشغيل المحلية</div>`;

const newWmHtml = `    <h1>\${this.config.productNameAr}</h1>
    <div class="progress-bar-track">
      <div class="progress-bar-fill"></div>
    </div>
    <div class="progress-bar-label">جاري التحميل</div>
    <div class="status">جاري تشغيل النظام والاتصال بقاعدة البيانات...</div>
    <div class="hint">برجاء الانتظار لحظات، يتم تجهيز بيئة التشغيل المحلية</div>`;

function normalize(s) {
  return s.replace(/\r\n/g, '\n');
}

let normWm = normalize(wmCode);
if (normWm.includes(normalize(oldWmSpinnerCss))) {
  normWm = normWm.replace(normalize(oldWmSpinnerCss), normalize(newWmProgressCss));
  console.log('✓ Updated CSS in window-manager.js');
}
if (normWm.includes(normalize(oldWmHtml))) {
  normWm = normWm.replace(normalize(oldWmHtml), normalize(newWmHtml));
  console.log('✓ Updated HTML in window-manager.js');
}

const finalWm = wmCode.includes('\r\n') ? normWm.replace(/\n/g, '\r\n') : normWm;
fs.writeFileSync(wmPath, finalWm, 'utf8');
console.log('✓ Saved desktop/engine/main/window-manager.js');

// 2. Update src/components/library/app.tsx
const appPath = path.join(root, 'src/components/library/app.tsx');
let appCode = fs.readFileSync(appPath, 'utf8');

const oldAppSplash = `<div className="mt-2 flex items-center gap-2 text-xs text-primary">
          <Spinner size="sm" />
          <span>جاري تهيئة النظام...</span>
        </div>`;

const newAppSplash = `<div className="mt-4 flex flex-col items-center gap-2">
          <div className="h-[20px] w-[246px] rounded-[4px] border-[1.5px] border-[#0078d7] dark:border-primary/80 bg-[#f1f5f9] dark:bg-muted/40 overflow-hidden relative shadow-inner">
            <div className="absolute top-0 bottom-0 bg-[#0078d7] dark:bg-primary rounded-[2px] animate-simple-progress" />
          </div>
          <span className="text-xs font-semibold text-primary">جاري التحميل...</span>
        </div>`;

let normApp = normalize(appCode);
if (normApp.includes(normalize(oldAppSplash))) {
  normApp = normApp.replace(normalize(oldAppSplash), normalize(newAppSplash));
  const finalApp = appCode.includes('\r\n') ? normApp.replace(/\n/g, '\r\n') : normApp;
  fs.writeFileSync(appPath, finalApp, 'utf8');
  console.log('✓ Updated SplashScreen in src/components/library/app.tsx');
}

// 3. Update CSS bundles
const cssFiles = [
  path.join(root, 'out/_next/static/chunks/3oa5e4nmj08il.css'),
  path.join(root, 'dist-desktop/win-unpacked/resources/out/_next/static/chunks/3oa5e4nmj08il.css'),
  path.join(root, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/3oa5e4nmj08il.css')
];

const simpleProgressCssRule = '\n@keyframes simple-progress-sweep{0%{left:-40%;width:40%}50%{left:25%;width:55%}100%{left:100%;width:40%}}\n.animate-simple-progress{animation:simple-progress-sweep 1.5s ease-in-out infinite}\n';

for (const p of cssFiles) {
  if (fs.existsSync(p)) {
    let css = fs.readFileSync(p, 'utf8');
    if (!css.includes('animate-simple-progress')) {
      css += simpleProgressCssRule;
      fs.writeFileSync(p, css, 'utf8');
      console.log(`✓ Appended simple progress animation to ${path.basename(p)}`);
    } else {
      console.log(`✓ ${path.basename(p)} already has simple progress animation`);
    }
  }
}

// 4. Update JS chunks
const chunkFiles = [
  path.join(root, 'out/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(root, 'dist-desktop/win-unpacked/resources/out/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(root, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js')
];

const tLoadingBlock = '(0,N.jsxs)("div",{className:"flex flex-col items-center justify-center p-8 space-y-3 min-h-[220px]",role:"status","aria-busy":"true","aria-label":t??"جاري التحميل...",children:[(0,N.jsx)("div",{className:"relative h-12 w-12 shrink-0",children:(0,N.jsxs)("svg",{viewBox:"0 0 48 48",fill:"none",className:"h-full w-full animate-library-spin",style:{filter:"drop-shadow(0 0 6px var(--spinner-glow, rgba(2,132,199,0.28)))"},children:[(0,N.jsx)("defs",{children:(0,N.jsxs)("linearGradient",{id:"library-loadingblock-grad",x1:"0%",y1:"0%",x2:"100%",y2:"100%",children:[(0,N.jsx)("stop",{offset:"0%",stopColor:"var(--spinner-from,#0284c7)"}),(0,N.jsx)("stop",{offset:"100%",stopColor:"var(--spinner-to,#1d4ed8)"})]})}),(0,N.jsx)("circle",{fill:"none",cx:"24",cy:"24",r:"17",stroke:"url(#library-loadingblock-grad)",strokeWidth:"4.5",strokeLinecap:"round",strokeDasharray:"74 107",strokeDashoffset:"0",className:"animate-library-arc"}),(0,N.jsx)("circle",{fill:"none",cx:"24",cy:"24",r:"17",stroke:"var(--spinner-from,#0284c7)",strokeWidth:"4.5",strokeLinecap:"round",strokeDasharray:"6 107",strokeDashoffset:"-83",className:"animate-library-pill1"}),(0,N.jsx)("circle",{fill:"none",cx:"24",cy:"24",r:"17",stroke:"var(--spinner-from,#0284c7)",strokeWidth:"4.5",strokeLinecap:"round",strokeDasharray:"4 107",strokeDashoffset:"-95",className:"animate-library-pill2"})]})}),(0,N.jsx)("span",{className:"text-xs font-medium text-muted-foreground",children:t??"جاري التحميل..."})]';

const newLoadingBlock = '(0,N.jsxs)("div",{className:"flex flex-col items-center justify-center p-8 space-y-2 min-h-[220px]",role:"status","aria-busy":"true","aria-label":t??"جاري التحميل",children:[(0,N.jsx)("div",{className:"w-[246px] h-[20px] rounded-[4px] border-[1.5px] border-[#0078d7] dark:border-primary bg-[#f1f5f9] dark:bg-muted/40 overflow-hidden relative shadow-inner",children:(0,N.jsx)("div",{className:"absolute top-0 bottom-0 bg-[#0078d7] dark:bg-primary rounded-[2px] animate-simple-progress"})}),(0,N.jsx)("p",{className:"mt-2 text-sm font-semibold text-foreground",children:t??"جاري التحميل"})]';

const tLoginSvg = '(0,N.jsx)("div",{className:"me-2 inline-flex h-4 w-4 shrink-0",children:(0,N.jsxs)("svg",{viewBox:"0 0 48 48",fill:"none",className:"h-full w-full animate-library-spin",style:{filter:"drop-shadow(0 0 4px var(--spinner-glow, rgba(2,132,199,0.28)))"},children:[(0,N.jsx)("defs",{children:(0,N.jsxs)("linearGradient",{id:"login-spinner-grad",x1:"0%",y1:"0%",x2:"100%",y2:"100%",children:[(0,N.jsx)("stop",{offset:"0%",stopColor:"var(--spinner-from,#0284c7)"}),(0,N.jsx)("stop",{offset:"100%",stopColor:"var(--spinner-to,#1d4ed8)"})]})}),(0,N.jsx)("circle",{fill:"none",cx:"24",cy:"24",r:"17",stroke:"url(#login-spinner-grad)",strokeWidth:"4.5",strokeLinecap:"round",strokeDasharray:"74 107",strokeDashoffset:"0",className:"animate-library-arc"}),(0,N.jsx)("circle",{fill:"none",cx:"24",cy:"24",r:"17",stroke:"var(--spinner-from,#0284c7)",strokeWidth:"4.5",strokeLinecap:"round",strokeDasharray:"6 107",strokeDashoffset:"-83",className:"animate-library-pill1"}),(0,N.jsx)("circle",{fill:"none",cx:"24",cy:"24",r:"17",stroke:"var(--spinner-from,#0284c7)",strokeWidth:"4.5",strokeLinecap:"round",strokeDasharray:"4 107",strokeDashoffset:"-95",className:"animate-library-pill2"})]})})';

const newLoginSpinner = '(0,N.jsx)("div",{className:"me-2 inline-flex h-4 w-4 shrink-0 rounded-full border-2 border-primary border-t-transparent animate-spin"})';

for (const p of chunkFiles) {
  if (fs.existsSync(p)) {
    let js = fs.readFileSync(p, 'utf8');
    let mod = false;
    if (js.includes(tLoadingBlock)) {
      js = js.replace(tLoadingBlock, newLoadingBlock);
      mod = true;
      console.log(`✓ Replaced LoadingBlock in ${path.basename(p)} with simple progress bar`);
    }
    if (js.includes(tLoginSvg)) {
      js = js.replace(tLoginSvg, newLoginSpinner);
      mod = true;
      console.log(`✓ Replaced Login button spinner in ${path.basename(p)} with CSS border spinner`);
    }
    if (mod) {
      fs.writeFileSync(p, js, 'utf8');
      console.log(`✓ Saved ${p}`);
      try {
        execSync(`"${process.execPath}" -c "${p}"`, { stdio: 'pipe' });
        console.log(`✓ Syntax valid for ${path.basename(p)}`);
      } catch (err) {
        console.error(`[FATAL] Syntax check failed on ${p}:`, err.message);
        process.exit(1);
      }
    }
  }
}

// 5. Repack app.asar
console.log('\n--- Repacking app.asar ---');
try {
  const repackScript = path.join(root, 'scripts/repack-asar.cjs');
  execSync(`"${process.execPath}" "${repackScript}"`, { stdio: 'inherit' });
} catch (err) {
  console.warn('! Notice on repacking asar:', err.message);
}

console.log('\n=== SIMPLE PROGRESS BAR PATCH APPLIED SUCCESSFULLY ===');
