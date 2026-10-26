/**
 * Apply Natural Switch Direction & High-Contrast Thumb for Arabic RTL & LTR
 * Target: All CSS and switch component files
 * Behavior: 
 *   - Checked (ON / مفعّل): Thumb is on the RIGHT (15px) with white circle & shadow
 *   - Unchecked (OFF / معطّل): Thumb is on the LEFT (1px)
 *   - Identical, natural behavior across RTL & LTR matching user reference (Image 2)
 */
'use strict';

const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('  APPLYING NATURAL SWITCH RTL & HIGH-CONTRAST FIX');
console.log('====================================================\n');

const newSwitchCss = `/* RTL / LTR Precision Switch Alignment & Zero-Overhang Shield */
[data-slot="switch"],
button[role="switch"] {
  position: relative !important;
  display: inline-flex !important;
  align-items: center !important;
  width: 32px !important;
  min-width: 32px !important;
  max-width: 32px !important;
  height: 1.15rem !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
  direction: ltr !important;
}

[data-slot="switch-thumb"],
button[role="switch"] > span {
  position: absolute !important;
  top: 50% !important;
  left: 0 !important;
  width: 16px !important;
  min-width: 16px !important;
  max-width: 16px !important;
  height: 16px !important;
  min-height: 16px !important;
  max-height: 16px !important;
  border-radius: 9999px !important;
  translate: none !important;
  transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1) !important;
  box-sizing: border-box !important;
  will-change: transform !important;
  background-color: #ffffff !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3) !important;
}

/* UNCHECKED (OFF / غير مفعّل): Thumb on LEFT (1px) in all modes */
button[role="switch"][data-state="unchecked"] [data-slot="switch-thumb"],
button[role="switch"][data-state="unchecked"] > span,
[data-slot="switch"][data-state="unchecked"] [data-slot="switch-thumb"],
[dir="rtl"] button[role="switch"][data-state="unchecked"] [data-slot="switch-thumb"],
[dir="rtl"] button[role="switch"][data-state="unchecked"] > span,
html[dir="rtl"] button[role="switch"][data-state="unchecked"] [data-slot="switch-thumb"],
html[dir="rtl"] button[role="switch"][data-state="unchecked"] > span,
body[dir="rtl"] button[role="switch"][data-state="unchecked"] [data-slot="switch-thumb"],
body[dir="rtl"] button[role="switch"][data-state="unchecked"] > span,
html[dir="rtl"] [data-slot="switch"][data-state="unchecked"] [data-slot="switch-thumb"],
[dir="ltr"] button[role="switch"][data-state="unchecked"] [data-slot="switch-thumb"],
[dir="ltr"] button[role="switch"][data-state="unchecked"] > span,
html[dir="ltr"] button[role="switch"][data-state="unchecked"] [data-slot="switch-thumb"],
html[dir="ltr"] button[role="switch"][data-state="unchecked"] > span,
body[dir="ltr"] button[role="switch"][data-state="unchecked"] [data-slot="switch-thumb"],
body[dir="ltr"] button[role="switch"][data-state="unchecked"] > span,
html[dir="ltr"] [data-slot="switch"][data-state="unchecked"] [data-slot="switch-thumb"] {
  translate: none !important;
  transform: translate(1px, -50%) !important;
}

/* CHECKED (ON / مفعّل): Thumb on RIGHT (15px) in all modes */
button[role="switch"][data-state="checked"] [data-slot="switch-thumb"],
button[role="switch"][data-state="checked"] > span,
[data-slot="switch"][data-state="checked"] [data-slot="switch-thumb"],
[dir="rtl"] button[role="switch"][data-state="checked"] [data-slot="switch-thumb"],
[dir="rtl"] button[role="switch"][data-state="checked"] > span,
html[dir="rtl"] button[role="switch"][data-state="checked"] [data-slot="switch-thumb"],
html[dir="rtl"] button[role="switch"][data-state="checked"] > span,
body[dir="rtl"] button[role="switch"][data-state="checked"] [data-slot="switch-thumb"],
body[dir="rtl"] button[role="switch"][data-state="checked"] > span,
html[dir="rtl"] [data-slot="switch"][data-state="checked"] [data-slot="switch-thumb"],
[dir="ltr"] button[role="switch"][data-state="checked"] [data-slot="switch-thumb"],
[dir="ltr"] button[role="switch"][data-state="checked"] > span,
html[dir="ltr"] button[role="switch"][data-state="checked"] [data-slot="switch-thumb"],
html[dir="ltr"] button[role="switch"][data-state="checked"] > span,
body[dir="ltr"] button[role="switch"][data-state="checked"] [data-slot="switch-thumb"],
body[dir="ltr"] button[role="switch"][data-state="checked"] > span,
html[dir="ltr"] [data-slot="switch"][data-state="checked"] [data-slot="switch-thumb"] {
  translate: none !important;
  transform: translate(15px, -50%) !important;
}
`;

