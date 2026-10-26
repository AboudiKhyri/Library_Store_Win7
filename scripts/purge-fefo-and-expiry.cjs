/**
 * Complete Purge of FEFO, Expiry UI, and Legacy Expiry Remnants from Chunks & Source
 * Target: Library Store For Windows 7 & root workspace
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const targets = [
  path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js'),
  path.resolve(__dirname, '../out/_next/static/chunks/18yoqc7d05wnq.js')
];

function patchChunk(chunkPath) {
  if (!fs.existsSync(chunkPath)) {
    console.warn(`[WARN] Chunk not found at: ${chunkPath}`);
    return;
  }
  console.log(`\n>>> Patching ${path.relative(process.cwd(), chunkPath)}...`);
  let code = fs.readFileSync(chunkPath, 'utf8');

  function doReplace(label, target, replacement) {
    const count = code.split(target).length - 1;
    if (count === 0) {
      console.log(`[SKIP] ${label} (already applied or pattern absent)`);
      return;
    }
    code = code.replace(target, replacement);
    console.log(`[PASS] ${label} (${count} match replaced)`);
  }

  // 1. Inventory header subtitle: replace FEFO / inv.fifo with clean neutral store description
  doReplace(
    'Inventory Header Description',
    'description:e("inv.fifo")',
    'description:"متابعة وإدارة كميات الأصناف وحركات المخزون"'
  );

  // 2. Tab 2 Trigger: "الباتشات والصلاحية" -> "الباتشات"
  doReplace(
    'Inventory Tab 2 Trigger',
    '(0,N.jsxs)(Mw,{value:"batches",className:"gap-1.5",children:[(0,N.jsx)(kE,{className:"h-4 w-4"}),"الباتشات والصلاحية"]})',
    '(0,N.jsxs)(Mw,{value:"batches",className:"gap-1.5",children:[(0,N.jsx)(kE,{className:"h-4 w-4"}),"الباتشات"]})'
  );

  // 3. Batches Tab (MT) filters: remove expired, near, sweep button -> only active and depleted
  doReplace(
    'Batches Tab Filters & Sweep Button',
    '(0,N.jsxs)("div",{className:"flex flex-wrap items-center gap-2",children:[(0,N.jsx)(MA,{active:"expired"===S,tone:"danger",onClick:()=>E("expired"===S?"":"expired"),children:r("inv.expired")}),(0,N.jsx)(MA,{active:"near"===S,tone:"warning",onClick:()=>E("near"===S?"":"near"),children:r("inv.nearExpiry")}),(0,N.jsx)(MA,{active:"valid"===S,onClick:()=>E("valid"===S?"":"valid"),children:r("inv.valid")}),(0,N.jsx)(MA,{active:"depleted"===S,onClick:()=>E("depleted"===S?"":"depleted"),children:"مستنفد"}),i("INVENTORY_ADJUST")&&(0,N.jsxs)(F.Button,{variant:"outline",size:"sm",className:"h-9",disabled:C,onClick:()=>void O(),children:[C?(0,N.jsx)(kS,{className:"me-2 h-4 w-4 animate-spin"}):(0,N.jsx)(sm.RefreshCw,{className:"me-2 h-4 w-4"}),r("inv.sweep")]})]})',
    '(0,N.jsxs)("div",{className:"flex flex-wrap items-center gap-2",children:[(0,N.jsx)(MA,{active:"valid"===S||"active"===S,onClick:()=>E("valid"===S?"":"valid"),children:"النشطة"}),(0,N.jsx)(MA,{active:"depleted"===S,onClick:()=>E("depleted"===S?"":"depleted"),children:"المستنفدة"})]})'
  );

  // 4. Batches Tab (MT) table columns: remove expiryDate column
  doReplace(
    'Batches Tab expiryDate Column',
    ',{key:"expiryDate",header:r("inv.expiryDate"),render:t=>{if(!t.expiryDate||null===t.daysLeft)return(0,N.jsx)("span",{className:"text-muted-foreground",children:"بدون تاريخ"});let r=wV(t.expiryDate,e);return(0,N.jsxs)("div",{className:(0,B.cn)("whitespace-nowrap",MC[r]),children:[(0,N.jsx)("p",{className:"text-xs font-medium",children:a(t.expiryDate)}),(0,N.jsx)("p",{className:"text-[10px]",children:w$(t.daysLeft,"ar")})]})}}',
    ''
  );

  // 5. CurrentStockTab (MO) dialog table thead: remove inv.expiryDate
  doReplace(
    'CurrentStockTab dialog thead expiryDate',
    '(0,N.jsx)("th",{className:"px-3 py-2 text-start font-medium",children:r("inv.expiryDate")}),',
    ''
  );

  // 6. CurrentStockTab (MO) dialog table tbody: remove expiryDate cell
  doReplace(
    'CurrentStockTab dialog tbody expiryDate',
    ',(0,N.jsx)("td",{className:(0,B.cn)("whitespace-nowrap px-3 py-2 text-xs",MC[i]),children:r.expiryDate?(0,N.jsxs)(N.Fragment,{children:[(0,N.jsx)("p",{children:a(r.expiryDate)}),null!==r.daysLeft&&(0,N.jsx)("p",{className:"text-[10px]",children:w$(r.daysLeft,"ar")})]}):"—"})',
    ''
  );

  // 7. Products dialog: remove "تاريخ الانتهاء" thead
  doReplace(
    'Products dialog thead expiryDate',
    '(0,N.jsx)("th",{className:"px-3 py-2 text-start font-medium",children:"تاريخ الانتهاء"}),',
    ''
  );

  // 8. Products dialog: remove expiry cell tbody
  doReplace(
    'Products dialog tbody expiry cell',
    ',(0,N.jsx)("td",{className:"px-3 py-2",children:(0,N.jsxs)("div",{className:"flex flex-col gap-0.5",children:[(0,N.jsx)(oo,{status:i,label:"EXPIRED"===i?"منتهي":"NEAR"===i?"قريب الانتهاء":"ساري"}),e.expiryDate&&(0,N.jsxs)("span",{className:"text-[10px] text-muted-foreground",children:[n(e.expiryDate)," · ",w$(s??0,"ar")]})]})})',
    ''
  );

  // 9. Stocktake guidance text
  doReplace(
    'Stocktake FIFO text',
    '(استهلاك الباتشات الأقرب انتهاءً أولاً)',
    '(استهلاك الباتشات الأقدم وروداً أولاً بنظام FIFO)'
  );

  // 10. Reports: remove Expiry report tab definition
  doReplace(
    'Reports Expiry Tab definition',
    '{id:"expiry",ar:"تقرير الصلاحية",en:"Expiry Report",icon:MF,snapshot:!0,expiryFilter:!0},',
    ''
  );

  // 11. Reports: remove Expiry metrics from MU
  doReplace(
    'Reports Expiry metrics in MU',
    ',expiry:[{key:"expiredCount",ar:"دفعات منتهية",en:"Expired batches",tone:"danger"},{key:"nearCount",ar:"دفعات قريبة الانتهاء",en:"Near expiry",tone:"warning"},{key:"expiredValue",ar:"قيمة المنتهية",en:"Expired value",money:!0},{key:"nearValue",ar:"قيمة القريبة من الانتهاء",en:"Near expiry value",money:!0}]',
    ''
  );

  // 12. POS settings: remove expiryWarningDays
  doReplace(
    'POS settings expiryWarningDays',
    '(0,N.jsx)(DB,{label:r("تنبيه قرب الانتهاء (أيام)","Expiry warning (days)"),value:o.expiryWarningDays,min:1,max:365,onChange:e=>l({expiryWarningDays:e}),hint:r("يُستخدم في تلوين الأصناف وتقرير الصلاحية","Drives item highlighting and the expiry report")}),',
    ''
  );

  // 13. POS settings: remove allowSellingExpired switch card
  doReplace(
    'POS settings allowSellingExpired',
    '(0,N.jsx)("div",{className:"mt-4 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/5 p-4",role:"alert",children:(0,N.jsxs)("div",{className:"flex items-center justify-between gap-3",children:[(0,N.jsxs)("div",{className:"flex items-start gap-2",children:[(0,N.jsx)(se.AlertTriangle,{className:"mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]"}),(0,N.jsxs)("div",{children:[(0,N.jsx)("p",{className:"text-sm font-bold text-[var(--danger)]",children:r("السماح ببيع الأصناف منتهية الصلاحية","Allow selling expired items")}),(0,N.jsx)("p",{className:"mt-0.5 text-xs text-muted-foreground",children:r("غير مستحسن — يسمح لنقطة البيع بخصم الكميات من دفعات منتهية الصلاحية رغم التحذير.","Not recommended — lets POS allocate from expired batches despite warnings.")})]})]}),(0,N.jsx)(Nf,{checked:o.allowSellingExpired,onCheckedChange:e=>l({allowSellingExpired:e}),"aria-label":r("السماح ببيع المنتهي","Allow expired")})]})}),',
    ''
  );

  // 14. Inventory settings: remove Expiry warning display
  doReplace(
    'Inventory settings expiryWarningDays display',
    '(0,N.jsx)(Dz,{label:t("تنبيه قرب الانتهاء (أيام)","Expiry warning (days)"),value:(0,N.jsx)("span",{className:"tabular-nums",children:s.expiryWarningDays})}),',
    ''
  );

  // 15. Inventory settings: remove Expiry sweep card
  const target14_start = ',(0,N.jsxs)(ou,{title:t("تحديث حالات الصلاحية","Expiry sweep")';
  const target14_end = 'INVENTORY_ADJUST permission.")})]})';
  const idxStart = code.indexOf(target14_start);
  const idxEnd = code.indexOf(target14_end);
  if (idxStart !== -1 && idxEnd !== -1) {
    const fullTarget14 = code.slice(idxStart, idxEnd + target14_end.length);
    doReplace('Inventory settings Expiry sweep card', fullTarget14, '');
  }

  // 16. Products table: remove "+ شامل المنتهي"
  const targetProductStock1 = 'title:`إجمالي الكميات (شامل المنتهي): ${w5(e.stockTotal,e.isWeighable)}`';
  if (code.includes(targetProductStock1)) {
    doReplace('Products table stock title', targetProductStock1, 'title:`إجمالي الكميات: ${w5(e.stockTotal,e.isWeighable)}`');
  }
  const targetProductStock2 = 'children:["+",w5(r,e.isWeighable)," شامل المنتهي"]';
  if (code.includes(targetProductStock2)) {
    doReplace('Products table stock plus', targetProductStock2, 'children:["+",w5(r,e.isWeighable)]');
  }

  // 17. Sanitize translation dictionary entries for settings
  doReplace(
    'Sanitize settings.allowExpired translation',
    '"settings.allowExpired":{ar:"السماح ببيع الأصناف منتهية الصلاحية (غير مستحسن)",en:"Allow selling expired items (not recommended)"}',
    '"settings.allowExpired":{ar:"السماح بالبيع المباشر",en:"Allow direct selling"}'
  );
  doReplace(
    'Sanitize settings.expiryWarning translation',
    '"settings.expiryWarning":{ar:"تنبيه قرب الانتهاء (أيام)",en:"Expiry warning (days)"}',
    '"settings.expiryWarning":{ar:"تنبيه المخزون (أيام)",en:"Stock warning (days)"}'
  );
  doReplace(
    'Sanitize inv.sweep translation',
    '"inv.sweep":{ar:"تحديث حالات الصلاحية",en:"Refresh expiry statuses"}',
    '"inv.sweep":{ar:"تحديث الحالات",en:"Refresh statuses"}'
  );
  doReplace(
    'Sanitize inv.sweepDone translation',
    '"inv.sweepDone":{ar:"تم تحديث حالات الصلاحية",en:"Expiry statuses refreshed"}',
    '"inv.sweepDone":{ar:"تم تحديث الحالات",en:"Statuses refreshed"}'
  );

  // Verify syntax with vm.Script
  try {
    new vm.Script(code);
    console.log('[PASS] vm.Script compilation verified: 0 syntax errors.');
  } catch (err) {
    console.error(`[FATAL] Syntax error in patched code for ${chunkPath}:`, err);
    process.exit(1);
  }

  // Atomic write
  const tmpPath = `${chunkPath}.tmp`;
  fs.writeFileSync(tmpPath, code, 'utf8');
  fs.renameSync(tmpPath, chunkPath);
  console.log(`[PASS] Saved patched chunk: ${chunkPath}`);
}

targets.forEach(patchChunk);
console.log('\n[SUCCESS] Production chunks successfully patched.');
