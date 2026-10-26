const fs = require('fs');
const path = require('path');

console.log('=== APPLYING BULLETPROOF SWITCH FIX ===');

const newCssRules = `/* RTL / LTR Precision Switch Alignment & Zero-Overhang Shield */
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
}

/* RTL: In Arabic documents, unchecked is on right (15px), checked is on left (1px) */
[dir="rtl"] button[role="switch"][data-state="unchecked"] [data-slot="switch-thumb"],
[dir="rtl"] button[role="switch"][data-state="unchecked"] > span,
html[dir="rtl"] button[role="switch"][data-state="unchecked"] [data-slot="switch-thumb"],
html[dir="rtl"] button[role="switch"][data-state="unchecked"] > span,
body[dir="rtl"] button[role="switch"][data-state="unchecked"] [data-slot="switch-thumb"],
body[dir="rtl"] button[role="switch"][data-state="unchecked"] > span,
html[dir="rtl"] [data-slot="switch"][data-state="unchecked"] [data-slot="switch-thumb"] {
  translate: none !important;
  transform: translate(15px, -50%) !important;
}

[dir="rtl"] button[role="switch"][data-state="checked"] [data-slot="switch-thumb"],
[dir="rtl"] button[role="switch"][data-state="checked"] > span,
html[dir="rtl"] button[role="switch"][data-state="checked"] [data-slot="switch-thumb"],
html[dir="rtl"] button[role="switch"][data-state="checked"] > span,
body[dir="rtl"] button[role="switch"][data-state="checked"] [data-slot="switch-thumb"],
body[dir="rtl"] button[role="switch"][data-state="checked"] > span,
html[dir="rtl"] [data-slot="switch"][data-state="checked"] [data-slot="switch-thumb"] {
  translate: none !important;
  transform: translate(1px, -50%) !important;
}

/* LTR: In English documents, unchecked is on left (1px), checked is on right (15px) */
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

[dir="ltr"] button[role="switch"][data-state="checked"] [data-slot="switch-thumb"],
[dir="ltr"] button[role="switch"][data-state="checked"] > span,
html[dir="ltr"] button[role="switch"][data-state="checked"] [data-slot="switch-thumb"],
html[dir="ltr"] button[role="switch"][data-state="checked"] > span,
body[dir="ltr"] button[role="switch"][data-state="checked"] [data-slot="switch-thumb"],
body[dir="ltr"] button[role="switch"][data-state="checked"] > span,
html[dir="ltr"] [data-slot="switch"][data-state="checked"] [data-slot="switch-thumb"] {
  translate: none !important;
  transform: translate(15px, -50%) !important;
}`;

// 1. Update globals.css in both workspaces
const globalsFiles = [
  path.resolve(__dirname, '../../src/app/globals.css'),
  path.resolve(__dirname, '../src/app/globals.css')
];

globalsFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  // Strip any old injected switch rules
  const oldMarker = '/* RTL Switch Thumb Transitions & Positioning';
  const newMarker = '/* RTL / LTR Precision Switch Alignment';
  if (content.includes(oldMarker)) {
    const idx = content.indexOf(oldMarker);
    content = content.slice(0, idx).trimEnd();
  }
  if (content.includes(newMarker)) {
    const idx = content.indexOf(newMarker);
    content = content.slice(0, idx).trimEnd();
  }
  content = content + '\n\n' + newCssRules + '\n';
  fs.writeFileSync(file, content, 'utf8');
  console.log('[PASS] Updated globals.css in:', file);
});

// 2. Update client CSS chunks in out/ and dist-desktop/
const cssChunks = [
  path.resolve(__dirname, '../out/_next/static/chunks/3oa5e4nmj08il.css'),
  path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/client/_next/static/chunks/3oa5e4nmj08il.css')
];

cssChunks.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  const oldMarker = '/* RTL Switch Thumb Transitions & Positioning';
  const newMarker = '/* RTL / LTR Precision Switch Alignment';
  if (content.includes(oldMarker)) {
    const idx = content.indexOf(oldMarker);
    content = content.slice(0, idx).trimEnd();
  }
  if (content.includes(newMarker)) {
    const idx = content.indexOf(newMarker);
    content = content.slice(0, idx).trimEnd();
  }
  content = content + '\n\n' + newCssRules + '\n';
  fs.writeFileSync(file, content, 'utf8');
  console.log('[PASS] Updated compiled CSS chunk:', file);
});

// 3. Clean up switch.tsx in both workspaces
const switchFiles = [
  path.resolve(__dirname, '../../src/components/ui/switch.tsx'),
  path.resolve(__dirname, '../src/components/ui/switch.tsx')
];

switchFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  // Simplify thumb classes so CSS cleanly controls absolute positioning
  const oldClasses = 'bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0 rtl:data-[state=checked]:-translate-x-[calc(100%-2px)] rtl:data-[state=unchecked]:translate-x-0';
  const newClasses = 'bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform';
  if (content.includes(oldClasses)) {
    content = content.replace(oldClasses, newClasses);
    fs.writeFileSync(file, content, 'utf8');
    console.log('[PASS] Cleaned up switch.tsx classes in:', file);
  }
});

// 4. Clean up 18yoqc7d05wnq.js chunks
const jsChunks = [
  path.resolve(__dirname, '../out/_next/static/chunks/18yoqc7d05wnq.js'),
  path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js')
];

jsChunks.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  const oldClasses = 'data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0 rtl:data-[state=checked]:-translate-x-[calc(100%-2px)] rtl:data-[state=unchecked]:translate-x-0';
  if (content.includes(oldClasses)) {
    content = content.replace(oldClasses, '');
    fs.writeFileSync(file, content, 'utf8');
    console.log('[PASS] Cleaned up Switch Thumb classes in JS chunk:', file);
  }
});

console.log('=== BULLETPROOF SWITCH FIX COMPLETED SUCCESSFULLY ===');
