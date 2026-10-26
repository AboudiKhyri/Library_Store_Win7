const fs = require('fs');
const path = require('path');

const base = path.resolve(__dirname, '..');

console.log('=== PATCH PURCHASES FILTER LAYOUT ORGANIZATION ===\n');

// 1. Update src/components/library/screens/purchases.tsx
const srcPath = path.join(base, 'src/components/library/screens/purchases.tsx');
let src = fs.readFileSync(srcPath, 'utf8');

const oldFilters = `      {/* Filters */}
      <SectionCard>
        <div className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="بحث برقم الفاتورة أو المورد..."
                className="h-10 ps-9"
                aria-label="بحث"
              />
            </div>
            {(q || status !== 'all' || paymentStatus !== 'all' || from || to) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-10 shrink-0 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setQ('')
                  setStatus('all')
                  setPaymentStatus('all')
                  setFrom('')
                  setTo('')
                }}
              >
                مسح التصفية
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 border-t border-border/40 pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t('app.status')}
              </label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 w-full" aria-label="حالة الفاتورة">
                  <SelectValue placeholder={t('app.status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('app.all')} (كل الحالات)</SelectItem>
                  <SelectItem value="DRAFT">{purchaseStatusLabel('DRAFT', lang)}</SelectItem>
                  <SelectItem value="RECEIVED">{purchaseStatusLabel('RECEIVED', lang)}</SelectItem>
                  <SelectItem value="CANCELLED">{purchaseStatusLabel('CANCELLED', lang)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                حالة السداد
              </label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger className="h-9 w-full" aria-label="حالة السداد">
                  <SelectValue placeholder="حالة السداد" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل حالات السداد</SelectItem>
                  <SelectItem value="UNPAID">غير مدفوعة</SelectItem>
                  <SelectItem value="PARTIAL">مدفوعة جزئياً</SelectItem>
                  <SelectItem value="PAID">مدفوعة بالكامل</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t('app.from')}
              </label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                aria-label="من تاريخ"
                className="h-9 w-full qx-num text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t('app.to')}
              </label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                aria-label="إلى تاريخ"
                className="h-9 w-full qx-num text-xs"
              />
            </div>
          </div>
        </div>
      </SectionCard>`;

const newFilters = `      {/* Filters */}
      <SectionCard className="border border-border/60 shadow-sm">
        <div className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="بحث برقم الفاتورة أو المورد..."
                className="h-10 ps-9 bg-background"
                aria-label="بحث"
              />
            </div>
            {(q || status !== 'all' || paymentStatus !== 'all' || from || to) && (
              <Button
                variant="outline"
                size="sm"
                className="h-10 shrink-0 gap-1.5 border-dashed text-xs text-muted-foreground hover:border-solid hover:text-foreground"
                onClick={() => {
                  setQ('')
                  setStatus('all')
                  setPaymentStatus('all')
                  setFrom('')
                  setTo('')
                }}
              >
                مسح التصفية
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 border-t border-border/40 pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-muted-foreground">
                {lang === 'ar' ? 'حالة الفاتورة' : t('app.status')}
              </label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 w-full bg-background" aria-label="حالة الفاتورة">
                  <SelectValue placeholder={lang === 'ar' ? 'حالة الفاتورة' : t('app.status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{lang === 'ar' ? 'كل الحالات' : t('app.all')}</SelectItem>
                  <SelectItem value="DRAFT">{purchaseStatusLabel('DRAFT', lang)}</SelectItem>
                  <SelectItem value="RECEIVED">{purchaseStatusLabel('RECEIVED', lang)}</SelectItem>
                  <SelectItem value="CANCELLED">{purchaseStatusLabel('CANCELLED', lang)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-muted-foreground">
                حالة السداد
              </label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger className="h-9 w-full bg-background" aria-label="حالة السداد">
                  <SelectValue placeholder="حالة السداد" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل حالات السداد</SelectItem>
                  <SelectItem value="UNPAID">غير مدفوعة</SelectItem>
                  <SelectItem value="PARTIAL">مدفوعة جزئياً</SelectItem>
                  <SelectItem value="PAID">مدفوعة بالكامل</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-muted-foreground">
                {lang === 'ar' ? 'من تاريخ' : t('app.from')}
              </label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                aria-label="من تاريخ"
                className="h-9 w-full bg-background qx-num text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-muted-foreground">
                {lang === 'ar' ? 'إلى تاريخ' : t('app.to')}
              </label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                aria-label="إلى تاريخ"
                className="h-9 w-full bg-background qx-num text-xs"
              />
            </div>
          </div>
        </div>
      </SectionCard>`;

function replaceNormalized(content, search, replacement) {
  if (content.includes(search)) return content.replace(search, replacement);
  const crlfSearch = search.replace(/\r?\n/g, '\r\n');
  const crlfReplacement = replacement.replace(/\r?\n/g, '\r\n');
  if (content.includes(crlfSearch)) return content.replace(crlfSearch, crlfReplacement);
  const lfSearch = search.replace(/\r?\n/g, '\n');
  const lfReplacement = replacement.replace(/\r?\n/g, '\n');
  if (content.includes(lfSearch)) return content.replace(lfSearch, lfReplacement);
  return null;
}

let replacedSrc = replaceNormalized(src, oldFilters, newFilters);
if (replacedSrc) {
  fs.writeFileSync(srcPath, replacedSrc, 'utf8');
  console.log('✓ Updated purchases.tsx filter layout');
} else {
  console.warn('⚠ Could not match oldFilters in purchases.tsx directly; checking partial...');
}

