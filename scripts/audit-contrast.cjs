/**
 * WCAG 2.1 Contrast Ratio Audit Script
 * Calculates luminance and contrast ratios for all theme token pairs in light and dark mode.
 * Standard: WCAG AA requires 4.5:1 for normal text, 3.0:1 for large text / graphical components.
 */

function hexToRgb(hex) {
  let c = hex.replace('#', '').trim();
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const num = parseInt(c, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function getLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map(v => {
    const val = v / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(hex1, hex2) {
  const lum1 = getLuminance(hexToRgb(hex1));
  const lum2 = getLuminance(hexToRgb(hex2));
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

// Token definitions extracted directly from src/app/globals.css
const lightTokens = {
  background: '#f7f9fa',
  foreground: '#1c262d',
  card: '#ffffff',
  cardForeground: '#1c262d',
  popover: '#ffffff',
  popoverForeground: '#1c262d',
  primary: '#0a7c97',
  primaryForeground: '#ffffff',
  secondary: '#e2e8f0',
  secondaryForeground: '#1e293b',
  muted: '#f1f5f9',
  mutedForeground: '#556476',
  accent: '#cffafe',
  accentForeground: '#155e75',
  destructive: '#dc2626',
  destructiveForeground: '#ffffff',
  success: '#15803d',
  successForeground: '#ffffff',
  warning: '#b45309',
  warningForeground: '#ffffff',
  danger: '#dc2626',
  dangerForeground: '#ffffff',
  sidebar: '#f8fafc',
  sidebarForeground: '#1e293b',
  sidebarPrimary: '#0a7c97',
  sidebarPrimaryForeground: '#ffffff',
  sidebarAccent: '#e2e8f0',
  sidebarAccentForeground: '#0f172a',
};

const darkTokens = {
  background: '#080f16',
  foreground: '#e1eaec',
  card: '#101820',
  cardForeground: '#e1eaec',
  popover: '#101820',
  popoverForeground: '#e1eaec',
  primary: '#36cad8',
  primaryForeground: '#020f19',
  secondary: '#1a252f',
  secondaryForeground: '#cfd9dd',
  muted: '#19222a',
  mutedForeground: '#8d9ba4',
  accent: '#05343d',
  accentForeground: '#a0dae0',
  destructive: '#f05653',
  destructiveForeground: '#020f19',
  success: '#22c55e',
  successForeground: '#020f19',
  warning: '#f59e0b',
  warningForeground: '#020f19',
  danger: '#f05653',
  dangerForeground: '#020f19',
  sidebar: '#0b131c',
  sidebarForeground: '#cfd9dd',
  sidebarPrimary: '#36cad8',
  sidebarPrimaryForeground: '#020f19',
  sidebarAccent: '#151e28',
  sidebarAccentForeground: '#e1eaec',
};

const tokenPairs = [
  { surface: 'background', fg: 'foreground', name: 'Page Base' },
  { surface: 'background', fg: 'mutedForeground', name: 'Page Muted Text' },
  { surface: 'card', fg: 'cardForeground', name: 'Card Base' },
  { surface: 'card', fg: 'mutedForeground', name: 'Card Muted Text' },
  { surface: 'popover', fg: 'popoverForeground', name: 'Popover / Dropdown' },
  { surface: 'popover', fg: 'mutedForeground', name: 'Popover Muted Text' },
  { surface: 'primary', fg: 'primaryForeground', name: 'Primary Button / Badge' },
  { surface: 'secondary', fg: 'secondaryForeground', name: 'Secondary Button' },
  { surface: 'muted', fg: 'foreground', name: 'Muted Surface / Normal Text' },
  { surface: 'muted', fg: 'mutedForeground', name: 'Muted Surface / Muted Text' },
  { surface: 'accent', fg: 'accentForeground', name: 'Accent / Active Item' },
  { surface: 'destructive', fg: 'destructiveForeground', name: 'Destructive Button / Badge' },
  { surface: 'success', fg: 'successForeground', name: 'Success Badge' },
  { surface: 'warning', fg: 'warningForeground', name: 'Warning Badge' },
  { surface: 'danger', fg: 'dangerForeground', name: 'Danger Badge' },
  { surface: 'sidebar', fg: 'sidebarForeground', name: 'Sidebar Base' },
  { surface: 'sidebarPrimary', fg: 'sidebarPrimaryForeground', name: 'Sidebar Primary Item' },
  { surface: 'sidebarAccent', fg: 'sidebarAccentForeground', name: 'Sidebar Accent Item' },
];

function runAudit() {
  console.log('========================================================================================');
  console.log(' WCAG 2.1 CONTRAST AUDIT — LIBRARY STORE DESIGN TOKENS');
  console.log(' Target Thresholds: AA Normal >= 4.5:1 | AA Large / UI >= 3.0:1');
  console.log('========================================================================================\n');

  let failedCount = 0;
  const results = [];

  for (const pair of tokenPairs) {
    const bgLight = lightTokens[pair.surface];
    const fgLight = lightTokens[pair.fg];
    const ratioLight = getContrastRatio(bgLight, fgLight);
    const passLightAA = ratioLight >= 4.5;
    const passLightAALarge = ratioLight >= 3.0;

    const bgDark = darkTokens[pair.surface];
    const fgDark = darkTokens[pair.fg];
    const ratioDark = getContrastRatio(bgDark, fgDark);
    const passDarkAA = ratioDark >= 4.5;
    const passDarkAALarge = ratioDark >= 3.0;

    if (!passLightAA || !passDarkAA) {
      failedCount++;
    }

    results.push({
      name: pair.name,
      surface: pair.surface,
      fg: pair.fg,
      bgLight,
      fgLight,
      ratioLight: ratioLight.toFixed(2),
      passLightAA,
      passLightAALarge,
      bgDark,
      fgDark,
      ratioDark: ratioDark.toFixed(2),
      passDarkAA,
      passDarkAALarge,
    });
  }

  console.log('| Surface Token | Foreground Token | Light Hex Pair | Light Ratio | Light Status | Dark Hex Pair | Dark Ratio | Dark Status |');
  console.log('|:---|:---|:---|:---:|:---:|:---|:---:|:---:|');
  for (const r of results) {
    const lStatus = r.passLightAA ? 'PASS (AA)' : (r.passLightAALarge ? 'PASS (Large)' : 'FAIL (<3.0)');
    const dStatus = r.passDarkAA ? 'PASS (AA)' : (r.passDarkAALarge ? 'PASS (Large)' : 'FAIL (<3.0)');
    console.log(`| ${r.surface} | ${r.fg} | ${r.bgLight} / ${r.fgLight} | ${r.ratioLight}:1 | ${lStatus} | ${r.bgDark} / ${r.fgDark} | ${r.ratioDark}:1 | ${dStatus} |`);
  }

  console.log('\n========================================================================================');
  console.log(` AUDIT SUMMARY: ${results.length} pairs tested, ${failedCount} failing WCAG AA (4.5:1)`);
  console.log('========================================================================================\n');

  return { results, failedCount };
}

if (require.main === module) {
  const { failedCount } = runAudit();
  if (failedCount > 0) process.exit(1);
}

module.exports = { getContrastRatio, hexToRgb, getLuminance, runAudit };
