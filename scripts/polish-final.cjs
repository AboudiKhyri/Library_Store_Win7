const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const screensDir = path.join(root, 'src', 'components', 'library', 'screens');

// inventory.tsx
{
  const p = path.join(screensDir, 'inventory.tsx');
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

  c = c.replace(/const EXPIRY_COLORS: Record<string, string> = \{[\s\S]*?\n\};\n/, '');
  c = c.replace("stats: { expired: number; near: number; valid: number }", "stats: { valid: number; depleted?: number }");
  c = c.replace("stats, setStats] = useState<{ expired: number; near: number; valid: number }>({ expired: 0, near: 0, valid: 0 })", "stats, setStats] = useState<{ valid: number; depleted?: number }>({ valid: 0, depleted: 0 })");

  c = c.replace(/\n/g, '\r\n');
  fs.writeFileSync(p, c, 'utf8');
  console.log('✓ inventory.tsx clean');
}

// pos.tsx
{
  const p = path.join(screensDir, 'pos.tsx');
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

  c = c.replace("  const warningDays = pos?.expiryWarningDays ?? 90\n", "");

  const oldAddToCartToast = `        variant: 'destructive',
        title: p.hasExpiredStock ? 'صنف منتهي الصلاحية' : 'غير متاح للبيع',
        description:
          p.hasExpiredStock && p.stockAvailable <= 0
            ? \`\${p.nameAr}: كل الرصيد المتاح منتهي الصلاحية ولا يمكن بيعه\`
            : \`\${p.nameAr}: الكمية المطلوبة غير متاحة في المخزون النشط\`,`;

  const newAddToCartToast = `        variant: 'destructive',
        title: 'غير متاح للبيع',
        description: \`\${p.nameAr}: الكمية المطلوبة غير متاحة في المخزون النشط\`,`;

  if (c.includes(oldAddToCartToast)) {
    c = c.replace(oldAddToCartToast, newAddToCartToast);
  }

  c = c.replace("        expiredSoon: !!p.expiredSoon,\n", "");

  c = c.replace(/\n/g, '\r\n');
  fs.writeFileSync(p, c, 'utf8');
  console.log('✓ pos.tsx clean');
}

// reports.tsx
{
  const p = path.join(screensDir, 'reports.tsx');
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

  c = c.replace(/const EXPIRY_STATE_LABEL: Record<string, \[string, string\]> = \{[\s\S]*?\n\};\n/, '');
  c = c.replace("    if (def.expiryFilter && expiryFilter !== 'all') params.set('filter', expiryFilter)\n", "");

  c = c.replace(/\n/g, '\r\n');
  fs.writeFileSync(p, c, 'utf8');
  console.log('✓ reports.tsx clean');
}
