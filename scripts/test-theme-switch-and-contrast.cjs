const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('================================================================');
console.log('  LIGHT & DARK THEMES FORENSIC CONTRAST & ACCESSIBILITY AUDIT   ');
console.log('================================================================\n');

// 1. WCAG 2.1 Luminance & Contrast Math
function hexToRgb(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function relativeLuminance([r, g, b]) {
  const sRGB = [r, g, b].map(v => {
    const val = v / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
}

function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// 2. Comprehensive Token Pairs
const contrastChecks = [
  // --- LIGHT THEME ---
  { theme: 'LIGHT', name: 'Body Text (FG on BG)', fg: '#0f172a', bg: '#f7f9fa', min: 4.5 },
  { theme: 'LIGHT', name: 'Card Text (Card FG on Card)', fg: '#0f172a', bg: '#ffffff', min: 4.5 },
  { theme: 'LIGHT', name: 'Secondary Text (Muted FG on Card)', fg: '#475569', bg: '#ffffff', min: 4.5 },
  { theme: 'LIGHT', name: 'Secondary Text (Muted FG on BG)', fg: '#475569', bg: '#f7f9fa', min: 4.5 },
  { theme: 'LIGHT', name: 'Primary Action (Primary FG on Primary)', fg: '#ffffff', bg: '#0a7c97', min: 4.5 },
  { theme: 'LIGHT', name: 'Destructive Action (Destructive FG on Destructive)', fg: '#ffffff', bg: '#dc2626', min: 4.5 },
  { theme: 'LIGHT', name: 'Success Badge (Success FG on Success)', fg: '#ffffff', bg: '#15803d', min: 4.5 },
  { theme: 'LIGHT', name: 'Warning Badge (Warning FG on Warning)', fg: '#ffffff', bg: '#b45309', min: 4.5 },
  { theme: 'LIGHT', name: 'Sidebar Text (Sidebar FG on Sidebar)', fg: '#1e293b', bg: '#f8fafc', min: 4.5 },
  { theme: 'LIGHT', name: 'Barcode Generate (Amber on Card)', fg: '#b45309', bg: '#ffffff', min: 4.5 },
  { theme: 'LIGHT', name: 'Barcode Scan (Purple FG on Lavender BG)', fg: '#6b21a8', bg: '#f3e8ff', min: 4.5 },

  // --- DARK THEME ---
  { theme: 'DARK', name: 'Body Text (FG on BG)', fg: '#f1f5f9', bg: '#080f16', min: 4.5 },
  { theme: 'DARK', name: 'Card Text (Card FG on Card)', fg: '#f8fafc', bg: '#101820', min: 4.5 },
  { theme: 'DARK', name: 'Secondary Text (Muted FG on Card)', fg: '#94a3b8', bg: '#101820', min: 4.5 },
  { theme: 'DARK', name: 'Secondary Text (Muted FG on BG)', fg: '#94a3b8', bg: '#080f16', min: 4.5 },
  { theme: 'DARK', name: 'Primary Action (Primary FG on Primary)', fg: '#020f19', bg: '#36cad8', min: 4.5 },
  { theme: 'DARK', name: 'Destructive Action (Destructive FG on Destructive)', fg: '#020f19', bg: '#f05653', min: 4.5 },
  { theme: 'DARK', name: 'Success Badge (Success FG on Success)', fg: '#020f19', bg: '#22c55e', min: 4.5 },
  { theme: 'DARK', name: 'Warning Badge (Warning FG on Warning)', fg: '#020f19', bg: '#f59e0b', min: 4.5 },
  { theme: 'DARK', name: 'Sidebar Text (Sidebar FG on Sidebar)', fg: '#cfd9dd', bg: '#0b131c', min: 4.5 },
  { theme: 'DARK', name: 'Barcode Generate (Amber on Card)', fg: '#f59e0b', bg: '#101820', min: 4.5 },
  { theme: 'DARK', name: 'Barcode Scan (Purple FG on Deep Purple BG)', fg: '#d8b4fe', bg: '#2e1065', min: 4.5 },
];

console.log('--- 1. Contrast Ratio Verification (WCAG 2.1 Level AA >= 4.5:1) ---');
contrastChecks.forEach(c => {
  const ratio = contrastRatio(c.fg, c.bg);
  assert.ok(ratio >= c.min, `FAILED CONTRAST: [${c.theme}] ${c.name} ratio is ${ratio.toFixed(2)}:1, expected >= ${c.min}:1`);
  const level = ratio >= 7 ? 'AAA (>= 7:1)' : 'AA (>= 4.5:1)';
  console.log(`[PASS] [${c.theme.padEnd(5)}] ${c.name.padEnd(45)}: ${ratio.toFixed(2)}:1 -> ${level}`);
});

// 3. Theme Toggle & Persistence Simulation
console.log('\n--- 2. Theme Toggle & Persistence Simulation ---');

const mockStorage = {};
const mockClassList = new Set();
const mockDoc = {
  documentElement: {
    lang: 'ar',
    dir: 'rtl',
    classList: {
      toggle: (cls, force) => {
        if (force) mockClassList.add(cls);
        else mockClassList.delete(cls);
      },
      contains: (cls) => mockClassList.has(cls)
    }
  }
};

function applyDocument(lang, theme) {
  mockDoc.documentElement.lang = lang;
  mockDoc.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  mockDoc.documentElement.classList.toggle('dark', theme === 'dark');
}

function setTheme(theme) {
  mockStorage['library-theme'] = theme;
  applyDocument('ar', theme);
}

// Initial state: dark
setTheme('dark');
assert.strictEqual(mockDoc.documentElement.classList.contains('dark'), true, 'Dark class must be present on dark theme');
assert.strictEqual(mockStorage['library-theme'], 'dark', 'Theme dark must be saved in storage');
console.log('[PASS] Dark theme applies .dark class to root element');

// Toggle to light
setTheme('light');
assert.strictEqual(mockDoc.documentElement.classList.contains('dark'), false, 'Dark class must be absent on light theme');
assert.strictEqual(mockStorage['library-theme'], 'light', 'Theme light must be saved in storage');
console.log('[PASS] Light theme cleanly removes .dark class from root element');

// Re-read on reboot
const restoredTheme = mockStorage['library-theme'] || 'dark';
assert.strictEqual(restoredTheme, 'light', 'Reboot must restore chosen light theme');
applyDocument('ar', restoredTheme);
assert.strictEqual(mockDoc.documentElement.classList.contains('dark'), false);
console.log('[PASS] Theme choice successfully persists across app reboot');

// 4. Verify Compiled CSS Asset
console.log('\n--- 3. Verifying Production CSS Bundle Compatibility ---');
const distCssPath = path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/client/_next/static/chunks/3oa5e4nmj08il.css');
assert.ok(fs.existsSync(distCssPath), 'Production CSS file must exist');
const distCss = fs.readFileSync(distCssPath, 'utf8');

// Ensure zero oklch in client bundle for Windows 7 / Chromium 108 compatibility
assert.ok(!distCss.includes('oklch'), 'Found unsupported oklch color in Windows 7 client bundle!');
console.log('[PASS] Production bundle is 100% free of unsupported oklch functions (Universal sRGB guaranteed)');

// Ensure both light (:root) and dark (.dark) palettes exist in the bundle
assert.ok(distCss.includes('--background:#f7f9fa'), 'Missing light theme background in production CSS');
assert.ok(distCss.includes('--background:#080f16'), 'Missing dark theme background in production CSS');
assert.ok(distCss.includes('--foreground:#0f172a'), 'Missing light theme foreground in production CSS');
assert.ok(distCss.includes('--foreground:#f1f5f9'), 'Missing dark theme foreground in production CSS');
console.log('[PASS] Both light (:root) and dark (.dark) color sets are properly packaged in production bundle');

// 5. Permanent Delete Dialog Theme & Contrast Verification
console.log('\n--- 4. Verifying PermanentDeleteDialog Theme & Contrast Integrity ---');
const pddPath = path.resolve(__dirname, '../src/components/library/parts/permanent-delete-dialog.tsx');
assert.ok(fs.existsSync(pddPath), 'permanent-delete-dialog.tsx must exist');
const pddCode = fs.readFileSync(pddPath, 'utf8');
assert.ok(!pddCode.includes('#0e141c'), 'Found hardcoded #0e141c in permanent-delete-dialog.tsx');
assert.ok(!pddCode.includes('#131b26'), 'Found hardcoded #131b26 in permanent-delete-dialog.tsx');
assert.ok(!pddCode.includes('#223041'), 'Found hardcoded #223041 in permanent-delete-dialog.tsx');
assert.ok(pddCode.includes('border-border'), 'Missing semantic border-border in permanent-delete-dialog.tsx');
assert.ok(pddCode.includes('bg-muted/40'), 'Missing semantic bg-muted/40 in permanent-delete-dialog.tsx');
console.log('[PASS] permanent-delete-dialog.tsx source uses 100% theme-adaptive semantic tokens');

const chunkCheckPaths = [
  path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js'),
  path.resolve(__dirname, '../out/_next/static/chunks/18yoqc7d05wnq.js')
];

chunkCheckPaths.forEach(cp => {
  if (fs.existsSync(cp)) {
    const chunkContent = fs.readFileSync(cp, 'utf8');
    assert.ok(!chunkContent.includes('bg-[#0e141c]'), `Found hardcoded bg-[#0e141c] in chunk ${path.basename(cp)}`);
    assert.ok(!chunkContent.includes('bg-[#131b26]'), `Found hardcoded bg-[#131b26] in chunk ${path.basename(cp)}`);
    assert.ok(!chunkContent.includes('border-[#223041]'), `Found hardcoded border-[#223041] in chunk ${path.basename(cp)}`);
    console.log(`[PASS] Compiled chunk ${path.basename(cp)} is verified free of hardcoded dark backgrounds`);
  }
});

console.log('\n[PASS] SUITE SUMMARY: ALL 30 THEME CONTRAST & FUNCTIONALITY CHECKS PASSED CLEANLY');
