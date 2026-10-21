/**
 * Forensic script to polish remaining expiry references in UI screens:
 * - pos.tsx
 * - purchases.tsx
 * - reports.tsx
 * - settings.tsx
 * - inventory.tsx
 * - products.tsx
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const screensDir = path.join(root, 'src', 'components', 'library', 'screens');

// 1. pos.tsx
{
  const p = path.join(screensDir, 'pos.tsx');
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

  // Interface PosProduct
  c = c.replace('  expiredSoon?: boolean\n', '');
  c = c.replace('  hasExpiredStock?: boolean\n', '');
  c = c.replace('  nearestExpiry?: string | null\n', '');

  // Add to cart error
  c = c.replace(
    `      toast({
        variant: 'destructive',
        title: p.hasExpiredStock ? 'صنف منتهي الصلاحية' : 'غير متاح للبيع',
        description:
          p.hasExpiredStock && p.stockAvailable <= 0
            ? \`\${p.nameAr}: كل الرصيد المتاح منتهي الصلاحية ولا يمكن بيعه\`
            : \`\${p.nameAr}: الكمية المطلوبة غير متاحة في المخزون النشط\`,
      })`,
    `      toast({
        variant: 'destructive',
        title: 'غير متاح للبيع',
        description: \`\${p.nameAr}: الكمية المطلوبة غير متاحة في المخزون النشط\`,
      })`
  );

  // Palette addProduct
  const oldPaletteBlock = `        // derive expiry flags from the detail batches (list route computes these too)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const hasExpiredStock = (res.batches ?? []).some(
          (b) => b.quantity > 0 && b.status === 'EXPIRED' || (b.expiryDate && new Date(b.expiryDate) < today && b.quantity > 0)
        )
        const nearest = (res.batches ?? [])
          .filter((b) => b.quantity > 0 && b.expiryDate && new Date(b.expiryDate) >= today)
          .map((b) => new Date(b.expiryDate as string).getTime())
          .sort((a, b) => a - b)[0]
        const expiredSoon = nearest != null && nearest - today.getTime() <= (warningDays * 86400000)
        addProduct({
          ...p,
          stockAvailable: res.stockAvailable ?? p.stockAvailable ?? 0,
          hasExpiredStock,
          expiredSoon: !!expiredSoon,
        })`;

  const newPaletteBlock = `        addProduct({
          ...p,
          stockAvailable: res.stockAvailable ?? p.stockAvailable ?? 0,
        })`;

  if (c.includes(oldPaletteBlock)) {
    c = c.replace(oldPaletteBlock, newPaletteBlock);
  }

  c = c.replace('        expiredSoon: !!l.expiredSoon,\n', '');

  // Near expiry in product card
  const oldNearExpiry = `  const nearExpiry =
    !!product.expiredSoon ||
    (!!product.nearestExpiry &&
      new Date(product.nearestExpiry).getTime() - Date.now() <= warningDays * 86400000 &&
      new Date(product.nearestExpiry).getTime() >= Date.now())\n`;

  if (c.includes(oldNearExpiry)) {
    c = c.replace(oldNearExpiry, '');
  }

  // Badges in product card
  const oldBadges = `        {avail <= 0 && product.hasExpiredStock && (
          <Badge variant="outline" className="border-[var(--danger)]/40 bg-[var(--danger)]/10 text-[10px] text-[var(--danger)]">
            <CalendarX className="me-1 h-3 w-3" />
            منتهي
          </Badge>
        )}
        {nearExpiry && avail > 0 && (
          <Badge variant="outline" className="border-[var(--warning)]/40 bg-[var(--warning)]/10 text-[10px] text-[var(--warning)]">
            <Timer className="me-1 h-3 w-3" />
            قاربت الصلاحية
          </Badge>
        )}`;

  if (c.includes(oldBadges)) {
    c = c.replace(oldBadges, '');
  }

  c = c.replace(/\n/g, '\r\n');
  fs.writeFileSync(p, c, 'utf8');
  console.log('✓ pos.tsx polished');
}

// 2. purchases.tsx
{
  const p = path.join(screensDir, 'purchases.tsx');
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

  c = c.replace('  expiryDate: string | null\n', '');
  c = c.replace('  expiryDate: string\n', '');
  c = c.replace("    expiryDate: '',\n", '');
  c = c.replace('        expiryDate: it.expiryDate || undefined,\n', '');

  const oldExpiryInputDiv = `                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">
                        {t('purchases.expiry')} <span className="text-muted-foreground/60">({t('app.optional')})</span>
                      </Label>
                      <Input
                        type="date"
                        dir="ltr"
                        className="qx-num"
                        value={it.expiryDate}
                        onChange={(e) => updateItem(i, { expiryDate: e.target.value })}
                      />
                    </div>`;

  if (c.includes(oldExpiryInputDiv)) {
    c = c.replace(oldExpiryInputDiv, '');
  }

  c = c.replace(/\n/g, '\r\n');
  fs.writeFileSync(p, c, 'utf8');
  console.log('✓ purchases.tsx polished');
}

// 3. reports.tsx
{
  const p = path.join(screensDir, 'reports.tsx');
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

  c = c.replace('  expiryFilter?: boolean\n', '');
  c = c.replace(/const EXPIRY_STATE_LABEL: Record<string, \[string, string\]> = \{[\s\S]*?\};\n/, '');
  c = c.replace("  const [expiryFilter, setExpiryFilter] = useState('all')\n", '');
  c = c.replace("    if (def.expiryFilter && expiryFilter !== 'all') params.set('filter', expiryFilter)\n", '');
  c = c.replace(", expiryFilter", "");
  c = c.replace("expiryFilter, ", "");

  // Remove case 'expiry'
  const oldExpiryCasePattern = /case 'expiry':\n\s*return \[[\s\S]*?\]\n/;
  if (oldExpiryCasePattern.test(c)) {
    c = c.replace(oldExpiryCasePattern, '');
  }

  // Remove expiryFilter UI block
  const oldExpiryFilterBlock = `              {def.expiryFilter && (
                <div className="flex-1 sm:max-w-[200px]">
                  <Label className="mb-1.5 block text-xs text-muted-foreground">{L('الفلترة', 'Filter')}</Label>
                  <Select value={expiryFilter} onValueChange={setExpiryFilter}>
                    <SelectTrigger className="w-full min-h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('app.all')}</SelectItem>
                      <SelectItem value="expired">{t('inv.expired')}</SelectItem>
                      <SelectItem value="near">{t('inv.nearExpiry')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}\n`;

  if (c.includes(oldExpiryFilterBlock)) {
    c = c.replace(oldExpiryFilterBlock, '');
  }

  c = c.replace(/\n/g, '\r\n');
  fs.writeFileSync(p, c, 'utf8');
  console.log('✓ reports.tsx polished');
}

// 4. settings.tsx
{
  const p = path.join(screensDir, 'settings.tsx');
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

  const oldSweepFn = `  const { toast } = useToast()
  const [sweeping, setSweeping] = useState(false)
  const p = cfg.pos

  async function sweep() {
    setSweeping(true)
    try {
      const res = await api<{ updated?: number; swept?: number; count?: number }>('/inventory/expiry/sweep', {
        method: 'POST',
      })
      const n = res.updated ?? res.swept ?? res.count
      toast({
        title: L('تم تحديث حالات الصلاحية', 'Expiry sweep done'),
        description:
          n != null
            ? L(\`تم تعليم \${n} دفعة كمنتهية الصلاحية\`, \`\${n} batches marked expired\`)
            : L('تم تحديث حالات الدفعات', 'Batch statuses updated'),
      })
    } catch (e) {
      toast({ variant: 'destructive', title: L('تعذر التحديث', 'Sweep failed'), description: errMessage(e) })
    } finally {
      setSweeping(false)
    }
  }`;

  const newSweepFn = `  const p = cfg.pos`;

  if (c.includes(oldSweepFn)) {
    c = c.replace(oldSweepFn, newSweepFn);
  }

  c = c.replace(/\n/g, '\r\n');
  fs.writeFileSync(p, c, 'utf8');
  console.log('✓ settings.tsx polished');
}

// 5. inventory.tsx
{
  const p = path.join(screensDir, 'inventory.tsx');
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

  c = c.replace("import { movementTypeLabel, expiryState, daysLabel } from '../parts/labels'", "import { movementTypeLabel } from '../parts/labels'");
  c = c.replace('  stockExpired: number\n', '');
  c = c.replace('  nearestExpiry: string | null\n', '');
  c = c.replace('  expiryDate: string | null\n', '');
  c = c.replace("  'EXPIRY_WRITEOFF',\n", '');
  c = c.replace(/const EXPIRY_COLORS: Record<string, string> = \{[\s\S]*?\};\n/, '');
  c = c.replace('  const warningDays = status?.pos?.expiryWarningDays ?? 90\n', '');
  c = c.replace('                    const state = expiryState(b.expiryDate, warningDays)\n', '');
  c = c.replace('// Tab 2 — batches & expiry management', '// Tab 2 — batches overview');

  const oldSweepInTab2 = `  async function sweep() {
    setSweeping(true)
    try {
      const res = await api<{ updated: number }>('/inventory/expiry/sweep', { method: 'POST' })
      toast({
        title: t('inv.sweepDone'),
        description: res.updated > 0 ? \`تم تحويل \${res.updated} باتش إلى حالة "منتهي الصلاحية"\` : 'لا توجد باتشات جديدة لتغيير حالتها',
      })
      await load()
    } catch (e) {
      toast({ variant: 'destructive', title: 'تعذر تحديث الحالات', description: errMessage(e) })
    } finally {
      setSweeping(false)
    }
  }\n`;

  if (c.includes(oldSweepInTab2)) {
    c = c.replace(oldSweepInTab2, '');
  }
  c = c.replace('  const [sweeping, setSweeping] = useState(false)\n', '');

  c = c.replace(/\n/g, '\r\n');
  fs.writeFileSync(p, c, 'utf8');
  console.log('✓ inventory.tsx polished');
}

// 6. products.tsx
{
  const p = path.join(screensDir, 'products.tsx');
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

  c = c.replace("import { unitLabel, expiryState, daysLabel, movementTypeLabel } from '../parts/labels'", "import { unitLabel, movementTypeLabel } from '../parts/labels'");
  c = c.replace('  expiryDate: string | null\n', '');
  c = c.replace('  const warningDays = status?.pos?.expiryWarningDays ?? 90\n', '');
  c = c.replace('                    const state = expiryState(b.expiryDate, warningDays)\n', '');
  c = c.replace('                    const days = b.expiryDate ? daysUntil(b.expiryDate) : null\n', '');
  c = c.replace('<div className="flex flex-col" title={`إجمالي الكميات (شامل المنتهي): ${formatQty(row.stockTotal, row.isWeighable)}`}>', '<div className="flex flex-col" title={`إجمالي الكميات: ${formatQty(row.stockTotal, row.isWeighable)}`}>');

  c = c.replace(/\n/g, '\r\n');
  fs.writeFileSync(p, c, 'utf8');
  console.log('✓ products.tsx polished');
}
