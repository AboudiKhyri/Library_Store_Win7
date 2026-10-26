const fs = require('fs');
const path = require('path');
const vm = require('vm');

const baseDir = path.resolve(__dirname, '..');
const chunkPaths = [
  path.join(baseDir, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(baseDir, 'out/_next/static/chunks/18yoqc7d05wnq.js')
];

for (const cp of chunkPaths) {
  if (!fs.existsSync(cp)) continue;
  let code = fs.readFileSync(cp, 'utf8');
  const target = ':a({title:"تم حذف الصنف نهائياً"}),J(null),en(!1),b(e=>e+1)';
  const repl = ':a({title:"تم حذف الصنف نهائياً"}),ei(e=>(e.delete(Q.id),new Set(e))),J(null),en(!1),b(e=>e+1)';
  if (code.includes(target)) {
    code = code.replace(target, repl);
    new vm.Script(code);
    fs.writeFileSync(cp, code, 'utf8');
    console.log('✓ Validated and patched', path.basename(cp));
  } else {
    console.log('Target not found or already patched in', path.basename(cp));
  }
}
