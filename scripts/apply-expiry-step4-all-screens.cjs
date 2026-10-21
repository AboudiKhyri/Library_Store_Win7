/**
 * Forensic script to update all UI screens:
 * 1. dashboard.tsx
 * 2. returns.tsx
 * 3. sales-history.tsx
 * 4. stocktake.tsx
 * 5. products.tsx
 * 6. purchases.tsx
 * 7. reports.tsx
 * 8. settings.tsx
 * 9. pos.tsx
 * 10. inventory.tsx
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const screensDir = path.join(root, 'src', 'components', 'library', 'screens');

// 1. dashboard.tsx
{
  const p = path.join(screensDir, 'dashboard.tsx');
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

  const oldStrip = `      {/* expiry alert strip */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('dash.nearExpiry')} value={data.nearExpiryCount} icon={<Timer className="h-5 w-5" />} tone={data.nearExpiryCount > 0 ? 'warning' : 'default'} onClick={() => setView('inventory')} />
        <StatCard label={t('dash.expired')} value={data.expiredCount} icon={<CalendarX className="h-5 w-5" />} tone={data.expiredCount > 0 ? 'danger' : 'success'} onClick={() => setView('inventory')} />
        <StatCard label={t('dash.purchaseActivity')} value={data.monthPurchaseCount} icon={<Truck className="h-5 w-5" />} hint={money(data.monthPurchases)} onClick={() => setView('purchases')} />
        <StatCard label={t('dash.avgTransaction')} value={money(data.avgTransaction)} icon={<TrendingUp className="h-5 w-5" />} />
      </div>`;

  const newStrip = `      {/* activity strip */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label={t('dash.purchaseActivity')} value={data.monthPurchaseCount} icon={<Truck className="h-5 w-5" />} hint={money(data.monthPurchases)} onClick={() => setView('purchases')} />
        <StatCard label={t('dash.avgTransaction')} value={money(data.avgTransaction)} icon={<TrendingUp className="h-5 w-5" />} />
      </div>`;

  if (!c.includes(oldStrip)) {
    console.error('Error: oldStrip not found in dashboard.tsx');
    process.exit(1);
  }
  c = c.replace(oldStrip, newStrip);
  c = c.replace(/\n/g, '\r\n');
  fs.writeFileSync(p, c, 'utf8');
  console.log('✓ dashboard.tsx updated');
}

// 2. returns.tsx
{
  const p = path.join(screensDir, 'returns.tsx');
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

  c = c.replace('                      <th className="px-3 py-2 text-start font-medium">الصلاحية</th>\n', '');
  c = c.replace(
    '                          <td className="px-3 py-2 text-xs text-muted-foreground">\n                            {i.expiryDate ? fmtDate(i.expiryDate) : \'—\'}\n                          </td>\n',
    ''
  );

  c = c.replace(/\n/g, '\r\n');
  fs.writeFileSync(p, c, 'utf8');
  console.log('✓ returns.tsx updated');
}

// 3. sales-history.tsx
{
  const p = path.join(screensDir, 'sales-history.tsx');
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

  c = c.replace('                      <th className="px-3 py-2 text-start font-medium">الصلاحية</th>\n', '');
  c = c.replace(
    '                        <td className="px-3 py-2 text-xs text-muted-foreground">\n                          {i.expiryDate ? fmtDate(i.expiryDate) : \'—\'}\n                        </td>\n',
    ''
  );

  c = c.replace(/\n/g, '\r\n');
  fs.writeFileSync(p, c, 'utf8');
  console.log('✓ sales-history.tsx updated');
}

// 4. stocktake.tsx
{
  const p = path.join(screensDir, 'stocktake.tsx');
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

  c = c.replace(
    'التخصيص الآمن <span className="font-semibold">FEFO</span> (استهلاك الباتشات الأقرب انتهاءً أولاً)',
    'التخصيص الآمن <span className="font-semibold">FIFO</span> (استهلاك الباتشات الأقدم وصولاً أولاً)'
  );

  c = c.replace(/\n/g, '\r\n');
  fs.writeFileSync(p, c, 'utf8');
  console.log('✓ stocktake.tsx updated');
}

// 5. products.tsx
{
  const p = path.join(screensDir, 'products.tsx');
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

  c = c.replace(
    'استلم الباتشات من فواتير الشراء — يتم إنشاؤها تلقائياً عند الاستلام ويُصرف المخزون بنظام FEFO.',
    'استلم الباتشات من فواتير الشراء — يتم إنشاؤها تلقائياً عند الاستلام ويُصرف المخزون بنظام FIFO.'
  );
  c = c.replace(
    '                    <th className="px-3 py-2 text-start font-medium">تاريخ الانتهاء</th>\n',
    ''
  );

  const oldBatchRowExpiry = `                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-0.5">
                            <StatusBadge
                              status={state}
                              label={state === 'EXPIRED' ? 'منتهي' : state === 'NEAR' ? 'قريب الانتهاء' : 'ساري'}
                            />
                            {b.expiryDate && (
                              <span className="text-[10px] text-muted-foreground">
                                {fmtDate(b.expiryDate)} · {daysLabel(days ?? 0, 'ar')}
                              </span>
                            )}
                          </div>
                        </td>\n`;

  if (c.includes(oldBatchRowExpiry)) {
    c = c.replace(oldBatchRowExpiry, '');
  }

  c = c.replace('+{formatQty(unavailable, row.isWeighable)} شامل المنتهي', '+{formatQty(unavailable, row.isWeighable)} غير متاح');
  c = c.replace("EXPIRED: 'منتهي الصلاحية',\n", '');

  c = c.replace(/\n/g, '\r\n');
  fs.writeFileSync(p, c, 'utf8');
  console.log('✓ products.tsx updated');
}

// 6. purchases.tsx
{
  const p = path.join(screensDir, 'purchases.tsx');
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

  c = c.replace(
    '<DialogDescription>اختر المورد والأصناف — حدد رقم الباتش وتاريخ الانتهاء لكل صنف لتتبعه لاحقاً</DialogDescription>',
    '<DialogDescription>اختر المورد والأصناف — حدد رقم الباتش والكميات لتتبع التكلفة والمخزون</DialogDescription>'
  );

  const oldExpiryInput = `                    <div>
                      <Label className="text-xs">
                        {t('purchases.expiry')} <span className="text-muted-foreground/60">({t('app.optional')})</span>
                      </Label>
                      <Input
                        type="date"
                        className="mt-1"
                        value={it.expiryDate}
                        onChange={(e) => updateItem(i, { expiryDate: e.target.value })}
                      />
                    </div>`;

  if (c.includes(oldExpiryInput)) {
    c = c.replace(oldExpiryInput, '');
  }

  c = c.replace('                    <th className="px-3 py-2 text-start font-medium">{t(\'purchases.expiry\')}</th>\n', '');
  c = c.replace('                    <td className="px-3 py-2 text-xs">{it.expiryDate ? fmtDate(it.expiryDate) : \'—\'}</td>\n', '');

  c = c.replace(/\n/g, '\r\n');
  fs.writeFileSync(p, c, 'utf8');
  console.log('✓ purchases.tsx updated');
}

// 7. reports.tsx
{
  const p = path.join(screensDir, 'reports.tsx');
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

  c = c.replace(
    "  { id: 'expiry', ar: 'تقرير الصلاحية', en: 'Expiry Report', icon: CalendarClock, snapshot: true, expiryFilter: true },\n",
    ""
  );

  const oldReportsExpiryDef = `  expiry: [
    { key: 'expiredCount', ar: 'دفعات منتهية', en: 'Expired batches', tone: 'danger' },
    { key: 'nearCount', ar: 'دفعات قريبة الانتهاء', en: 'Near expiry', tone: 'warning' },
    { key: 'expiredValue', ar: 'قيمة المنتهية', en: 'Expired value', money: true },
    { key: 'nearValue', ar: 'قيمة القريبة من الانتهاء', en: 'Near expiry value', money: true },
  ],\n`;

  if (c.includes(oldReportsExpiryDef)) {
    c = c.replace(oldReportsExpiryDef, '');
  }

  c = c.replace("      { key: 'stockExpired', header: t('inv.expired'), render: (r) => <span className={Number(r.stockExpired) > 0 ? 'font-semibold text-[var(--danger)] tabular-nums' : 'tabular-nums'}>{Number(r.stockExpired ?? 0).toLocaleString('en-US')}</span> },\n", '');

  // Remove case 'expiry'
  const oldExpiryCase = `      case 'expiry':
        return [
          { key: 'productName', header: t('nav.products'), render: (r) => <span className="font-semibold">{r.productName as string}</span> },
          { key: 'sku', header: 'SKU', render: (r) => <span className="font-mono text-xs text-muted-foreground qx-num" dir="ltr">{r.sku as string}</span> },
          { key: 'batchNo', header: t('inv.batchNo'), render: (r) => <span className="font-mono text-xs font-semibold qx-num" dir="ltr">{r.batchNo as string}</span> },
          { key: 'expiryDate', header: t('inv.expiryDate'), render: (r) => fmtDate(r.expiryDate as string) },
          { key: 'quantity', header: t('app.quantity'), render: (r) => <span className="font-bold tabular-nums">{Number(r.quantity ?? 0).toLocaleString('en-US')}</span> },
          { key: 'costPrice', header: t('inv.cost'), render: (r) => <span className="tabular-nums">{money(Number(r.costPrice ?? 0))}</span> },
          { key: 'value', header: t('inv.value'), render: (r) => <span className="font-semibold tabular-nums">{money(Number(r.value ?? 0))}</span>, headerClassName: 'text-end', className: 'text-end' },
          {
            key: 'state',
            header: t('app.status'),
            render: (r) => {
              const st = (r.state as string) || 'VALID'
              const lbl = (EXPIRY_STATE_LABEL[st] ?? [st, st])[lang === 'ar' ? 0 : 1]
              const tone = st === 'EXPIRED' ? 'border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)]' : st === 'NEAR' ? 'border-[var(--warning)]/30 bg-[var(--warning)]/10 text-[var(--warning)]' : 'border-border bg-muted text-muted-foreground'
              return <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', tone)}>{lbl}</span>
            },
          },
        ]\n`;

  if (c.includes(oldExpiryCase)) {
    c = c.replace(oldExpiryCase, '');
  }

  // Remove expiryFilter select dropdown
  const oldExpirySelect = `            {def.expiryFilter && (
              <div className="w-full sm:w-44">
                <Label className="text-xs text-muted-foreground">{t('app.status')}</Label>
                <Select value={expiryFilter} onValueChange={setExpiryFilter}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('app.all')}</SelectItem>
                    <SelectItem value="expired">{t('inv.expired')}</SelectItem>
                    <SelectItem value="near">{t('inv.nearExpiry')}</SelectItem>
                    <SelectItem value="valid">{t('inv.valid')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}`;

  if (c.includes(oldExpirySelect)) {
    c = c.replace(oldExpirySelect, '');
  }

  c = c.replace(/\n/g, '\r\n');
  fs.writeFileSync(p, c, 'utf8');
  console.log('✓ reports.tsx updated');
}

// 8. settings.tsx
{
  const p = path.join(screensDir, 'settings.tsx');
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

  c = c.replace(
    "description={L('العملة والخصومات والصلاحية وطرق الدفع', 'Currency, discounts, expiry and payment methods')}",
    "description={L('العملة والخصومات وطرق الدفع', 'Currency, discounts and payment methods')}"
  );

  const oldNumField = `        <NumField
          label={L('تنبيه قرب الانتهاء (أيام)', 'Expiry warning (days)')}
          value={p.expiryWarningDays}
          min={1}
          max={365}
          onChange={(v) => setPos({ expiryWarningDays: v })}
          hint={L('يُستخدم في تلوين الأصناف وتقرير الصلاحية', 'Drives item highlighting and the expiry report')}
        />\n`;

  if (c.includes(oldNumField)) {
    c = c.replace(oldNumField, '');
  }

  const oldAllowExpired = `      <div className="mt-4 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/5 p-4" role="alert">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
            <div>
              <p className="text-sm font-bold text-[var(--danger)]">
                {L('السماح ببيع الأصناف منتهية الصلاحية', 'Allow selling expired items')}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {L(
                  'غير مستحسن — يسمح لنقطة البيع بخصم الكميات من دفعات منتهية الصلاحية رغم التحذير.',
                  'Not recommended — lets POS allocate from expired batches despite warnings.'
                )}
              </p>
            </div>
          </div>
          <Switch
            checked={p.allowSellingExpired}
            onCheckedChange={(v) => setPos({ allowSellingExpired: v })}
            aria-label={L('السماح ببيع المنتهي', 'Allow expired')}
          />
        </div>
      </div>\n`;

  if (c.includes(oldAllowExpired)) {
    c = c.replace(oldAllowExpired, '');
  }

  const oldInfoTile = `          <InfoTile
            label={L('تنبيه قرب الانتهاء (أيام)', 'Expiry warning (days)')}
            value={<span className="tabular-nums">{p.expiryWarningDays}</span>}
          />\n`;

  if (c.includes(oldInfoTile)) {
    c = c.replace(oldInfoTile, '');
  }

  // Remove sweep section from inventory settings
  const oldSweepSection = `      <SectionCard
        title={L('تحديث حالات الصلاحية', 'Expiry sweep')}
        description={L(
          'تعليم الدفعات التي تجاوزت تاريخ انتهائها كمنتهية الصلاحية لتستبعدها من البيع',
          'Marks batches past expiry as EXPIRED so FEFO selling excludes them'
        )}
        actions={
          <Button size="sm" onClick={() => void sweep()} disabled={sweeping || !canSweep} className="min-h-11 sm:min-h-9">
            {sweeping ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <RefreshCw className="me-2 h-4 w-4" />}
            {L('تحديث حالات الصلاحية', 'Run sweep')}
          </Button>
        }
      >
        <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-4">
          <Boxes className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {L(
              'يفحص النظام الصلاحية تلقائياً عند الإقلاع، لكن يمكنك تشغيل الفحص يدوياً بعد تعديل تواريخ الدفعات أو استيراد بيانات. الدفعات المنتهية لا تُحذف — تُستبعد من التوزيع (FEFO) ويمكن إعدامها لاحقاً من شاشة المخزون.',
              'The engine sweeps expired batches on boot, but you can run it manually after editing batch dates or importing data. Expired batches are never deleted — they are excluded from FEFO allocation and can be written off from the inventory screen.'
            )}
          </p>
        </div>
        {!canSweep && (
          <p className="mt-2 text-xs text-[var(--warning)]">
            {L('تشغيل الفحص يتطلب صلاحية تعديل المخزون (INVENTORY_ADJUST).', 'Running the sweep requires INVENTORY_ADJUST permission.')}
          </p>
        )}
      </SectionCard>\n`;

  if (c.includes(oldSweepSection)) {
    c = c.replace(oldSweepSection, '');
  }

  c = c.replace(/\n/g, '\r\n');
  fs.writeFileSync(p, c, 'utf8');
  console.log('✓ settings.tsx updated');
}

// 9. pos.tsx
{
  const p = path.join(screensDir, 'pos.tsx');
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

  c = c.replace(
    '// FEFO batch allocation server-side, suspend/resume carts, thermal receipt.',
    '// FIFO batch allocation server-side, suspend/resume carts, thermal receipt.'
  );

  const oldPosBadges = `                  {avail <= 0 && product.hasExpiredStock && (
                    <span className="rounded bg-[var(--danger)]/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--danger)]">
                      منتهي
                    </span>
                  )}
                  {nearExpiry && avail > 0 && (
                    <span className="rounded bg-[var(--warning)]/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--warning)]">
                      قاربت الصلاحية
                    </span>
                  )}`;

  if (c.includes(oldPosBadges)) {
    c = c.replace(oldPosBadges, '');
  }

  c = c.replace(/\n/g, '\r\n');
  fs.writeFileSync(p, c, 'utf8');
  console.log('✓ pos.tsx updated');
}

// 10. inventory.tsx
{
  const p = path.join(screensDir, 'inventory.tsx');
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

  c = c.replace(
    '// Tab 1: current stock overview · Tab 2: batches & expiry management · Tab 3: movement ledger',
    '// Tab 1: current stock overview · Tab 2: batches overview · Tab 3: movement ledger'
  );
  c = c.replace("description={t('inv.fefo')}", "description={t('inv.fifo')}");
  c = c.replace('الباتشات والصلاحية', 'الباتشات');

  // Remove stockExpired and nearestExpiry from columns
  const oldStockExpiredCol = `    {
      key: 'stockExpired',
      header: t('inv.expired'),
      render: (r) =>
        r.stockExpired > 0 ? (
          <span className="inline-flex items-center rounded-md border border-[var(--danger)]/25 bg-[var(--danger)]/12 px-2 py-0.5 text-[11px] font-bold text-[var(--danger)] tabular-nums">
            {r.stockExpired}
          </span>
        ) : (
          <span className="text-muted-foreground tabular-nums">0</span>
        ),
    },\n`;

  if (c.includes(oldStockExpiredCol)) {
    c = c.replace(oldStockExpiredCol, '');
  }

  const oldNearestExpiryCol = `    {
      key: 'nearestExpiry',
      header: t('inv.expiryDate'),
      render: (r) => {
        if (!r.nearestExpiry) return <span className="text-muted-foreground">—</span>
        const state = expiryState(r.nearestExpiry, warningDays)
        return (
          <div className={cn('whitespace-nowrap text-xs', EXPIRY_COLORS[state])}>
            <p>{fmtDate(r.nearestExpiry)}</p>
            <p className="text-[10px]">{daysLabel(daysUntil(r.nearestExpiry), 'ar')}</p>
          </div>
        )
      },
    },\n`;

  if (c.includes(oldNearestExpiryCol)) {
    c = c.replace(oldNearestExpiryCol, '');
  }

  // Remove expired/near chips in tab 1
  const oldTab1Chips = `            <Chip active={filter === 'expired'} tone="danger" onClick={() => setFilter(filter === 'expired' ? '' : 'expired')}>
              <CalendarX className="h-3.5 w-3.5" />
              {t('inv.expired')}
            </Chip>
            <Chip active={filter === 'near'} tone="warning" onClick={() => setFilter(filter === 'near' ? '' : 'near')}>
              <Timer className="h-3.5 w-3.5" />
              {t('inv.nearExpiry')}
            </Chip>\n`;

  if (c.includes(oldTab1Chips)) {
    c = c.replace(oldTab1Chips, '');
  }

  // Remove expiryDate column from product batches modal
  c = c.replace('                    <th className="px-3 py-2 text-start font-medium">{t(\'inv.expiryDate\')}</th>\n', '');
  const oldProductBatchesExpiryTd = `                        <td className={cn('whitespace-nowrap px-3 py-2 text-xs', EXPIRY_COLORS[state])}>
                          {b.expiryDate ? (
                            <>
                              <p>{fmtDate(b.expiryDate)}</p>
                              {b.daysLeft !== null && <p className="text-[10px]">{daysLabel(b.daysLeft, 'ar')}</p>}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>\n`;

  if (c.includes(oldProductBatchesExpiryTd)) {
    c = c.replace(oldProductBatchesExpiryTd, '');
  }

  // In Tab 2: remove expiryDate column
  const oldTab2ExpiryCol = `    {
      key: 'expiryDate',
      header: t('inv.expiryDate'),
      render: (r) => {
        if (!r.expiryDate || r.daysLeft === null) return <span className="text-muted-foreground">بدون تاريخ</span>
        const state = expiryState(r.expiryDate, warningDays)
        return (
          <div className={cn('whitespace-nowrap', EXPIRY_COLORS[state])}>
            <p className="text-xs font-medium">{fmtDate(r.expiryDate)}</p>
            <p className="text-[10px]">{daysLabel(r.daysLeft, 'ar')}</p>
          </div>
        )
      },
    },\n`;

  if (c.includes(oldTab2ExpiryCol)) {
    c = c.replace(oldTab2ExpiryCol, '');
  }

  // In Tab 2: update summary strip
  const oldTab2Summary = `      {/* summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryStat label={t('inv.expired')} value={stats.expired} tone="danger" icon={<CalendarX className="h-4 w-4" />} />
        <SummaryStat label={t('inv.nearExpiry')} value={stats.near} tone="warning" icon={<Timer className="h-4 w-4" />} />
        <SummaryStat label={t('inv.valid')} value={stats.valid} tone="success" icon={<ShieldAlert className="h-4 w-4" />} />
      </div>`;

  const newTab2Summary = `      {/* summary strip */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryStat label="الباتشات النشطة" value={stats.valid} tone="success" icon={<ShieldAlert className="h-4 w-4" />} />
        <SummaryStat label="المستنفدة" value={stats.depleted ?? 0} tone="default" icon={<Boxes className="h-4 w-4" />} />
      </div>`;

  if (c.includes(oldTab2Summary)) {
    c = c.replace(oldTab2Summary, newTab2Summary);
  }

  // In Tab 2: remove expired/near chips and sweep button
  const oldTab2FilterChips = `            <Chip active={filter === 'expired'} tone="danger" onClick={() => setFilter(filter === 'expired' ? '' : 'expired')}>
              {t('inv.expired')}
            </Chip>
            <Chip active={filter === 'near'} tone="warning" onClick={() => setFilter(filter === 'near' ? '' : 'near')}>
              {t('inv.nearExpiry')}
            </Chip>
            <Chip active={filter === 'valid'} onClick={() => setFilter(filter === 'valid' ? '' : 'valid')}>
              {t('inv.valid')}
            </Chip>
            <Chip active={filter === 'depleted'} onClick={() => setFilter(filter === 'depleted' ? '' : 'depleted')}>
              مستنفد
            </Chip>
            {has('INVENTORY_ADJUST') && (
              <Button variant="outline" size="sm" className="h-9" disabled={sweeping} onClick={() => void sweep()}>
                {sweeping ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <RefreshCw className="me-2 h-4 w-4" />}
                {t('inv.sweep')}
              </Button>
            )}`;

  const newTab2FilterChips = `            <Chip active={filter === 'active' || filter === 'valid'} onClick={() => setFilter(filter === 'active' ? '' : 'active')}>
              النشطة
            </Chip>
            <Chip active={filter === 'depleted'} onClick={() => setFilter(filter === 'depleted' ? '' : 'depleted')}>
              المستنفدة
            </Chip>`;

  if (c.includes(oldTab2FilterChips)) {
    c = c.replace(oldTab2FilterChips, newTab2FilterChips);
  }

  // Remove EXPIRY_WRITEOFF from adjustments modal
  c = c.replace('              <SelectItem value="EXPIRY_WRITEOFF">{movementTypeLabel(\'EXPIRY_WRITEOFF\', lang)}</SelectItem>\n', '');
  c = c.replace('{t(\'inv.expiryDate\')}: {batch.expiryDate ? fmtDate(batch.expiryDate) : \'—\'}\n', '');

  c = c.replace(/\n/g, '\r\n');
  fs.writeFileSync(p, c, 'utf8');
  console.log('✓ inventory.tsx updated');
}
