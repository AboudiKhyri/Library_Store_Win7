/**
 * Forensic Contrast & Accessibility Auditor for Library Store (Win7 Edition)
 */

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

const tests = [
  // Light theme
  { theme: 'Light', name: 'Foreground on Background', fg: '#0f172a', bg: '#f7f9fa', min: 4.5 },
  { theme: 'Light', name: 'Foreground on Card', fg: '#0f172a', bg: '#ffffff', min: 4.5 },
  { theme: 'Light', name: 'Card Foreground on Card', fg: '#0f172a', bg: '#ffffff', min: 4.5 },
  { theme: 'Light', name: 'Muted Foreground on Card', fg: '#475569', bg: '#ffffff', min: 4.5 },
  { theme: 'Light', name: 'Muted Foreground on Background', fg: '#475569', bg: '#f7f9fa', min: 4.5 },
  { theme: 'Light', name: 'Primary FG on Primary', fg: '#ffffff', bg: '#0a7c97', min: 4.5 },
  { theme: 'Light', name: 'Barcode Generate FG on Card', fg: '#b45309', bg: '#ffffff', min: 4.5 },
  { theme: 'Light', name: 'Barcode Scan FG on Scan BG', fg: '#6b21a8', bg: '#f3e8ff', min: 4.5 },

  // Dark theme
  { theme: 'Dark', name: 'Foreground on Background', fg: '#f1f5f9', bg: '#080f16', min: 4.5 },
  { theme: 'Dark', name: 'Foreground on Card', fg: '#f1f5f9', bg: '#101820', min: 4.5 },
  { theme: 'Dark', name: 'Card Foreground on Card', fg: '#f8fafc', bg: '#101820', min: 4.5 },
  { theme: 'Dark', name: 'Muted Foreground on Background', fg: '#94a3b8', bg: '#080f16', min: 4.5 },
  { theme: 'Dark', name: 'Muted Foreground on Card', fg: '#94a3b8', bg: '#101820', min: 4.5 },
  { theme: 'Dark', name: 'Primary FG on Primary', fg: '#020f19', bg: '#36cad8', min: 4.5 },
  { theme: 'Dark', name: 'Barcode Generate FG on Card', fg: '#f59e0b', bg: '#101820', min: 4.5 },
  { theme: 'Dark', name: 'Barcode Scan FG on Scan BG', fg: '#d8b4fe', bg: '#2e1065', min: 4.5 },
];

console.log('='.repeat(70));
console.log('LIBRARY STORE CONTRAST RATIO AUDIT (WCAG 2.1 AA >= 4.5:1)');
console.log('='.repeat(70));

let allPass = true;
tests.forEach(t => {
  const ratio = contrastRatio(t.fg, t.bg);
  const pass = ratio >= t.min;
  if (!pass) allPass = false;
  console.log(`[${t.theme.toUpperCase()}] ${t.name.padEnd(35)} : ${ratio.toFixed(2)}:1 (min ${t.min}:1) -> ${pass ? 'PASS' : 'FAIL'}`);
});

console.log('='.repeat(70));
if (allPass) {
  console.log('RESULT: ALL 16 CONTRAST RATIO CHECKS PASSED WCAG AA (>= 4.5:1)');
} else {
  console.error('RESULT: CONTRAST FAILURES DETECTED');
  process.exit(1);
}