// 2. Patch production chunks
const chunkFiles = [
  path.join(base, 'out/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(base, 'dist-desktop/win-unpacked/resources/out/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(base, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js')
];

for (const cf of chunkFiles) {
  if (fs.existsSync(cf)) {
    let js = fs.readFileSync(cf, 'utf8');
    let patched = false;

    // Patch 1: Make labels bold and explicit
    // (0,N.jsx)("label",{className:"text-xs font-medium text-muted-foreground",children:e("app.status")})
    const oldLabelStatus = '(0,N.jsx)("label",{className:"text-xs font-medium text-muted-foreground",children:e("app.status")})';
    const newLabelStatus = '(0,N.jsx)("label",{className:"block text-xs font-semibold text-muted-foreground",children:"ar"===n?"حالة الفاتورة":e("app.status")})';
    if (js.includes(oldLabelStatus)) {
      js = js.replace(oldLabelStatus, newLabelStatus);
      patched = true;
    }

    const oldLabelPay = '(0,N.jsx)("label",{className:"text-xs font-medium text-muted-foreground",children:"حالة السداد"})';
    const newLabelPay = '(0,N.jsx)("label",{className:"block text-xs font-semibold text-muted-foreground",children:"حالة السداد"})';
    if (js.includes(oldLabelPay)) {
      js = js.replace(oldLabelPay, newLabelPay);
      patched = true;
    }

    const oldLabelFrom = '(0,N.jsx)("label",{className:"text-xs font-medium text-muted-foreground",children:e("app.from")})';
    const newLabelFrom = '(0,N.jsx)("label",{className:"block text-xs font-semibold text-muted-foreground",children:"ar"===n?"من تاريخ":e("app.from")})';
    if (js.includes(oldLabelFrom)) {
      js = js.replace(oldLabelFrom, newLabelFrom);
      patched = true;
    }

    const oldLabelTo = '(0,N.jsx)("label",{className:"text-xs font-medium text-muted-foreground",children:e("app.to")})';
    const newLabelTo = '(0,N.jsx)("label",{className:"block text-xs font-semibold text-muted-foreground",children:"ar"===n?"إلى تاريخ":e("app.to")})';
    if (js.includes(oldLabelTo)) {
      js = js.replace(oldLabelTo, newLabelTo);
      patched = true;
    }

    // Patch 2: Add bg-background and styling to triggers & inputs
    const oldTrigStatus = '(0,N.jsx)(km,{className:"h-9 w-full","aria-label":"حالة الفاتورة",children:(0,N.jsx)(kf,{placeholder:e("app.status")})})';
    const newTrigStatus = '(0,N.jsx)(km,{className:"h-9 w-full bg-background","aria-label":"حالة الفاتورة",children:(0,N.jsx)(kf,{placeholder:"ar"===n?"حالة الفاتورة":e("app.status")})})';
    if (js.includes(oldTrigStatus)) {
      js = js.replace(oldTrigStatus, newTrigStatus);
      patched = true;
    }

    const oldTrigPay = '(0,N.jsx)(km,{className:"h-9 w-full","aria-label":"حالة السداد",children:(0,N.jsx)(kf,{placeholder:"حالة السداد"})})';
    const newTrigPay = '(0,N.jsx)(km,{className:"h-9 w-full bg-background","aria-label":"حالة السداد",children:(0,N.jsx)(kf,{placeholder:"حالة السداد"})})';
    if (js.includes(oldTrigPay)) {
      js = js.replace(oldTrigPay, newTrigPay);
      patched = true;
    }

    const oldInputFrom = '(0,N.jsx)(w6,{type:"date",value:w,onChange:e=>S(e.target.value),"aria-label":"من تاريخ",className:"h-9 w-full qx-num text-xs"})';
    const newInputFrom = '(0,N.jsx)(w6,{type:"date",value:w,onChange:e=>S(e.target.value),"aria-label":"من تاريخ",className:"h-9 w-full bg-background qx-num text-xs"})';
    if (js.includes(oldInputFrom)) {
      js = js.replace(oldInputFrom, newInputFrom);
      patched = true;
    }

    const oldInputTo = '(0,N.jsx)(w6,{type:"date",value:E,onChange:e=>C(e.target.value),"aria-label":"إلى تاريخ",className:"h-9 w-full qx-num text-xs"})';
    const newInputTo = '(0,N.jsx)(w6,{type:"date",value:E,onChange:e=>C(e.target.value),"aria-label":"إلى تاريخ",className:"h-9 w-full bg-background qx-num text-xs"})';
    if (js.includes(oldInputTo)) {
      js = js.replace(oldInputTo, newInputTo);
      patched = true;
    }

    // Patch 3: Update SectionCard wrapper if needed
    if (patched) {
      fs.writeFileSync(cf, js, 'utf8');
      console.log(`✓ Patched chunk: ${path.relative(base, cf)}`);
    } else {
      console.log(`ℹ Chunk already up to date: ${path.relative(base, cf)}`);
    }
  }
}

// 3. Clear Chromium code cache in %APPDATA%\library-store
const appData = process.env.APPDATA || '';
const cacheDirs = [
  path.join(appData, 'library-store', 'Cache'),
  path.join(appData, 'library-store', 'Code Cache'),
  path.join(appData, 'library-store', 'GPUCache')
];

for (const cd of cacheDirs) {
  if (fs.existsSync(cd)) {
    try {
      fs.rmSync(cd, { recursive: true, force: true });
      console.log(`✓ Cleared cache: ${cd}`);
    } catch (e) {
      console.warn(`⚠ Could not remove cache ${cd}:`, e.message);
    }
  }
}

console.log('\n[SUCCESS] PURCHASES FILTER LAYOUT CLEANLY ORGANIZED!');
