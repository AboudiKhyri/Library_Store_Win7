const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

console.log('=== APPLYING WEIGHABLE (يُباع بالوزن) REPAIR ===');

// 1. Update src/components/library/screens/products.tsx
const productsTsx = path.join(root, 'src/components/library/screens/products.tsx');
if (fs.existsSync(productsTsx)) {
  let code = fs.readFileSync(productsTsx, 'utf8');
  const isCrlf = code.includes('\r\n');
  code = code.replace(/\r\n/g, '\n');

  // Replace onClick and onCheckedChange for weighable with auto-unit toggling
  const oldWeighableDivRegex = /<div\s+role="button"\s+tabIndex=\{0\}\s+onClick=\{\(\) => set\('isWeighable', !form\.isWeighable\)\}[\s\S]*?<Switch\s+checked=\{form\.isWeighable\}\s+onCheckedChange=\{\(v\) => set\('isWeighable', v\)\}\s+onClick=\{\(e\) => e\.stopPropagation\(\)\}\s*\/>\s*<\/div>/;

  const newWeighableDiv = `<div
              role="button"
              tabIndex={0}
              onClick={() => {
                const next = !form.isWeighable
                set('isWeighable', next)
                if (next && form.unit === 'piece') set('unit', 'kg')
                else if (!next && (form.unit === 'kg' || form.unit === 'g')) set('unit', 'piece')
              }}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  const next = !form.isWeighable
                  set('isWeighable', next)
                  if (next && form.unit === 'piece') set('unit', 'kg')
                  else if (!next && (form.unit === 'kg' || form.unit === 'g')) set('unit', 'piece')
                }
              }}
              className={
                'flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border p-3 text-start transition cursor-pointer select-none sm:min-h-[38px] ' +
                (form.isWeighable ? 'border-primary/50 bg-primary/10' : 'bg-muted/30 hover:bg-muted/50')
              }
            >
              <span className="text-sm font-medium">
                {form.isWeighable ? 'نعم — كميات كسرية في نقطة البيع' : 'لا — كميات صحيحة'}
              </span>
              <Switch
                checked={form.isWeighable}
                onCheckedChange={(v) => {
                  set('isWeighable', v)
                  if (v && form.unit === 'piece') set('unit', 'kg')
                  else if (!v && (form.unit === 'kg' || form.unit === 'g')) set('unit', 'piece')
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>`;

  if (oldWeighableDivRegex.test(code)) {
    code = code.replace(oldWeighableDivRegex, newWeighableDiv);
  }

  if (isCrlf) code = code.replace(/\n/g, '\r\n');
  fs.writeFileSync(productsTsx, code, 'utf8');
  console.log('✓ Patched src/components/library/screens/products.tsx');
}

// 2. Patch compiled client chunks: out and dist-desktop
const chunkFiles = [
  path.join(root, 'out/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(root, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js')
];

for (const cp of chunkFiles) {
  if (!fs.existsSync(cp)) continue;
  let js = fs.readFileSync(cp, 'utf8');

  const oldTarget = '(0,N.jsxs)("button",{type:"button",role:"switch","aria-checked":c.isWeighable,onClick:()=>x("isWeighable",!c.isWeighable),className:"flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border p-3 text-start transition sm:min-h-[38px] "+(c.isWeighable?"border-primary/50 bg-primary/10":"bg-muted/30 hover:bg-muted/50"),children:[(0,N.jsx)("span",{className:"text-sm font-medium",children:c.isWeighable?"نعم — كميات كسرية في نقطة البيع":"لا — كميات صحيحة"}),(0,N.jsx)(Nf,{checked:c.isWeighable,onCheckedChange:e=>x("isWeighable",e),onClick:e=>e.stopPropagation()})]})';
  const newReplacement = '(0,N.jsxs)("div",{role:"button",tabIndex:0,onClick:()=>{let e=!c.isWeighable;x("isWeighable",e),e&&"piece"===c.unit?x("unit","kg"):!e&&("kg"===c.unit||"g"===c.unit)&&x("unit","piece")},onKeyDown:t=>{" "===t.key||"Enter"===t.key?(t.preventDefault(),(()=>{let e=!c.isWeighable;x("isWeighable",e),e&&"piece"===c.unit?x("unit","kg"):!e&&("kg"===c.unit||"g"===c.unit)&&x("unit","piece")})()):void 0},className:"flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border p-3 text-start transition cursor-pointer select-none sm:min-h-[38px] "+(c.isWeighable?"border-primary/50 bg-primary/10":"bg-muted/30 hover:bg-muted/50"),children:[(0,N.jsx)("span",{className:"text-sm font-medium",children:c.isWeighable?"نعم — كميات كسرية في نقطة البيع":"لا — كميات صحيحة"}),(0,N.jsx)(Nf,{checked:c.isWeighable,onCheckedChange:e=>{x("isWeighable",e),e&&"piece"===c.unit?x("unit","kg"):!e&&("kg"===c.unit||"g"===c.unit)&&x("unit","piece")},onClick:e=>e.stopPropagation()})]})';

  if (js.includes(oldTarget)) {
    js = js.replace(oldTarget, newReplacement);
    fs.writeFileSync(cp, js, 'utf8');
    console.log('✓ Replaced weighable button with full-width interactive div in', path.basename(cp));
  } else {
    console.log('ℹ Target not found or already replaced in', path.basename(cp));
  }
}

// 3. Update CSS in globals.css, out, and dist-desktop
const cssFiles = [
  path.join(root, 'src/app/globals.css'),
  path.join(root, 'out/_next/static/chunks/3oa5e4nmj08il.css'),
  path.join(root, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/3oa5e4nmj08il.css')
];

for (const fp of cssFiles) {
  if (!fs.existsSync(fp)) continue;
  let css = fs.readFileSync(fp, 'utf8');

  // Prevent button[role="switch"] from matching .w-full elements
  css = css.replace(/button\[role="switch"\]/g, 'button[role="switch"]:not(.w-full)');

  // Ensure .w-full interactive cards are immune to sizing constraints
  const cardShield = `
/* Weighable card container shield — guarantees full width, normal layout and zero pill truncation */
div[role="button"].w-full,
button.w-full {
  width: 100% !important;
  min-width: 0 !important;
  max-width: none !important;
  height: auto !important;
  overflow: visible !important;
}
`;
  if (!css.includes('Weighable card container shield')) {
    css += '\n' + cardShield;
  }

  fs.writeFileSync(fp, css, 'utf8');
  console.log('✓ Injected weighable card shield and selector guards in', path.basename(fp));
}

console.log('=== WEIGHABLE REPAIR COMPLETE ===');
