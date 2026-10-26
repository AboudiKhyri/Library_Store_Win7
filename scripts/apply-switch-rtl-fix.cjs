const fs = require('fs');
const path = require('path');

console.log('=== APPLYING SWITCH RTL THUMB FIX ===');

// 1. Update src/components/ui/switch.tsx in both root and win7
const switchFiles = [
  path.resolve(__dirname, '../src/components/ui/switch.tsx'),
  path.resolve(__dirname, '../../src/components/ui/switch.tsx'),
];

switchFiles.forEach((fp) => {
  if (!fs.existsSync(fp)) return;
  let code = fs.readFileSync(fp, 'utf8');
  const target = 'data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0';
  const replacement = 'data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0 rtl:data-[state=checked]:-translate-x-[calc(100%-2px)] rtl:data-[state=unchecked]:translate-x-0';
  if (code.includes(target) && !code.includes('rtl:data-[state=checked]:-translate-x')) {
    code = code.replace(target, replacement);
    fs.writeFileSync(fp, code, 'utf8');
    console.log('✓ Updated switch.tsx in', path.relative(path.resolve(__dirname, '../..'), fp));
  } else {
    console.log('  switch.tsx already has RTL classes in', path.relative(path.resolve(__dirname, '../..'), fp));
  }
});

// 2. Update products.tsx in both root and win7
const productFiles = [
  path.resolve(__dirname, '../src/components/library/screens/products.tsx'),
  path.resolve(__dirname, '../../src/components/library/screens/products.tsx'),
];

productFiles.forEach((fp) => {
  if (!fs.existsSync(fp)) return;
  let code = fs.readFileSync(fp, 'utf8');
  const isCRLF = code.includes('\r\n');
  let norm = code.replace(/\r\n/g, '\n');

  // Replace manual pseudo-switch button with <div role="button"> + <Switch>
  const manualPattern = /<button\s+type="button"\s+role="switch"\s+aria-checked=\{form\.isWeighable\}[\s\S]*?<\/button>/;
  const match = norm.match(manualPattern);
  if (match) {
    const replacement = `<div
              role="button"
              tabIndex={0}
              onClick={() => set('isWeighable', !form.isWeighable)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  set('isWeighable', !form.isWeighable)
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
                onCheckedChange={(v) => set('isWeighable', v)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>`;
    norm = norm.replace(match[0], replacement);
    const finalContent = isCRLF ? norm.replace(/\n/g, '\r\n') : norm;
    fs.writeFileSync(fp, finalContent, 'utf8');
    console.log('✓ Replaced weighable switch with standard <Switch> in', path.relative(path.resolve(__dirname, '../..'), fp));
  } else {
    console.log('  Weighable switch already using standard Switch in', path.relative(path.resolve(__dirname, '../..'), fp));
  }
});

// 3. Update compiled JS chunks in out and dist-desktop
const chunkPaths = [
  path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js'),
  path.resolve(__dirname, '../out/_next/static/chunks/18yoqc7d05wnq.js'),
];

chunkPaths.forEach((cp) => {
  if (!fs.existsSync(cp)) return;
  let code = fs.readFileSync(cp, 'utf8');

  // A. Update Nf (Switch) thumb class
  const oldThumb = 'data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0")})';
  const newThumb = 'data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0 rtl:data-[state=checked]:-translate-x-[calc(100%-2px)] rtl:data-[state=unchecked]:translate-x-0")})';
  if (code.includes(oldThumb)) {
    code = code.replace(oldThumb, newThumb);
    console.log('✓ Updated Nf thumb RTL classes in', path.basename(cp));
  }

  // B. Replace the manual weighable span in 18yoqc7d05wnq.js
  const oldWeighableSpan = '(0,N.jsx)("span",{className:"relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition "+(c.isWeighable?"bg-primary":"bg-muted-foreground/30"),children:(0,N.jsx)("span",{className:"inline-block h-4 w-4 rounded-full bg-white shadow transition-transform "+(c.isWeighable?"-translate-x-[2px] rtl:translate-x-[2px]":"-translate-x-[18px] rtl:translate-x-[18px]")})})';
  const newWeighableSwitch = '(0,N.jsx)(Nf,{checked:c.isWeighable,onCheckedChange:e=>x("isWeighable",e),onClick:e=>e.stopPropagation()})';
  if (code.includes(oldWeighableSpan)) {
    code = code.replace(oldWeighableSpan, newWeighableSwitch);
    console.log('✓ Replaced manual weighable switch with Nf in', path.basename(cp));
  }

  fs.writeFileSync(cp, code, 'utf8');
});

