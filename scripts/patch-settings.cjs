/**
 * Helper to patch settings.tsx cleanly
 */
const fs = require('fs');
const path = require('path');

const file = path.resolve('src/components/library/screens/settings.tsx');
let content = fs.readFileSync(file, 'utf8');

const contrastHelper = `
function getContrastInfo(hex: string) {
  if (!hex || typeof hex !== 'string') return { fg: '#ffffff', ratio: 21, warn: false };
  const c = hex.replace('#', '').trim();
  if (c.length !== 3 && c.length !== 6) return { fg: '#ffffff', ratio: 21, warn: false };
  const full = c.length === 3 ? c.split('').map(x => x + x).join('') : c;
  const num = parseInt(full, 16);
  if (isNaN(num)) return { fg: '#ffffff', ratio: 21, warn: false };
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const toLinear = (v: number) => {
    const val = v / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  const ratioWhite = 1.05 / (lum + 0.05);
  const ratioBlack = (lum + 0.05) / 0.05;
  const useBlack = ratioBlack > ratioWhite;
  const bestRatio = Math.max(ratioWhite, ratioBlack);
  return {
    fg: useBlack ? '#020f19' : '#ffffff',
    ratio: bestRatio,
    warn: bestRatio < 3.0,
  };
}
`;

content = content.replace('// ---------------- Branding ----------------', '// ---------------- Branding ----------------\n' + contrastHelper);

content = content.replace(
  'const br = cfg.branding',
  'const br = cfg.branding\n  const primaryContrast = getContrastInfo(br.primary)'
);

content = content.replace(
  'className="ms-auto rounded-md px-2 py-1 text-[10px] font-bold text-white"',
  'className="ms-auto rounded-md px-2 py-1 text-[10px] font-bold"'
);

content = content.replace(
  'style={{ background: br.primary }}\n            >',
  'style={{ background: br.primary, color: primaryContrast.fg }}\n            >'
);

// Add warning under primary color input
const primaryInputBlock = `<Input
                dir="ltr"
                value={br[k]}
                onChange={(e) => setCfg((c) => (c ? { ...c, branding: { ...c.branding, [k]: e.target.value } } : c))}
                className="qx-num font-mono text-xs"
              />
            </div>
            {k === 'primary' && primaryContrast.warn && (
              <p className="mt-2 text-[10px] font-medium text-amber-500">
                {L('تنبيه: نسبة التباين منخفضة جداً (< 3:1)', 'Warning: Contrast ratio is low (< 3:1)')}
              </p>
            )}`;

content = content.replace(
  `<Input
                dir="ltr"
                value={br[k]}
                onChange={(e) => setCfg((c) => (c ? { ...c, branding: { ...c.branding, [k]: e.target.value } } : c))}
                className="qx-num font-mono text-xs"
              />
            </div>`,
  primaryInputBlock
);

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated settings.tsx with dynamic contrast calculation and warning.');
