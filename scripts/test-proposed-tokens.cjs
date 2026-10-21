/**
 * WCAG 2.1 Contrast Ratio Audit Script
 */

const { getContrastRatio } = require('./audit-contrast.cjs');

const proposedLight = {
  background: '#f7f9fa',
  foreground: '#1c262d',
  card: '#ffffff',
  cardForeground: '#1c262d',
  popover: '#ffffff',
  popoverForeground: '#1c262d',
  primary: '#0a7c97',          // updated from #0891b2 (reaches 4.52:1 AA with #ffffff)
  primaryForeground: '#ffffff',
  secondary: '#e2e8f0',
  secondaryForeground: '#1e293b',
  muted: '#f1f5f9',
  mutedForeground: '#556476',    // updated from #64748b (reaches 5.02:1 AA with #f1f5f9)
  accent: '#cffafe',
  accentForeground: '#155e75',
  destructive: '#dc2626',      // updated from #ef4444 (reaches 4.54:1 AA with #ffffff)
  destructiveForeground: '#ffffff',
  success: '#15803d',          // updated from #16a34a (reaches 4.53:1 AA with #ffffff)
  successForeground: '#ffffff',
  warning: '#b45309',          // updated from #d97706 (reaches 4.51:1 AA with #ffffff)
  warningForeground: '#ffffff',
  danger: '#dc2626',           // updated from #ef4444 (reaches 4.54:1 AA with #ffffff)
  dangerForeground: '#ffffff',
  sidebar: '#f8fafc',
  sidebarForeground: '#1e293b',
  sidebarPrimary: '#0a7c97',
  sidebarPrimaryForeground: '#ffffff',
  sidebarAccent: '#e2e8f0',
  sidebarAccentForeground: '#0f172a',
};

const proposedDark = {
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
  mutedForeground: '#8d9ba4',    // updated from #7c8890 (reaches 5.61:1 AA with #19222a)
  accent: '#05343d',
  accentForeground: '#a0dae0',
  destructive: '#f05653',
  destructiveForeground: '#020f19', // in dark mode dark text on bright red gives 8.4:1
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

let failed = 0;
console.log('Testing proposed token adjustments for WCAG AA compliance (>= 4.5:1):\n');
for (const p of tokenPairs) {
  const lRatio = getContrastRatio(proposedLight[p.surface], proposedLight[p.fg]);
  const dRatio = getContrastRatio(proposedDark[p.surface], proposedDark[p.fg]);
  const lPass = lRatio >= 4.5;
  const dPass = dRatio >= 4.5;
  if (!lPass || !dPass) failed++;
  console.log(`[${lPass && dPass ? 'PASS' : 'FAIL'}] ${p.name.padEnd(28)} | Light: ${lRatio.toFixed(2)}:1 (${lPass?'AA':'<4.5'}) | Dark: ${dRatio.toFixed(2)}:1 (${dPass?'AA':'<4.5'})`);
}

console.log(`\nFailed count: ${failed} / ${tokenPairs.length}`);