// 4. Inject CSS rules into globals.css and 3oa5e4nmj08il.css
const cssRule = `
/* RTL Switch Thumb Transitions & Positioning (Zero-Exit Guarantee) */
[dir="rtl"] [data-slot="switch-thumb"][data-state="checked"],
[dir="rtl"] button[role="switch"][data-state="checked"] [data-slot="switch-thumb"],
[dir="rtl"] button[role="switch"][data-state="checked"] > span,
html[dir="rtl"] [data-slot="switch-thumb"][data-state="checked"],
body[dir="rtl"] [data-slot="switch-thumb"][data-state="checked"] {
  --tw-translate-x: calc(-100% + 2px) !important;
  transform: translateX(calc(-100% + 2px)) !important;
  translate: var(--tw-translate-x) 0px !important;
}

[dir="rtl"] [data-slot="switch-thumb"][data-state="unchecked"],
[dir="rtl"] button[role="switch"][data-state="unchecked"] [data-slot="switch-thumb"],
[dir="rtl"] button[role="switch"][data-state="unchecked"] > span,
html[dir="rtl"] [data-slot="switch-thumb"][data-state="unchecked"],
body[dir="rtl"] [data-slot="switch-thumb"][data-state="unchecked"] {
  --tw-translate-x: 0px !important;
  transform: translateX(0px) !important;
  translate: 0px 0px !important;
}

[dir="ltr"] [data-slot="switch-thumb"][data-state="checked"],
[dir="ltr"] button[role="switch"][data-state="checked"] [data-slot="switch-thumb"],
html[dir="ltr"] [data-slot="switch-thumb"][data-state="checked"] {
  --tw-translate-x: calc(100% - 2px) !important;
  transform: translateX(calc(100% - 2px)) !important;
  translate: var(--tw-translate-x) 0px !important;
}

[dir="ltr"] [data-slot="switch-thumb"][data-state="unchecked"],
[dir="ltr"] button[role="switch"][data-state="unchecked"] [data-slot="switch-thumb"],
html[dir="ltr"] [data-slot="switch-thumb"][data-state="unchecked"] {
  --tw-translate-x: 0px !important;
  transform: translateX(0px) !important;
  translate: 0px 0px !important;
}
`;

const globalsFiles = [
  path.resolve(__dirname, '../src/app/globals.css'),
  path.resolve(__dirname, '../../src/app/globals.css'),
];

globalsFiles.forEach((gp) => {
  if (!fs.existsSync(gp)) return;
  let c = fs.readFileSync(gp, 'utf8');
  if (!c.includes('/* RTL Switch Thumb Transitions & Positioning')) {
    c += '\n' + cssRule;
    fs.writeFileSync(gp, c, 'utf8');
    console.log('✓ Injected RTL Switch rules into', path.relative(path.resolve(__dirname, '../..'), gp));
  }
});

const clientCssFiles = [
  path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/client/_next/static/chunks/3oa5e4nmj08il.css'),
  path.resolve(__dirname, '../out/_next/static/chunks/3oa5e4nmj08il.css'),
];

clientCssFiles.forEach((cp) => {
  if (!fs.existsSync(cp)) return;
  let c = fs.readFileSync(cp, 'utf8');
  if (!c.includes('/* RTL Switch Thumb Transitions & Positioning')) {
    c += '\n' + cssRule;
    fs.writeFileSync(cp, c, 'utf8');
    console.log('✓ Injected RTL Switch rules into', path.basename(cp));
  }
});

console.log('=== SWITCH RTL THUMB FIX COMPLETE ===');
