const fs = require('fs');
const path = require('path');
const vm = require('vm');

const baseDir = path.resolve(__dirname, '..');
const chunkPaths = [
  path.join(baseDir, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(baseDir, 'out/_next/static/chunks/18yoqc7d05wnq.js')
];

const target1 = '{key:"stockExpired",header:r("inv.expired"),render:e=>e.stockExpired>0?(0,N.jsx)("span",{className:"inline-flex items-center rounded-md border border-[var(--danger)]/25 bg-[var(--danger)]/12 px-2 py-0.5 text-[11px] font-bold text-[var(--danger)] tabular-nums",children:e.stockExpired}):(0,N.jsx)("span",{className:"text-muted-foreground tabular-nums",children:"0"})},';

const target2 = '{key:"nearestExpiry",header:r("inv.expiryDate"),render:t=>{if(!t.nearestExpiry)return(0,N.jsx)("span",{className:"text-muted-foreground",children:"—"});let r=wV(t.nearestExpiry,e);return(0,N.jsxs)("div",{className:(0,B.cn)("whitespace-nowrap text-xs",MC[r]),children:[(0,N.jsx)("p",{children:a(t.nearestExpiry)}),(0,N.jsx)("p",{className:"text-[10px]",children:w$(R(t.nearestExpiry),"ar")})]})}},';

const target3 = ',(0,N.jsxs)(MA,{active:"expired"===j,tone:"danger",onClick:()=>w("expired"===j?"":"expired"),children:[(0,N.jsx)(wR,{className:"h-3.5 w-3.5"}),r("inv.expired")]}),(0,N.jsxs)(MA,{active:"near"===j,tone:"warning",onClick:()=>w("near"===j?"":"near"),children:[(0,N.jsx)(st,{className:"h-3.5 w-3.5"}),r("inv.nearExpiry")]})';

const target4 = ',{key:"stockExpired",header:e("inv.expired"),render:e=>(0,N.jsx)("span",{className:Number(e.stockExpired)>0?"font-semibold text-[var(--danger)] tabular-nums":"tabular-nums",children:Number(e.stockExpired??0).toLocaleString("en-US")})}';

for (const cp of chunkPaths) {
  if (!fs.existsSync(cp)) continue;
  let code = fs.readFileSync(cp, 'utf8');

  let modified = false;

  if (code.includes(target1)) {
    code = code.replace(target1, '');
    console.log('✓ Removed stockExpired column from', path.basename(cp));
    modified = true;
  } else {
    console.log('Target 1 (stockExpired) not found in', path.basename(cp));
  }

  if (code.includes(target2)) {
    code = code.replace(target2, '');
    console.log('✓ Removed nearestExpiry column from', path.basename(cp));
    modified = true;
  } else {
    console.log('Target 2 (nearestExpiry) not found in', path.basename(cp));
  }

  if (code.includes(target3)) {
    code = code.replace(target3, '');
    console.log('✓ Removed expired & near filter buttons from', path.basename(cp));
    modified = true;
  } else {
    console.log('Target 3 (filter buttons) not found in', path.basename(cp));
  }

  if (code.includes(target4)) {
    code = code.replace(target4, '');
    console.log('✓ Removed stockExpired report column from', path.basename(cp));
    modified = true;
  } else {
    console.log('Target 4 (report stockExpired) not found in', path.basename(cp));
  }

  if (modified) {
    try {
      new vm.Script(code);
      fs.writeFileSync(cp, code, 'utf8');
      console.log('✓ Successfully validated and saved', path.basename(cp));
    } catch (err) {
      console.error('✗ Syntax validation failed for', cp, err.message);
    }
  }
}

console.log('=== Done removing expiry columns & filters ===');
