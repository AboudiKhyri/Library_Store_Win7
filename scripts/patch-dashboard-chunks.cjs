const fs = require('fs');
const path = require('path');

const chunkPaths = [
  path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js'),
  path.resolve(__dirname, '../out/_next/static/chunks/18yoqc7d05wnq.js'),
];

chunkPaths.forEach(p => {
  if (fs.existsSync(p)) {
    let c = fs.readFileSync(p, 'utf8');

    const expiredBlock = 's&&(0,N.jsxs)("button",{className:"flex items-center gap-1.5 hover:underline",onClick:()=>e("inventory"),children:[(0,N.jsx)(se.AlertTriangle,{className:"h-3.5 w-3.5"}),(0,N.jsxs)("span",{children:[(0,N.jsx)("span",{className:"font-bold tabular-nums",children:r.expiredCount})," صنف منتهي الصلاحية في المخزن"]})]}),';
    const nearBlock = 'o&&(0,N.jsxs)("button",{className:"flex items-center gap-1.5 hover:underline",onClick:()=>e("inventory"),children:[(0,N.jsx)(st,{className:"h-3.5 w-3.5"}),(0,N.jsxs)("span",{children:[(0,N.jsx)("span",{className:"font-bold tabular-nums",children:r.nearExpiryCount})," باتش قريب من انتهاء الصلاحية"]})]}),';

    if (c.includes(expiredBlock)) c = c.replace(expiredBlock, '');
    if (c.includes(nearBlock)) c = c.replace(nearBlock, '');

    fs.writeFileSync(p, c, 'utf8');
    console.log('✓ Cleaned ticker alert blocks in:', p);
  }
});
