const fs = require('fs');
const path = require('path');

const targetDirs = [
  path.resolve(__dirname, '../out/_next/static/chunks'),
  path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/client/_next/static/chunks')
];

targetDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    console.log('Directory not found:', dir);
    return;
  }

  // 1. Patch 18yoqc7d05wnq.js
  const chunk18 = path.join(dir, '18yoqc7d05wnq.js');
  if (fs.existsSync(chunk18)) {
    let content = fs.readFileSync(chunk18, 'utf8');

    const previousStorePattern = 'fmtDate:e=>(function(e,t="ar"){if(!e||typeof e=="boolean")return"—";try{let r="string"==typeof e?new Date(e.includes&&/^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}/.test(e)?e.replace(" ","T")+(e.endsWith("Z")?"":"Z"):e):e instanceof Date?e:new Date(Number(e));return r&&!isNaN(r.getTime())?new Intl.DateTimeFormat("ar"===t?"ar-EG":"en-GB",{year:"numeric",month:"short",day:"numeric"}).format(r):"—"}catch(a){return"—"}})(e,t().lang),fmtDateTime:e=>(function(e,t="ar"){if(!e||typeof e=="boolean")return"—";try{let r="string"==typeof e?new Date(e.includes&&/^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}/.test(e)?e.replace(" ","T")+(e.endsWith("Z")?"":"Z"):e):e instanceof Date?e:new Date(Number(e));return r&&!isNaN(r.getTime())?new Intl.DateTimeFormat("ar"===t?"ar-EG":"en-GB",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(r):"—"}catch(a){return"—"}})(e,t().lang),has:e=>{let r=t().session;return Boolean(r&&Array.isArray(r.permissions)&&r.permissions.includes(e))}';

    const bulletproofStorePattern = 'fmtDate:e=>(function(e,t="ar"){if(!e||typeof e=="boolean")return"—";try{let r="string"==typeof e?new Date(e.includes&&/^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}/.test(e)?e.replace(" ","T")+(e.endsWith("Z")?"":"Z"):e):e instanceof Date?e:"number"==typeof e&&!isNaN(e)&&isFinite(e)&&e>0?new Date(e):null;return r&&!isNaN(r.getTime())?new Intl.DateTimeFormat("ar"===t?"ar-EG":"en-GB",{year:"numeric",month:"short",day:"numeric"}).format(r):"—"}catch(a){return"—"}})(e,t().lang),fmtDateTime:e=>(function(e,t="ar"){if(!e||typeof e=="boolean")return"—";try{let r="string"==typeof e?new Date(e.includes&&/^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}/.test(e)?e.replace(" ","T")+(e.endsWith("Z")?"":"Z"):e):e instanceof Date?e:"number"==typeof e&&!isNaN(e)&&isFinite(e)&&e>0?new Date(e):null;return r&&!isNaN(r.getTime())?new Intl.DateTimeFormat("ar"===t?"ar-EG":"en-GB",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(r):"—"}catch(a){return"—"}})(e,t().lang),has:e=>{let r=t().session;return Boolean(r&&Array.isArray(r.permissions)&&r.permissions.includes(e))}';

    if (content.includes(previousStorePattern)) {
      content = content.replace(previousStorePattern, bulletproofStorePattern);
      console.log(`[PASS] Upgraded to bulletproof fmtDate, fmtDateTime in ${chunk18}`);
    } else if (content.includes('e>0?new Date(e):null')) {
      console.log(`[INFO] Already bulletproof in ${chunk18}`);
    } else {
      console.warn(`[WARN] Pattern not found in ${chunk18}`);
    }

    fs.writeFileSync(chunk18, content, 'utf8');
  }
});
