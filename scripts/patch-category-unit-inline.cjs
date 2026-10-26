const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

console.log('=== APPLYING INLINE CATEGORY & UNIT COMPACT GRID ===');

// 1. Update src/components/library/screens/products.tsx
const productsTsx = path.join(root, 'src/components/library/screens/products.tsx');
if (fs.existsSync(productsTsx)) {
  let code = fs.readFileSync(productsTsx, 'utf8');
  const isCrlf = code.includes('\r\n');
  code = code.replace(/\r\n/g, '\n');

  const oldCategoryUnitRegex = /<div className="space-y-1\.5">\s*<Label>\{t\('products\.category'\)\}<\/Label>[\s\S]*?<\/SelectContent>\s*<\/Select>\s*<\/div>\s*<div className="space-y-1\.5">\s*<Label>\{t\('products\.unit'\)\}<\/Label>[\s\S]*?<\/SelectContent>\s*<\/Select>\s*<\/div>/;

  const newCategoryUnit = `<div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>{t('products.category')}</Label>
              <Select value={form.categoryId} onValueChange={(v) => set('categoryId', v)}>
                <SelectTrigger aria-label={t('products.category')}>
                  <SelectValue placeholder={t('products.category')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون تصنيف</SelectItem>
                  {(categories ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('products.unit')}</Label>
              <Select value={form.unit} onValueChange={(v) => set('unit', v)}>
                <SelectTrigger aria-label={t('products.unit')}>
                  <SelectValue placeholder={t('products.unit')} />
                </SelectTrigger>
                <SelectContent>
                  {unitOptions.map((u) => (
                    <SelectItem key={u} value={u}>
                      {unitLabel(u, lang)}
                    </SelectItem>
                  ))}
                  {!unitOptions.includes(form.unit) && form.unit && (
                    <SelectItem value={form.unit}>{form.unit}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>`;

  if (oldCategoryUnitRegex.test(code)) {
    code = code.replace(oldCategoryUnitRegex, newCategoryUnit);
    if (isCrlf) code = code.replace(/\n/g, '\r\n');
    fs.writeFileSync(productsTsx, code, 'utf8');
    console.log('✓ Patched src/components/library/screens/products.tsx');
  } else {
    console.log('ℹ Pattern not found in products.tsx or already patched');
  }
}

// 2. Patch compiled client chunks: out and dist-desktop
const chunkFiles = [
  path.join(root, 'out/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(root, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js')
];

for (const cp of chunkFiles) {
  if (!fs.existsSync(cp)) continue;
  let js = fs.readFileSync(cp, 'utf8');

  const oldTarget = '(0,N.jsxs)("div",{className:"space-y-1.5",children:[(0,N.jsx)(w9,{children:s("products.category")}),(0,N.jsxs)(kh,{value:c.categoryId,onValueChange:e=>x("categoryId",e),children:[(0,N.jsx)(km,{"aria-label":s("products.category"),children:(0,N.jsx)(kf,{placeholder:s("products.category")})}),(0,N.jsxs)(kx,{children:[(0,N.jsx)(ky,{value:"none",children:"بدون تصنيف"}),(n??[]).map(e=>(0,N.jsx)(ky,{value:e.id,children:e.nameAr},e.id))]})]})]}),(0,N.jsxs)("div",{className:"space-y-1.5",children:[(0,N.jsx)(w9,{children:s("products.unit")}),(0,N.jsxs)(kh,{value:c.unit,onValueChange:e=>x("unit",e),children:[(0,N.jsx)(km,{"aria-label":s("products.unit"),children:(0,N.jsx)(kf,{placeholder:s("products.unit")})}),(0,N.jsxs)(kx,{children:[m.map(e=>(0,N.jsx)(ky,{value:e,children:wz(e,o)},e)),!m.includes(c.unit)&&c.unit&&(0,N.jsx)(ky,{value:c.unit,children:c.unit})]})]})]})';

  const newReplacement = '(0,N.jsxs)("div",{className:"grid grid-cols-2 gap-2",children:[(0,N.jsxs)("div",{className:"space-y-1.5",children:[(0,N.jsx)(w9,{children:s("products.category")}),(0,N.jsxs)(kh,{value:c.categoryId,onValueChange:e=>x("categoryId",e),children:[(0,N.jsx)(km,{"aria-label":s("products.category"),children:(0,N.jsx)(kf,{placeholder:s("products.category")})}),(0,N.jsxs)(kx,{children:[(0,N.jsx)(ky,{value:"none",children:"بدون تصنيف"}),(n??[]).map(e=>(0,N.jsx)(ky,{value:e.id,children:e.nameAr},e.id))]})]})]}),(0,N.jsxs)("div",{className:"space-y-1.5",children:[(0,N.jsx)(w9,{children:s("products.unit")}),(0,N.jsxs)(kh,{value:c.unit,onValueChange:e=>x("unit",e),children:[(0,N.jsx)(km,{"aria-label":s("products.unit"),children:(0,N.jsx)(kf,{placeholder:s("products.unit")})}),(0,N.jsxs)(kx,{children:[m.map(e=>(0,N.jsx)(ky,{value:e,children:wz(e,o)},e)),!m.includes(c.unit)&&c.unit&&(0,N.jsx)(ky,{value:c.unit,children:c.unit})]})]})]})]})';

  if (js.includes(oldTarget)) {
    js = js.replace(oldTarget, newReplacement);
    fs.writeFileSync(cp, js, 'utf8');
    console.log('✓ Grouped Category and Unit side-by-side in', path.basename(cp));
  } else {
    console.log('ℹ Target not found or already replaced in', path.basename(cp));
  }
}

console.log('=== COMPACT GRID PATCH COMPLETE ===');
