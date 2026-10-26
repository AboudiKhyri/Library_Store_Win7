/**
 * scripts/patch-product-dialog-fields.cjs
 *
 * Implements user requirements:
 * 1. Add note next to Reorder Level: "(إشعار بأن هذا الصنف انخفض من المخزون)"
 * 2. Remove the two input boxes for "الشركة المنتجة" (Manufacturer) and "أقل سعر بيع" (Min Selling Price)
 *    in the Product Dialog.
 *
 * Updates:
 * - src/components/library/screens/products.tsx
 * - out/_next/static/chunks/18yoqc7d05wnq.js
 * - dist-desktop/win-unpacked/resources/out
 * - dist-desktop/win-unpacked/resources/client
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');

console.log('=== PATCHING PRODUCT DIALOG FIELDS (REORDER NOTE & REMOVE MANUFACTURER/MIN PRICE) ===\n');

// 1. Update src/components/library/screens/products.tsx
const productsSrcPath = path.join(root, 'src/components/library/screens/products.tsx');
if (!fs.existsSync(productsSrcPath)) {
  console.error(`[FATAL] File not found: ${productsSrcPath}`);
  process.exit(1);
}

let srcCode = fs.readFileSync(productsSrcPath, 'utf8');

// Target A in src: generic + manufacturer
const oldGenericManuPattern = `<div className="space-y-1.5">
            <Label htmlFor="pf-generic">
              {t('products.generic')} <span className="text-muted-foreground">({t('app.optional')})</span>
            </Label>
            <Input
              id="pf-generic"
              value={form.genericName}
              onChange={(e) => set('genericName', e.target.value)}
              placeholder="النوع / التفصيل — مثل: فاخر"
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-manufacturer">
              {t('products.manufacturer')} <span className="text-muted-foreground">({t('app.optional')})</span>
            </Label>
            <Input id="pf-manufacturer" value={form.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} dir="auto" />
          </div>`;

const newGenericOnly = `<div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pf-generic">
              {t('products.generic')} <span className="text-muted-foreground">({t('app.optional')})</span>
            </Label>
            <Input
              id="pf-generic"
              value={form.genericName}
              onChange={(e) => set('genericName', e.target.value)}
              placeholder="النوع / التفصيل — مثل: فاخر"
              dir="auto"
            />
          </div>`;

// Target B in src: reorder level
const oldReorderPattern = `<div className="space-y-1.5">
            <Label htmlFor="pf-reorder">{t('products.reorderLevel')}</Label>
            <Input
              id="pf-reorder"
              value={form.reorderLevel}
              onChange={(e) => set('reorderLevel', e.target.value)}
              className={numInputCls}
              inputMode="numeric"
            />
          </div>`;

const newReorderPattern = `<div className="space-y-1.5">
            <Label htmlFor="pf-reorder">
              {t('products.reorderLevel')}{' '}
              <span className="text-[11px] font-normal text-muted-foreground">
                ({isAr ? 'إشعار بأن هذا الصنف انخفض من المخزون' : 'alert when stock is low'})
              </span>
            </Label>
            <Input
              id="pf-reorder"
              value={form.reorderLevel}
              onChange={(e) => set('reorderLevel', e.target.value)}
              className={numInputCls}
              inputMode="numeric"
            />
          </div>`;

// Target C in src: minSellingPrice
const oldMinPricePattern = `<div className="space-y-1.5">
            <Label htmlFor="pf-min">
              {t('products.minPrice')} <span className="text-muted-foreground">({t('app.optional')})</span>
            </Label>
            <Input
              id="pf-min"
              value={form.minSellingPrice}
              onChange={(e) => set('minSellingPrice', e.target.value)}
              className={numInputCls}
              inputMode="decimal"
            />
          </div>`;

// Target D in src: active span
const oldActivePattern = `<div className="flex items-center justify-between rounded-xl border px-3 py-2.5 sm:col-span-1">`;
const newActivePattern = `<div className="flex items-center justify-between rounded-xl border px-3 py-2.5 sm:col-span-2">`;

// Handle CRLF vs LF
function normalizeNewlines(str) {
  return str.replace(/\r\n/g, '\n');
}

let normSrc = normalizeNewlines(srcCode);
let srcChanged = false;

if (normSrc.includes(normalizeNewlines(oldGenericManuPattern))) {
  normSrc = normSrc.replace(normalizeNewlines(oldGenericManuPattern), normalizeNewlines(newGenericOnly));
  srcChanged = true;
  console.log('✓ Removed pf-manufacturer and expanded pf-generic to sm:col-span-2 in src');
} else if (normSrc.includes(normalizeNewlines(newGenericOnly))) {
  console.log('✓ pf-generic already updated in src');
} else {
  console.warn('! Warning: oldGenericManuPattern not found in src');
}

if (normSrc.includes(normalizeNewlines(oldReorderPattern))) {
  normSrc = normSrc.replace(normalizeNewlines(oldReorderPattern), normalizeNewlines(newReorderPattern));
  srcChanged = true;
  console.log('✓ Added reorder note in src');
} else if (normSrc.includes(normalizeNewlines(newReorderPattern))) {
  console.log('✓ reorder note already in src');
} else {
  console.warn('! Warning: oldReorderPattern not found in src');
}

if (normSrc.includes(normalizeNewlines(oldMinPricePattern))) {
  normSrc = normSrc.replace(normalizeNewlines(oldMinPricePattern) + '\n          ', '');
  srcChanged = true;
  console.log('✓ Removed pf-min in src');
} else if (!normSrc.includes('id="pf-min"')) {
  console.log('✓ pf-min already removed in src');
} else {
  console.warn('! Warning: oldMinPricePattern not found in src');
}

if (normSrc.includes(normalizeNewlines(oldActivePattern))) {
  normSrc = normSrc.replace(normalizeNewlines(oldActivePattern), normalizeNewlines(newActivePattern));
  srcChanged = true;
  console.log('✓ Updated pf-active to sm:col-span-2 in src');
}

if (srcChanged) {
  // Preserve CRLF if original had CRLF
  const outCode = srcCode.includes('\r\n') ? normSrc.replace(/\n/g, '\r\n') : normSrc;
  fs.writeFileSync(productsSrcPath, outCode, 'utf8');
  console.log('✓ Saved src/components/library/screens/products.tsx');
}

// 2. Update out/_next/static/chunks/18yoqc7d05wnq.js
const chunkPath = path.join(root, 'out/_next/static/chunks/18yoqc7d05wnq.js');
let chunkCode = fs.readFileSync(chunkPath, 'utf8');

const tGenericManufacturer = '(0,N.jsxs)("div",{className:"space-y-1.5",children:[(0,N.jsxs)(w9,{htmlFor:"pf-generic",children:[s("products.generic")," ",(0,N.jsxs)("span",{className:"text-muted-foreground",children:["(",s("app.optional"),")"]})]}),(0,N.jsx)(w6,{id:"pf-generic",value:c.genericName,onChange:e=>x("genericName",e.target.value),placeholder:"النوع / التفصيل — مثل: فاخر",dir:"ltr"})]}),(0,N.jsxs)("div",{className:"space-y-1.5",children:[(0,N.jsxs)(w9,{htmlFor:"pf-manufacturer",children:[s("products.manufacturer")," ",(0,N.jsxs)("span",{className:"text-muted-foreground",children:["(",s("app.optional"),")"]})]}),(0,N.jsx)(w6,{id:"pf-manufacturer",value:c.manufacturer,onChange:e=>x("manufacturer",e.target.value),dir:"auto"})]})';

const newGenericOnlyChunk = '(0,N.jsxs)("div",{className:"space-y-1.5 sm:col-span-2",children:[(0,N.jsxs)(w9,{htmlFor:"pf-generic",children:[s("products.generic")," ",(0,N.jsxs)("span",{className:"text-muted-foreground",children:["(",s("app.optional"),")"]})]}),(0,N.jsx)(w6,{id:"pf-generic",value:c.genericName,onChange:e=>x("genericName",e.target.value),placeholder:"النوع / التفصيل — مثل: فاخر",dir:"auto"})]})';

const tReorder = '(0,N.jsxs)("div",{className:"space-y-1.5",children:[(0,N.jsx)(w9,{htmlFor:"pf-reorder",children:s("products.reorderLevel")}),(0,N.jsx)(w6,{id:"pf-reorder",value:c.reorderLevel,onChange:e=>x("reorderLevel",e.target.value),className:v,inputMode:"numeric"})]})';

const newReorderChunk = '(0,N.jsxs)("div",{className:"space-y-1.5",children:[(0,N.jsxs)(w9,{htmlFor:"pf-reorder",children:[s("products.reorderLevel")," ",(0,N.jsx)("span",{className:"text-[11px] font-normal text-muted-foreground",children:o==="ar"?"(إشعار بأن هذا الصنف انخفض من المخزون)":"(alert when stock is low)"})]}),(0,N.jsx)(w6,{id:"pf-reorder",value:c.reorderLevel,onChange:e=>x("reorderLevel",e.target.value),className:v,inputMode:"numeric"})]})';

const tMin = '(0,N.jsxs)("div",{className:"space-y-1.5",children:[(0,N.jsxs)(w9,{htmlFor:"pf-min",children:[s("products.minPrice")," ",(0,N.jsxs)("span",{className:"text-muted-foreground",children:["(",s("app.optional"),")"]})]}),(0,N.jsx)(w6,{id:"pf-min",value:c.minSellingPrice,onChange:e=>x("minSellingPrice",e.target.value),className:v,inputMode:"decimal"})]}),';

const tActive = 'className:"flex items-center justify-between rounded-xl border px-3 py-2.5 sm:col-span-1"';
const newActiveChunk = 'className:"flex items-center justify-between rounded-xl border px-3 py-2.5 sm:col-span-2"';

let chunkChanged = false;

if (chunkCode.includes(tGenericManufacturer)) {
  chunkCode = chunkCode.replace(tGenericManufacturer, newGenericOnlyChunk);
  chunkChanged = true;
  console.log('✓ Replaced pf-generic/pf-manufacturer in chunk');
} else if (chunkCode.includes(newGenericOnlyChunk)) {
  console.log('✓ pf-generic already updated in chunk');
} else {
  console.error('[FATAL] tGenericManufacturer not found in chunk!');
  process.exit(1);
}

if (chunkCode.includes(tReorder)) {
  chunkCode = chunkCode.replace(tReorder, newReorderChunk);
  chunkChanged = true;
  console.log('✓ Replaced pf-reorder in chunk with note');
} else if (chunkCode.includes(newReorderChunk)) {
  console.log('✓ pf-reorder already updated in chunk');
} else {
  console.error('[FATAL] tReorder not found in chunk!');
  process.exit(1);
}

if (chunkCode.includes(tMin)) {
  chunkCode = chunkCode.replace(tMin, '');
  chunkChanged = true;
  console.log('✓ Removed pf-min in chunk');
} else if (!chunkCode.includes('id:"pf-min"')) {
  console.log('✓ pf-min already removed in chunk');
} else {
  console.error('[FATAL] tMin not found in chunk!');
  process.exit(1);
}

if (chunkCode.includes(tActive)) {
  chunkCode = chunkCode.replace(tActive, newActiveChunk);
  chunkChanged = true;
  console.log('✓ Updated pf-active to sm:col-span-2 in chunk');
}

if (chunkChanged) {
  fs.writeFileSync(chunkPath, chunkCode, 'utf8');
  console.log('✓ Saved patched chunk');
}

// 3. Syntax check on chunk
try {
  execSync(`"${process.execPath}" -c "${chunkPath}"`, { stdio: 'pipe' });
  console.log('✓ Syntax check passed for patched chunk');
} catch (err) {
  console.error('[FATAL] Syntax check failed on chunk:', err.message);
  process.exit(1);
}

// 4. Synchronize to dist-desktop
const distOut = path.join(root, 'dist-desktop/win-unpacked/resources/out');
const distClient = path.join(root, 'dist-desktop/win-unpacked/resources/client');
const outDir = path.join(root, 'out');

if (!fs.existsSync(distOut)) {
  fs.mkdirSync(distOut, { recursive: true });
}
fs.cpSync(outDir, distOut, { recursive: true });
console.log(`✓ Synchronized out/ to ${distOut}`);

if (fs.existsSync(distClient)) {
  fs.cpSync(outDir, distClient, { recursive: true });
  console.log(`✓ Synchronized out/ to ${distClient}`);
}

console.log('\n=== PRODUCT DIALOG FIELDS PATCH APPLIED SUCCESSFULLY ===');
