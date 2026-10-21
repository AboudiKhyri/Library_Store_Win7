const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const screensDir = path.join(root, 'src', 'components', 'library', 'screens');

// 1. pos.tsx
{
  const p = path.join(screensDir, 'pos.tsx');
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  const oldToastPattern = /toast\(\{\s*variant: 'destructive',\s*title: p\.hasExpiredStock[\s\S]*?\}\)/;
  const newToast = `toast({
            variant: 'destructive',
            title: 'غير متاح للبيع',
            description: \`\${p.nameAr}: لا يوجد رصيد متاح حالياً\`,
          })`;
  c = c.replace(oldToastPattern, newToast);
  c = c.replace('batches: { expiryDate: string | null; quantity: number; status: string }[]', 'batches: { quantity: number; status: string }[]');
  c = c.replace(/\n/g, '\r\n');
  fs.writeFileSync(p, c, 'utf8');
  console.log('✓ pos.tsx cleaned');
}

// 2. reports.tsx
{
  const p = path.join(screensDir, 'reports.tsx');
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  const stray = `                  const tone = st === 'EXPIRED' ? 'border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)]' : st === 'NEAR' ? 'border-[var(--warning)]/30 bg-[var(--warning)]/10 text-[var(--warning)]' : 'border-border bg-muted text-muted-foreground'
            return <span className={\`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold \${tone}\`}>{lbl}</span>
          } },
        ]\n`;
  c = c.replace(stray, '');
  c = c.replace(/\n/g, '\r\n');
  fs.writeFileSync(p, c, 'utf8');
  console.log('✓ reports.tsx cleaned');
}
