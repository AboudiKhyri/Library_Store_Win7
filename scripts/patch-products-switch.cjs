const fs = require('fs');
const path = require('path');

const file = path.resolve('src/components/library/screens/products.tsx');
let content = fs.readFileSync(file, 'utf8');

const target = `              <span
                className={
                  'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ' +
                  (form.isWeighable ? 'bg-primary' : 'bg-muted-foreground/30')
                }
              >
                <span
                  className={
                    'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ' +
                    (form.isWeighable ? '-translate-x-[2px] rtl:translate-x-[2px]' : '-translate-x-[18px] rtl:translate-x-[18px]')
                  }
                />
              </span>`;

const replacement = `              <Switch checked={form.isWeighable} onCheckedChange={(v) => set('isWeighable', v)} />`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully replaced custom switch in products.tsx with standard <Switch>');
} else {
  // Try CRLF
  const targetCRLF = target.replace(/\n/g, '\r\n');
  if (content.includes(targetCRLF)) {
    content = content.replace(targetCRLF, replacement.replace(/\n/g, '\r\n'));
    fs.writeFileSync(file, content, 'utf8');
    console.log('Successfully replaced custom switch (CRLF) in products.tsx with standard <Switch>');
  } else {
    console.error('Target not found in products.tsx');
  }
}