// 1. Update CSS chunks
const cssTargets = [
  path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/client/_next/static/chunks/3oa5e4nmj08il.css'),
  path.resolve(__dirname, '../out/_next/static/chunks/3oa5e4nmj08il.css')
];

for (const csf of cssTargets) {
  if (!fs.existsSync(csf)) continue;
  console.log(`>>> Patching CSS file: ${path.relative(path.resolve(__dirname, '..'), csf)}`);
  let css = fs.readFileSync(csf, 'utf8');
  
  const startMarker = '/* RTL / LTR Precision Switch Alignment';
  const endMarker = '/* Chromium 109 / Windows 7 fallbacks';
  
  const sIdx = css.indexOf(startMarker);
  const eIdx = css.indexOf(endMarker);
  
  if (sIdx !== -1 && eIdx !== -1) {
    css = css.slice(0, sIdx) + newSwitchCss + '\n\n' + css.slice(eIdx);
    fs.writeFileSync(csf, css, 'utf8');
    console.log(`[PASS] Replaced switch CSS rules in ${csf}`);
  } else {
    console.warn(`[WARN] Markers not found in ${csf}`);
  }
}

// 2. Update globals.css in both workspaces
const globalCssTargets = [
  path.resolve(__dirname, '../src/app/globals.css'),
  path.resolve(__dirname, '../../src/app/globals.css')
];

for (const gcf of globalCssTargets) {
  if (!fs.existsSync(gcf)) continue;
  let gcss = fs.readFileSync(gcf, 'utf8');
  const startMarker = '/* RTL / LTR Precision Switch Alignment';
  const sIdx = gcss.indexOf(startMarker);
  if (sIdx !== -1) {
    const nextBlock = gcss.indexOf('/* Chromium 109', sIdx);
    const fontBlock = gcss.indexOf('/* Primary Arabic Brand Font', sIdx);
    let nextIdx = -1;
    if (nextBlock !== -1 && fontBlock !== -1) {
      nextIdx = Math.min(nextBlock, fontBlock);
    } else if (nextBlock !== -1) {
      nextIdx = nextBlock;
    } else if (fontBlock !== -1) {
      nextIdx = fontBlock;
    }

    if (nextIdx !== -1) {
      gcss = gcss.slice(0, sIdx) + newSwitchCss + '\n\n' + gcss.slice(nextIdx);
    } else {
      gcss = gcss.slice(0, sIdx) + newSwitchCss;
    }
  } else {
    gcss += '\n\n' + newSwitchCss;
  }
  fs.writeFileSync(gcf, gcss, 'utf8');
  console.log(`[PASS] Updated globals.css in ${gcf}`);
}

// 3. Update switch.tsx in both workspaces
const switchTargets = [
  path.resolve(__dirname, '../src/components/ui/switch.tsx'),
  path.resolve(__dirname, '../../src/components/ui/switch.tsx')
];

for (const sw of switchTargets) {
  if (!fs.existsSync(sw)) continue;
  let content = fs.readFileSync(sw, 'utf8');
  content = content.replace(
    'bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform',
    'bg-white pointer-events-none block size-4 rounded-full shadow-sm transition-transform'
  );
  fs.writeFileSync(sw, content, 'utf8');
  console.log(`[PASS] Updated switch component in ${sw}`);
}

console.log('\n[SUCCESS] Natural switch direction applied across all targets.');
