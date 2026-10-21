# PHASE 1: DISCOVERY & AUDIT MATRIX — EXPIRY REMOVAL
**Role:** The Inquisitor · Security Architect & Code Forensic Analyst  
**Mission:** Total Removal of Expiry Concept; Conversion of FEFO to FIFO; Lot Identity Preservation  
**Standard:** Zero Trust Forensic Discovery  

---

## 1. Discovery Overview

Total occurrences identified: 395 lines across 34 files.

| File Category | Files Count | Lines Found | Core Remediation Strategy |
| :--- | :---: | :---: | :--- |
| **Backend API (`server/api.js`)** | 1 | 74 | Convert FEFO to FIFO; remove sweep endpoint; remove expiry metrics/filters; write NULL |
| **Database Layer (`server/db.js`, `db-schema.ts`)** | 2 | 9 | Keep `expiryDate` columns as DEPRECATED nullable; bump SCHEMA_VERSION to 2; recover EXPIRED batches |
| **Frontend Services (`src/lib/library/services/*`)** | 6 | 61 | Convert FEFO to FIFO in `inventory.ts`; remove sweep & expiry metrics from dashboard |
| **UI Screens (`src/components/library/screens/*`)** | 9 | 158 | Remove expiry columns, tabs, chips, warning badges, inputs across inventory, pos, purchases, reports |
| **i18n & Labels (`i18n.ts`, `labels.ts`)** | 2 | 31 | Delete dead product expiry strings; keep user permissions and license expiry strings intact |
| **Configuration & Types (`config.ts`, `types.ts`)** | 2 | 11 | Remove expiry config keys and EXPIRED from BatchStatus |
| **Documentation & Tests** | 4 | 5 | Update references from FEFO to FIFO; update tests |

---

## 2. Forensic Discovery Table

| File | Line | Type | Code Snippet | Planned Action |
| :--- | :---: | :---: | :--- | :---: |
| `docs/DATABASE.md` | 18 | docs | `\| `Batch` \| Traceable stock units with expiry dates, cost, and FEFO ` | **UPDATE-DOCS** |
| `docs/TESTING.md` | 48 | docs | `- Batch allocation (FEFO) applied` | **UPDATE-DOCS** |
| `README.md` | 17 | docs | `- **إدارة المخزون والباتشات (Batches):** تتبع تواريخ الصلاحية وتطبيق س` | **UPDATE-DOCS** |
| `README.md` | 46 | docs | `- **الصلاحية (Role):** المالك / مدير النظام (`Owner / Super Admin`)` | **UPDATE-DOCS** |
| `scripts/copy-standalone.mjs` | 40 | test | `// Packaging-artifact pruning — the standalone sweep mirrors project f` | **UPDATE-TEST** |
| `scripts/discover-expiry.cjs` | 2 | test | `* Discovery Script for Expiry/FEFO references` | **UPDATE-TEST** |
| `scripts/discover-expiry.cjs` | 11 | test | `/expiry/i,` | **UPDATE-TEST** |
| `scripts/discover-expiry.cjs` | 12 | test | `/expired/i,` | **UPDATE-TEST** |
| `scripts/discover-expiry.cjs` | 13 | test | `/expiring/i,` | **UPDATE-TEST** |
| `scripts/discover-expiry.cjs` | 14 | test | `/near[-_]?expiry/i,` | **UPDATE-TEST** |
| `scripts/discover-expiry.cjs` | 19 | test | `/EXPIRY_WRITEOFF/,` | **UPDATE-TEST** |
| `scripts/discover-expiry.cjs` | 20 | test | `/تاريخ الانتهاء/,` | **UPDATE-TEST** |
| `scripts/discover-expiry.cjs` | 21 | test | `/منتهي/,` | **UPDATE-TEST** |
| `scripts/discover-expiry.cjs` | 22 | test | `/صلاحية/,` | **UPDATE-TEST** |
| `scripts/discover-expiry.cjs` | 23 | test | `/الصلاحية/,` | **UPDATE-TEST** |
| `scripts/discover-expiry.cjs` | 24 | test | `/قارب/,` | **UPDATE-TEST** |
| `scripts/discover-expiry.cjs` | 75 | test | `fs.writeFileSync('scripts/expiry-discovery-raw.json', JSON.stringify(b` | **UPDATE-TEST** |
| `scripts/discover-expiry.cjs` | 76 | test | `console.log(`Saved raw discovery to scripts/expiry-discovery-raw.json.` | **UPDATE-TEST** |
| `server/api.js` | 51 | API | `if (!user.permissions.includes(perm)) throw ApiError('FORBIDDEN', `ليس` | **REMOVE** |
| `server/api.js` | 697 | API | `const batches = db.prepare('SELECT b.*, s.name as supplierName FROM "B` | **REMOVE** |
| `server/api.js` | 726 | API | `expiryDate: b.expiryDate ? (typeof b.expiryDate === 'string' ? b.expir` | **REMOVE** |
| `server/api.js` | 805 | API | `const filter = req.query.filter; // 'expired' \| 'near' \| 'valid' \| ` | **REMOVE** |
| `server/api.js` | 809 | API | `const warningDays = (settings.pos && settings.pos.expiryWarningDays) \` | **REMOVE** |
| `server/api.js` | 824 | API | `if (filter === 'expired') {` | **REMOVE** |
| `server/api.js` | 825 | API | `where += " AND (b.status='EXPIRED' OR (b.expiryDate IS NOT NULL AND b.` | **REMOVE** |
| `server/api.js` | 828 | API | `where += " AND b.status='ACTIVE' AND b.quantity > 0 AND b.expiryDate >` | **REMOVE** |
| `server/api.js` | 832 | API | `where += " AND b.status='ACTIVE' AND b.quantity > 0 AND (b.expiryDate ` | **REMOVE** |
| `server/api.js` | 847 | API | `ORDER BY b.expiryDate ASC NULLS LAST, b.createdAt ASC` | **REMOVE** |
| `server/api.js` | 852 | API | `const statsExpired = db.prepare("SELECT COUNT(*) as c FROM \"Batch\" W` | **REMOVE** |
| `server/api.js` | 853 | API | `const statsNear = db.prepare("SELECT COUNT(*) as c FROM \"Batch\" WHER` | **REMOVE** |
| `server/api.js` | 854 | API | `const statsValid = db.prepare("SELECT COUNT(*) as c FROM \"Batch\" WHE` | **REMOVE** |
| `server/api.js` | 857 | API | `let daysLeft = null;` | **REMOVE** |
| `server/api.js` | 858 | API | `if (b.expiryDate) {` | **REMOVE** |
| `server/api.js` | 859 | API | `const exp = new Date(b.expiryDate);` | **REMOVE** |
| `server/api.js` | 860 | API | `daysLeft = Math.round((new Date(exp.getFullYear(), exp.getMonth(), exp` | **REMOVE** |
| `server/api.js` | 868 | API | `expiryDate: b.expiryDate ? (typeof b.expiryDate === 'string' ? b.expir` | **REMOVE** |
| `server/api.js` | 869 | API | `daysLeft,` | **REMOVE** |
| `server/api.js` | 885 | API | `stats: { expired: statsExpired, near: statsNear, valid: statsValid },` | **REMOVE** |
| `server/api.js` | 922 | API | `const newStatus = counted === 0 && adjType === 'EXPIRY_WRITEOFF' ? 'EX` | **HISTORICAL-DISPLAY-ONLY** |
| `server/api.js` | 933 | API | `router.post('/inventory/expiry/sweep', (req, res) => {` | **REMOVE** |
| `server/api.js` | 937 | API | `const result = db.prepare("UPDATE \"Batch\" SET status='EXPIRED',updat` | **REMOVE** |
| `server/api.js` | 978 | API | `const products = db.prepare('SELECT p.id, p.nameAr, b.id as batchId, b` | **REMOVE** |
| `server/api.js` | 982 | API | `if (row.batchId) { byProduct[row.id].systemQty = r3(byProduct[row.id].` | **REMOVE** |
| `server/api.js` | 1009 | API | `const bRows = db.prepare(`SELECT * FROM "Batch" WHERE productId IN (${` | **SIMPLIFY** |
| `server/api.js` | 1017 | API | `expiryDate: b.expiryDate ? (typeof b.expiryDate === 'string' ? b.expir` | **REMOVE** |
| `server/api.js` | 1062 | API | `const batches = db.prepare('SELECT * FROM "Batch" WHERE productId=@pro` | **SIMPLIFY** |
| `server/api.js` | 1210 | API | `expiry: item.expiryDate ? (typeof item.expiryDate === 'string' ? item.` | **REMOVE** |
| `server/api.js` | 1298 | API | `// FEFO allocation` | **SIMPLIFY** |
| `server/api.js` | 1299 | API | `const batches = db.prepare(`SELECT * FROM "Batch" WHERE productId=@pro` | **SIMPLIFY** |
| `server/api.js` | 1306 | API | `allocations.push({ batchId: batch.id, batchNo: batch.batchNo, expiryDa` | **REMOVE** |
| `server/api.js` | 1360 | API | `db.prepare('INSERT INTO "SaleItem" (id,tenantId,saleId,productId,batch` | **REMOVE** |
| `server/api.js` | 1361 | API | `.run({ id: siId, tenantId: 'default', saleId, productId: line.productI` | **REMOVE** |
| `server/api.js` | 1421 | API | `expiryDate: i.expiryDate ? (typeof i.expiryDate === 'string' ? i.expir` | **REMOVE** |
| `server/api.js` | 1523 | API | `db.prepare('INSERT INTO "PurchaseItem" (id,tenantId,purchaseId,product` | **REMOVE** |
| `server/api.js` | 1524 | API | `.run({ id: newId(), tenantId: 'default', purchaseId, productId: v.item` | **REMOVE** |
| `server/api.js` | 1557 | API | `db.prepare('INSERT INTO "Batch" (id,tenantId,productId,batchNo,expiryD` | **REMOVE** |
| `server/api.js` | 1558 | API | `.run({ id: batchId, tenantId, productId: item.productId, batchNo, expi` | **REMOVE** |
| `server/api.js` | 1590 | API | `expiryDate: i.expiryDate ? (typeof i.expiryDate === 'string' ? i.expir` | **REMOVE** |
| `server/api.js` | 1680 | API | `expiryDate: i.expiryDate ? (typeof i.expiryDate === 'string' ? i.expir` | **REMOVE** |
| `server/api.js` | 1834 | API | `'purchases', 'suppliers', 'inventory', 'low-stock', 'expiry', 'returns` | **REMOVE** |
| `server/api.js` | 1836 | API | `const SNAPSHOT_TYPES = ['inventory', 'low-stock', 'expiry'];` | **REMOVE** |
| `server/api.js` | 1841 | API | `const CSV_EXPIRY_STATE = { EXPIRED: 'منتهي الصلاحية', NEAR: 'قريب الان` | **REMOVE** |
| `server/api.js` | 1849 | API | `EXPIRY_WRITEOFF: 'إعدام صلاحية',` | **HISTORICAL-DISPLAY-ONLY** |
| `server/api.js` | 1901 | API | `{ header: 'منتهي الصلاحية', get: (r) => r.stockExpired },` | **REMOVE** |
| `server/api.js` | 1912 | API | `expiry: [` | **REMOVE** |
| `server/api.js` | 1916 | API | `{ header: 'تاريخ الانتهاء', get: (r) => (r.expiryDate \|\| '').slice(0` | **REMOVE** |
| `server/api.js` | 1920 | API | `{ header: 'الحالة', get: (r) => CSV_EXPIRY_STATE[r.state] \|\| r.state` | **REMOVE** |
| `server/api.js` | 2085 | API | `const batches = db.prepare("SELECT productId, quantity, costPrice, exp` | **REMOVE** |
| `server/api.js` | 2096 | API | `let stockTotal = 0, stockAvailable = 0, stockExpired = 0, value = 0;` | **REMOVE** |
| `server/api.js` | 2101 | API | `const exp = b.expiryDate ? new Date(b.expiryDate) : null;` | **REMOVE** |
| `server/api.js` | 2102 | API | `if (exp && exp < todayMid) stockExpired += b.quantity;` | **REMOVE** |
| `server/api.js` | 2111 | API | `stockExpired: r3(stockExpired),` | **REMOVE** |
| `server/api.js` | 2126 | API | `const batches = db.prepare("SELECT productId, quantity FROM \"Batch\" ` | **REMOVE** |
| `server/api.js` | 2144 | API | `case 'expiry': {` | **REMOVE** |
| `server/api.js` | 2146 | API | `const warningDays = (settings.pos && settings.pos.expiryWarningDays) \` | **REMOVE** |
| `server/api.js` | 2151 | API | `const batches = db.prepare("SELECT b.batchNo, b.expiryDate, b.quantity` | **REMOVE** |
| `server/api.js` | 2154 | API | `const exp = new Date(b.expiryDate);` | **REMOVE** |
| `server/api.js` | 2155 | API | `const state = exp < todayMid ? 'EXPIRED' : exp <= warningLimit ? 'NEAR` | **REMOVE** |
| `server/api.js` | 2160 | API | `expiryDate: typeof b.expiryDate === 'string' ? b.expiryDate : exp.toIS` | **REMOVE** |
| `server/api.js` | 2173 | API | `expiredCount: all.filter(r => r.state === 'EXPIRED').length,` | **REMOVE** |
| `server/api.js` | 2175 | API | `expiredValue: r2(all.filter(r => r.state === 'EXPIRED').reduce((s, r) ` | **REMOVE** |
| `server/api.js` | 2264 | API | `const warningDays = (settings.pos && settings.pos.expiryWarningDays) \` | **REMOVE** |
| `server/api.js` | 2269 | API | `const batches = db.prepare("SELECT productId, quantity, costPrice, exp` | **REMOVE** |
| `server/api.js` | 2272 | API | `let nearExpiryCount = 0;` | **REMOVE** |
| `server/api.js` | 2273 | API | `let expiredCount = 0;` | **REMOVE** |
| `server/api.js` | 2278 | API | `if (b.expiryDate) {` | **REMOVE** |
| `server/api.js` | 2279 | API | `const expTime = new Date(b.expiryDate).getTime();` | **REMOVE** |
| `server/api.js` | 2281 | API | `expiredCount++;` | **REMOVE** |
| `server/api.js` | 2283 | API | `nearExpiryCount++;` | **REMOVE** |
| `server/api.js` | 2341 | API | `nearExpiryCount,` | **REMOVE** |
| `server/api.js` | 2342 | API | `expiredCount,` | **REMOVE** |
| `server/api.js` | 2349 | API | `inventory: { totalProducts: products.length, lowStockCount, expiringCo` | **REMOVE** |
| `server/db.js` | 147 | DB | `"expiryDate" DATETIME,` | **KEEP-DEPRECATED** |
| `server/db.js` | 199 | DB | `"expiryDate" DATETIME,` | **KEEP-DEPRECATED** |
| `server/db.js` | 235 | DB | `"expiryDate" DATETIME,` | **KEEP-DEPRECATED** |
| `server/db.js` | 332 | DB | ``CREATE INDEX IF NOT EXISTS "Batch_expiryDate_idx" ON "Batch"("expiryD` | **KEEP-DEPRECATED** |
| `server/db.js` | 531 | DB | `AND (expiryDate IS NULL OR date(expiryDate)>=date(?))` | **SIMPLIFY** |
| `src/components/library/app.tsx` | 245 | other | `{/* Proactive operational alerts (low stock / near expiry) */}` | **REVIEW** |
| `src/components/library/parts/alert-ticker.tsx` | 8 | UI | `// Slim, dismissible operational alert strip under the header: expired` | **REMOVE** |
| `src/components/library/parts/alert-ticker.tsx` | 9 | UI | `// near-expiry batches and low-stock items — the numbers store staff m` | **REMOVE** |
| `src/components/library/parts/alert-ticker.tsx` | 20 | UI | `nearExpiryCount: number` | **REMOVE** |
| `src/components/library/parts/alert-ticker.tsx` | 21 | UI | `expiredCount: number` | **REMOVE** |
| `src/components/library/parts/alert-ticker.tsx` | 45 | UI | `if (alive) setData({ lowStockCount: d.lowStockCount, nearExpiryCount: ` | **REMOVE** |
| `src/components/library/parts/alert-ticker.tsx` | 60 | UI | `const expired = data.expiredCount > 0` | **REMOVE** |
| `src/components/library/parts/alert-ticker.tsx` | 61 | UI | `const near = data.nearExpiryCount > 0` | **REMOVE** |
| `src/components/library/parts/alert-ticker.tsx` | 63 | UI | `if (!expired && !near && !low) return null` | **REMOVE** |
| `src/components/library/parts/alert-ticker.tsx` | 65 | UI | `const tone = expired` | **REMOVE** |
| `src/components/library/parts/alert-ticker.tsx` | 77 | UI | `{expired && (` | **REMOVE** |
| `src/components/library/parts/alert-ticker.tsx` | 81 | UI | `<span className="font-bold tabular-nums">{data.expiredCount}</span> صن` | **REMOVE** |
| `src/components/library/parts/alert-ticker.tsx` | 89 | UI | `<span className="font-bold tabular-nums">{data.nearExpiryCount}</span>` | **REMOVE** |
| `src/components/library/parts/kit.tsx` | 248 | UI | `EXPIRED: 'bg-[var(--danger)]/12 text-[var(--danger)] border-[var(--dan` | **REMOVE** |
| `src/components/library/parts/labels.ts` | 55 | UI | `EXPIRY_WRITEOFF: ['إعدام صلاحية', 'Expiry write-off'],` | **HISTORICAL-DISPLAY-ONLY** |
| `src/components/library/parts/labels.ts` | 76 | UI | `export function expiryState(expiry: string \| Date \| null, warningDay` | **REMOVE** |
| `src/components/library/parts/labels.ts` | 77 | UI | `if (!expiry) return 'VALID'` | **REMOVE** |
| `src/components/library/parts/labels.ts` | 78 | UI | `const d = typeof expiry === 'string' ? new Date(expiry) : expiry` | **REMOVE** |
| `src/components/library/parts/labels.ts` | 82 | UI | `if (exp < today) return 'EXPIRED'` | **REMOVE** |
| `src/components/library/parts/labels.ts` | 88 | UI | `if (days < 0) return lang === 'ar' ? `منتهي منذ ${Math.abs(days)} يوم`` | **REMOVE** |
| `src/components/library/screens/dashboard.tsx` | 201 | UI | `{/* expiry alert strip */}` | **REMOVE** |
| `src/components/library/screens/dashboard.tsx` | 203 | UI | `<StatCard label={t('dash.nearExpiry')} value={data.nearExpiryCount} ic` | **REMOVE** |
| `src/components/library/screens/dashboard.tsx` | 204 | UI | `<StatCard label={t('dash.expired')} value={data.expiredCount} icon={<C` | **REMOVE** |
| `src/components/library/screens/diagnostics.tsx` | 96 | UI | `EXPIRED: 'منتهي',` | **REMOVE** |
| `src/components/library/screens/diagnostics.tsx` | 100 | UI | `OFFLINE_GRACE_EXPIRED: 'انتهت مهلة السماح',` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 8 | UI | `// Tab 1: current stock overview · Tab 2: batches & expiry management ` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 13 | UI | `import { movementTypeLabel, expiryState, daysLabel } from '../parts/la` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 64 | UI | `stockExpired: number` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 67 | UI | `nearestExpiry: string \| null` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 77 | UI | `expiryDate: string \| null` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 78 | UI | `daysLeft: number \| null` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 115 | UI | `'EXPIRY_WRITEOFF',` | **HISTORICAL-DISPLAY-ONLY** |
| `src/components/library/screens/inventory.tsx` | 120 | UI | `const EXPIRY_COLORS: Record<string, string> = {` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 121 | UI | `EXPIRED: 'text-[var(--danger)]',` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 168 | UI | `const warningDays = status?.pos?.expiryWarningDays ?? 90` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 177 | UI | `description={t('inv.fefo')}` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 189 | UI | `الباتشات والصلاحية` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 342 | UI | `key: 'stockExpired',` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 343 | UI | `header: t('inv.expired'),` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 345 | UI | `r.stockExpired > 0 ? (` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 347 | UI | `{r.stockExpired}` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 366 | UI | `key: 'nearestExpiry',` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 367 | UI | `header: t('inv.expiryDate'),` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 369 | UI | `if (!r.nearestExpiry) return <span className="text-muted-foreground">—` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 370 | UI | `const state = expiryState(r.nearestExpiry, warningDays)` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 372 | UI | `<div className={cn('whitespace-nowrap text-xs', EXPIRY_COLORS[state])}` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 373 | UI | `<p>{fmtDate(r.nearestExpiry)}</p>` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 374 | UI | `<p className="text-[10px]">{daysLabel(daysUntil(r.nearestExpiry), 'ar'` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 418 | UI | `<Chip active={filter === 'expired'} tone="danger" onClick={() => setFi` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 420 | UI | `{t('inv.expired')}` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 424 | UI | `{t('inv.nearExpiry')}` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 468 | UI | `<th className="px-3 py-2 text-start font-medium">{t('inv.expiryDate')}` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 477 | UI | `const state = expiryState(b.expiryDate, warningDays)` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 483 | UI | `<td className={cn('whitespace-nowrap px-3 py-2 text-xs', EXPIRY_COLORS` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 484 | UI | `{b.expiryDate ? (` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 486 | UI | `<p>{fmtDate(b.expiryDate)}</p>` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 487 | UI | `{b.daysLeft !== null && <p className="text-[10px]">{daysLabel(b.daysLe` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 522 | UI | `// Tab 2 — batches & expiry management` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 538 | UI | `const [stats, setStats] = useState<{ expired: number; near: number; va` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 566 | UI | `const res = await api<Paged<BatchRow> & { stats: { expired: number; ne` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 584 | UI | `async function sweep() {` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 587 | UI | `const res = await api<{ updated: number }>('/inventory/expiry/sweep', ` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 590 | UI | `description: res.updated > 0 ? `تم تحويل ${res.updated} باتش إلى حالة ` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 623 | UI | `key: 'expiryDate',` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 624 | UI | `header: t('inv.expiryDate'),` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 626 | UI | `if (!r.expiryDate \|\| r.daysLeft === null) return <span className="te` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 627 | UI | `const state = expiryState(r.expiryDate, warningDays)` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 629 | UI | `<div className={cn('whitespace-nowrap', EXPIRY_COLORS[state])}>` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 630 | UI | `<p className="text-xs font-medium">{fmtDate(r.expiryDate)}</p>` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 631 | UI | `<p className="text-[10px]">{daysLabel(r.daysLeft, 'ar')}</p>` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 686 | UI | `<SummaryStat label={t('inv.expired')} value={stats.expired} tone="dang` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 687 | UI | `<SummaryStat label={t('inv.nearExpiry')} value={stats.near} tone="warn` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 704 | UI | `<Chip active={filter === 'expired'} tone="danger" onClick={() => setFi` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 705 | UI | `{t('inv.expired')}` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 708 | UI | `{t('inv.nearExpiry')}` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 717 | UI | `<Button variant="outline" size="sm" className="h-9" disabled={sweeping` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 719 | UI | `{t('inv.sweep')}` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 1024 | UI | `{t('inv.expiryDate')}: {batch.expiryDate ? fmtDate(batch.expiryDate) :` | **REMOVE** |
| `src/components/library/screens/inventory.tsx` | 1061 | UI | `<SelectItem value="EXPIRY_WRITEOFF">{movementTypeLabel('EXPIRY_WRITEOF` | **HISTORICAL-DISPLAY-ONLY** |
| `src/components/library/screens/pos.tsx` | 9 | UI | `// FEFO batch allocation server-side, suspend/resume carts, thermal re` | **REMOVE** |
| `src/components/library/screens/pos.tsx` | 87 | UI | `expiredSoon?: boolean` | **REMOVE** |
| `src/components/library/screens/pos.tsx` | 88 | UI | `hasExpiredStock?: boolean` | **REMOVE** |
| `src/components/library/screens/pos.tsx` | 89 | UI | `nearestExpiry?: string \| null` | **REMOVE** |
| `src/components/library/screens/pos.tsx` | 174 | UI | `const warningDays = pos?.expiryWarningDays ?? 90` | **REMOVE** |
| `src/components/library/screens/pos.tsx` | 435 | UI | `title: p.hasExpiredStock ? 'صنف منتهي الصلاحية' : 'غير متاح للبيع',` | **REMOVE** |
| `src/components/library/screens/pos.tsx` | 437 | UI | `p.hasExpiredStock && p.stockAvailable <= 0` | **REMOVE** |
| `src/components/library/screens/pos.tsx` | 438 | UI | `? `${p.nameAr}: كل الرصيد المتاح منتهي الصلاحية ولا يمكن بيعه`` | **REMOVE** |
| `src/components/library/screens/pos.tsx` | 454 | UI | `expiredSoon: !!p.expiredSoon,` | **REMOVE** |
| `src/components/library/screens/pos.tsx` | 473 | UI | `api<{ product: PosProduct; stockAvailable: number; batches: { expiryDa` | **REMOVE** |
| `src/components/library/screens/pos.tsx` | 479 | UI | `// derive expiry flags from the detail batches (list route computes th` | **REMOVE** |
| `src/components/library/screens/pos.tsx` | 482 | UI | `const hasExpiredStock = (res.batches ?? []).some(` | **REMOVE** |
| `src/components/library/screens/pos.tsx` | 483 | UI | `(b) => b.quantity > 0 && b.status === 'EXPIRED' \|\| (b.expiryDate && ` | **REMOVE** |
| `src/components/library/screens/pos.tsx` | 486 | UI | `.filter((b) => b.quantity > 0 && b.expiryDate && new Date(b.expiryDate` | **REMOVE** |
| `src/components/library/screens/pos.tsx` | 487 | UI | `.map((b) => new Date(b.expiryDate as string).getTime())` | **REMOVE** |
| `src/components/library/screens/pos.tsx` | 489 | UI | `const expiredSoon = nearest != null && nearest - today.getTime() <= (w` | **REMOVE** |
| `src/components/library/screens/pos.tsx` | 493 | UI | `hasExpiredStock,` | **REMOVE** |
| `src/components/library/screens/pos.tsx` | 494 | UI | `expiredSoon: !!expiredSoon,` | **REMOVE** |
| `src/components/library/screens/pos.tsx` | 777 | UI | `expiredSoon: !!l.expiredSoon,` | **REMOVE** |
| `src/components/library/screens/pos.tsx` | 1524 | UI | `const nearExpiry =` | **REMOVE** |
| `src/components/library/screens/pos.tsx` | 1525 | UI | `!!product.expiredSoon \|\|` | **REMOVE** |
| `src/components/library/screens/pos.tsx` | 1526 | UI | `(!!product.nearestExpiry &&` | **REMOVE** |
| `src/components/library/screens/pos.tsx` | 1527 | UI | `new Date(product.nearestExpiry).getTime() - Date.now() <= warningDays ` | **REMOVE** |
| `src/components/library/screens/pos.tsx` | 1528 | UI | `new Date(product.nearestExpiry).getTime() >= Date.now())` | **REMOVE** |
| `src/components/library/screens/pos.tsx` | 1578 | UI | `{avail <= 0 && product.hasExpiredStock && (` | **REMOVE** |
| `src/components/library/screens/pos.tsx` | 1581 | UI | `منتهي` | **REMOVE** |
| `src/components/library/screens/pos.tsx` | 1584 | UI | `{nearExpiry && avail > 0 && (` | **REMOVE** |
| `src/components/library/screens/pos.tsx` | 1587 | UI | `قاربت الصلاحية` | **REMOVE** |
| `src/components/library/screens/products.tsx` | 23 | UI | `import { unitLabel, expiryState, daysLabel, movementTypeLabel } from '` | **REMOVE** |
| `src/components/library/screens/products.tsx` | 105 | UI | `expiryDate: string \| null` | **REMOVE** |
| `src/components/library/screens/products.tsx` | 167 | UI | `const warningDays = status?.pos?.expiryWarningDays ?? 90` | **REMOVE** |
| `src/components/library/screens/products.tsx` | 451 | UI | `<div className="flex flex-col" title={`إجمالي الكميات (شامل المنتهي): ` | **REMOVE** |
| `src/components/library/screens/products.tsx` | 458 | UI | `+{formatQty(unavailable, row.isWeighable)} شامل المنتهي` | **REMOVE** |
| `src/components/library/screens/products.tsx` | 957 | UI | `استلم الباتشات من فواتير الشراء — يتم إنشاؤها تلقائياً عند الاستلام وي` | **REMOVE** |
| `src/components/library/screens/products.tsx` | 964 | UI | `<th className="px-3 py-2 text-start font-medium">تاريخ الانتهاء</th>` | **REMOVE** |
| `src/components/library/screens/products.tsx` | 972 | UI | `const state = expiryState(b.expiryDate, warningDays)` | **REMOVE** |
| `src/components/library/screens/products.tsx` | 973 | UI | `const days = b.expiryDate ? daysUntil(b.expiryDate) : null` | **REMOVE** |
| `src/components/library/screens/products.tsx` | 983 | UI | `label={state === 'EXPIRED' ? 'منتهي' : state === 'NEAR' ? 'قريب الانته` | **REMOVE** |
| `src/components/library/screens/products.tsx` | 985 | UI | `{b.expiryDate && (` | **REMOVE** |
| `src/components/library/screens/products.tsx` | 987 | UI | `{fmtDate(b.expiryDate)} · {daysLabel(days ?? 0, 'ar')}` | **REMOVE** |
| `src/components/library/screens/products.tsx` | 1045 | UI | `DEPLETED: 'منتهي الكمية',` | **REMOVE** |
| `src/components/library/screens/products.tsx` | 1047 | UI | `EXPIRED: 'منتهي الصلاحية',` | **REMOVE** |
| `src/components/library/screens/purchases.tsx` | 76 | UI | `expiryDate: string \| null` | **REMOVE** |
| `src/components/library/screens/purchases.tsx` | 107 | UI | `expiryDate: string` | **REMOVE** |
| `src/components/library/screens/purchases.tsx` | 547 | UI | `expiryDate: '',` | **REMOVE** |
| `src/components/library/screens/purchases.tsx` | 583 | UI | `expiryDate: it.expiryDate \|\| undefined,` | **REMOVE** |
| `src/components/library/screens/purchases.tsx` | 610 | UI | `<DialogDescription>اختر المورد والأصناف — حدد رقم الباتش وتاريخ الانته` | **REMOVE** |
| `src/components/library/screens/purchases.tsx` | 756 | UI | `{t('purchases.expiry')} <span className="text-muted-foreground/60">({t` | **REMOVE** |
| `src/components/library/screens/purchases.tsx` | 762 | UI | `value={it.expiryDate}` | **REMOVE** |
| `src/components/library/screens/purchases.tsx` | 763 | UI | `onChange={(e) => updateItem(i, { expiryDate: e.target.value })}` | **REMOVE** |
| `src/components/library/screens/purchases.tsx` | 937 | UI | `<th className="px-3 py-2 text-start font-medium">{t('purchases.expiry'` | **REMOVE** |
| `src/components/library/screens/purchases.tsx` | 962 | UI | `<td className="px-3 py-2 text-xs">{it.expiryDate ? fmtDate(it.expiryDa` | **REMOVE** |
| `src/components/library/screens/reports.tsx` | 73 | UI | `expiryFilter?: boolean` | **REMOVE** |
| `src/components/library/screens/reports.tsx` | 87 | UI | `{ id: 'expiry', ar: 'تقرير الصلاحية', en: 'Expiry Report', icon: Calen` | **REMOVE** |
| `src/components/library/screens/reports.tsx` | 122 | UI | `expiry: [` | **REMOVE** |
| `src/components/library/screens/reports.tsx` | 123 | UI | `{ key: 'expiredCount', ar: 'دفعات منتهية', en: 'Expired batches', tone` | **REMOVE** |
| `src/components/library/screens/reports.tsx` | 124 | UI | `{ key: 'nearCount', ar: 'دفعات قريبة الانتهاء', en: 'Near expiry', ton` | **REMOVE** |
| `src/components/library/screens/reports.tsx` | 125 | UI | `{ key: 'expiredValue', ar: 'قيمة المنتهية', en: 'Expired value', money` | **REMOVE** |
| `src/components/library/screens/reports.tsx` | 126 | UI | `{ key: 'nearValue', ar: 'قيمة القريبة من الانتهاء', en: 'Near expiry v` | **REMOVE** |
| `src/components/library/screens/reports.tsx` | 135 | UI | `const EXPIRY_STATE_LABEL: Record<string, [string, string]> = {` | **REMOVE** |
| `src/components/library/screens/reports.tsx` | 136 | UI | `EXPIRED: ['منتهي الصلاحية', 'Expired'],` | **REMOVE** |
| `src/components/library/screens/reports.tsx` | 137 | UI | `NEAR: ['قريب الانتهاء', 'Near expiry'],` | **REMOVE** |
| `src/components/library/screens/reports.tsx` | 158 | UI | `const [expiryFilter, setExpiryFilter] = useState('all')` | **REMOVE** |
| `src/components/library/screens/reports.tsx` | 179 | UI | `if (def.expiryFilter && expiryFilter !== 'all') params.set('filter', e` | **REMOVE** |
| `src/components/library/screens/reports.tsx` | 195 | UI | `[type, from, to, q, expiryFilter, def]` | **REMOVE** |
| `src/components/library/screens/reports.tsx` | 210 | UI | `if (def.expiryFilter && expiryFilter !== 'all') params.set('filter', e` | **REMOVE** |
| `src/components/library/screens/reports.tsx` | 298 | UI | `{ key: 'stockExpired', header: t('inv.expired'), render: (r) => <span ` | **REMOVE** |
| `src/components/library/screens/reports.tsx` | 310 | UI | `case 'expiry':` | **REMOVE** |
| `src/components/library/screens/reports.tsx` | 315 | UI | `{ key: 'expiryDate', header: t('inv.expiryDate'), render: (r) => fmtDa` | **REMOVE** |
| `src/components/library/screens/reports.tsx` | 321 | UI | `const lbl = (EXPIRY_STATE_LABEL[st] ?? [st, st])[lang === 'ar' ? 0 : 1` | **REMOVE** |
| `src/components/library/screens/reports.tsx` | 322 | UI | `const tone = st === 'EXPIRED' ? 'border-[var(--danger)]/30 bg-[var(--d` | **REMOVE** |
| `src/components/library/screens/reports.tsx` | 478 | UI | `{def.expiryFilter && (` | **REMOVE** |
| `src/components/library/screens/reports.tsx` | 481 | UI | `<Select value={expiryFilter} onValueChange={setExpiryFilter}>` | **REMOVE** |
| `src/components/library/screens/reports.tsx` | 487 | UI | `<SelectItem value="expired">{t('inv.expired')}</SelectItem>` | **REMOVE** |
| `src/components/library/screens/reports.tsx` | 488 | UI | `<SelectItem value="near">{t('inv.nearExpiry')}</SelectItem>` | **REMOVE** |
| `src/components/library/screens/returns.tsx` | 39 | UI | `expiryDate: string \| null` | **REMOVE** |
| `src/components/library/screens/returns.tsx` | 371 | UI | `<th className="px-3 py-2 text-start font-medium">الصلاحية</th>` | **REMOVE** |
| `src/components/library/screens/returns.tsx` | 391 | UI | `{i.expiryDate ? fmtDate(i.expiryDate) : '—'}` | **REMOVE** |
| `src/components/library/screens/returns.tsx` | 490 | UI | `title="لا تملك صلاحية إنشاء المرتجعات"` | **REMOVE** |
| `src/components/library/screens/returns.tsx` | 491 | UI | `hint="راجع مدير النظام لمنحك صلاحية SALES_RETURN"` | **REMOVE** |
| `src/components/library/screens/roles.tsx` | 165 | UI | `description: L('أدخل مفتاح الدور واسمه بالعربية واختر صلاحية واحدة على` | **REMOVE** |
| `src/components/library/screens/sales-history.tsx` | 78 | UI | `expiryDate: string \| null` | **REMOVE** |
| `src/components/library/screens/sales-history.tsx` | 531 | UI | `<th className="px-3 py-2 text-start font-medium">الصلاحية</th>` | **REMOVE** |
| `src/components/library/screens/sales-history.tsx` | 548 | UI | `{i.expiryDate ? fmtDate(i.expiryDate) : '—'}` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 181 | UI | `const noPermHint = L('لا تملك صلاحية تعديل الإعدادات', 'No settings pe` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 250 | UI | `hint={!canHardware ? L('تعديل الأجهزة يتطلب صلاحية إدارة الأجهزة', 'Ha` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 261 | UI | `hint={!canBackup ? L('يتطلب صلاحية إدارة النسخ الاحتياطية', 'Backup ma` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 655 | UI | `description={L('العملة والخصومات والصلاحية وطرق الدفع', 'Currency, dis` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 690 | UI | `label={L('تنبيه قرب الانتهاء (أيام)', 'Expiry warning (days)')}` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 691 | UI | `value={p.expiryWarningDays}` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 694 | UI | `onChange={(v) => setPos({ expiryWarningDays: v })}` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 695 | UI | `hint={L('يُستخدم في تلوين الأصناف وتقرير الصلاحية', 'Drives item highl` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 712 | UI | `{L('السماح ببيع الأصناف منتهية الصلاحية', 'Allow selling expired items` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 716 | UI | `'غير مستحسن — يسمح لنقطة البيع بخصم الكميات من دفعات منتهية الصلاحية ر` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 717 | UI | `'Not recommended — lets POS allocate from expired batches despite warn` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 723 | UI | `checked={p.allowSellingExpired}` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 724 | UI | `onCheckedChange={(v) => setPos({ allowSellingExpired: v })}` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 725 | UI | `aria-label={L('السماح ببيع المنتهي', 'Allow expired')}` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 1014 | UI | `async function sweep() {` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 1017 | UI | `const res = await api<{ updated?: number; swept?: number; count?: numb` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 1022 | UI | `title: L('تم تحديث حالات الصلاحية', 'Expiry sweep done'),` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 1025 | UI | `? L(`تم تعليم ${n} دفعة كمنتهية الصلاحية`, `${n} batches marked expire` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 1029 | UI | `toast({ variant: 'destructive', title: L('تعذر التحديث', 'Sweep failed` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 1043 | UI | `label={L('تنبيه قرب الانتهاء (أيام)', 'Expiry warning (days)')}` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 1044 | UI | `value={<span className="tabular-nums">{p.expiryWarningDays}</span>}` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 1060 | UI | `title={L('تحديث حالات الصلاحية', 'Expiry sweep')}` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 1062 | UI | `'تعليم الدفعات التي تجاوزت تاريخ انتهائها كمنتهية الصلاحية لتستبعدها م` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 1063 | UI | `'Marks batches past expiry as EXPIRED so FEFO selling excludes them'` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 1066 | UI | `<Button size="sm" onClick={() => void sweep()} disabled={sweeping \|\|` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 1068 | UI | `{L('تحديث حالات الصلاحية', 'Run sweep')}` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 1076 | UI | `'يفحص النظام الصلاحية تلقائياً عند الإقلاع، لكن يمكنك تشغيل الفحص يدوي` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 1077 | UI | `'The engine sweeps expired batches on boot, but you can run it manuall` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 1083 | UI | `{L('تشغيل الفحص يتطلب صلاحية تعديل المخزون (INVENTORY_ADJUST).', 'Runn` | **REMOVE** |
| `src/components/library/screens/settings.tsx` | 1340 | UI | `{L('حفظ إعدادات الأجهزة يتطلب صلاحية HARDWARE_MANAGE إضافية.', 'Saving` | **REMOVE** |
| `src/components/library/screens/stocktake.tsx` | 8 | UI | `// Sessions list + counting screen with inline counted quantities + FE` | **REMOVE** |
| `src/components/library/screens/stocktake.tsx` | 50 | UI | `batches: { id: string; batchNo: string; qty: number; expiryDate: strin` | **REMOVE** |
| `src/components/library/screens/stocktake.tsx` | 310 | UI | `التخصيص الآمن <span className="font-semibold">FEFO</span> (استهلاك الب` | **REMOVE** |
| `src/lib/library/api.ts` | 66 | other | ``ليس لديك صلاحية لتنفيذ هذا الإجراء (${permission})`,` | **REVIEW** |
| `src/lib/library/config.ts` | 71 | other | `allowSellingExpired: false,` | **REVIEW** |
| `src/lib/library/config.ts` | 72 | other | `expiryWarningDays: 90,` | **REVIEW** |
| `src/lib/library/config.ts` | 131 | other | `lastExpirySweepAt: null,` | **REVIEW** |
| `src/lib/library/db-schema.ts` | 20 | DB | `"CREATE TABLE IF NOT EXISTS \"Batch\" (\n    \"id\" TEXT NOT NULL PRIM` | **KEEP-DEPRECATED** |
| `src/lib/library/db-schema.ts` | 23 | DB | `"CREATE TABLE IF NOT EXISTS \"PurchaseItem\" (\n    \"id\" TEXT NOT NU` | **KEEP-DEPRECATED** |
| `src/lib/library/db-schema.ts` | 25 | DB | `"CREATE TABLE IF NOT EXISTS \"SaleItem\" (\n    \"id\" TEXT NOT NULL P` | **KEEP-DEPRECATED** |
| `src/lib/library/db-schema.ts` | 43 | DB | `"CREATE INDEX IF NOT EXISTS \"Batch_expiryDate_idx\" ON \"Batch\"(\"ex` | **KEEP-DEPRECATED** |
| `src/lib/library/i18n.ts` | 80 | i18n | `'activation.expired': { ar: 'انتهت صلاحية هذا الترخيص', en: 'This lice` | **KEEP-NON-PRODUCT** |
| `src/lib/library/i18n.ts` | 144 | i18n | `'login.licenseWarning': { ar: 'انتهت صلاحية الترخيص — بعض الوظائف قد ت` | **KEEP-NON-PRODUCT** |
| `src/lib/library/i18n.ts` | 157 | i18n | `'nav.expiry': { ar: 'الصلاحية', en: 'Expiry' },` | **REMOVE** |
| `src/lib/library/i18n.ts` | 181 | i18n | `'dash.nearExpiry': { ar: 'قرب انتهاء الصلاحية', en: 'Near Expiry' },` | **REMOVE** |
| `src/lib/library/i18n.ts` | 182 | i18n | `'dash.expired': { ar: 'منتهية الصلاحية', en: 'Expired' },` | **REMOVE** |
| `src/lib/library/i18n.ts` | 269 | i18n | `'pos.expiredBlock': { ar: 'لا يمكن بيع صنف منتهي الصلاحية', en: 'Canno` | **REMOVE** |
| `src/lib/library/i18n.ts` | 322 | i18n | `'purchases.expiry': { ar: 'تاريخ الانتهاء', en: 'Expiry date' },` | **REMOVE** |
| `src/lib/library/i18n.ts` | 333 | i18n | `'inv.expiry': { ar: 'إدارة الصلاحية', en: 'Expiry Management' },` | **REMOVE** |
| `src/lib/library/i18n.ts` | 337 | i18n | `'inv.writeoff': { ar: 'إعدام منتهي الصلاحية', en: 'Expiry write-off' }` | **REMOVE** |
| `src/lib/library/i18n.ts` | 342 | i18n | `'inv.expiryDate': { ar: 'تاريخ الانتهاء', en: 'Expiry date' },` | **REMOVE** |
| `src/lib/library/i18n.ts` | 343 | i18n | `'inv.daysLeft': { ar: 'الأيام المتبقية', en: 'Days left' },` | **REMOVE** |
| `src/lib/library/i18n.ts` | 344 | i18n | `'inv.expired': { ar: 'منتهي', en: 'Expired' },` | **REMOVE** |
| `src/lib/library/i18n.ts` | 345 | i18n | `'inv.nearExpiry': { ar: 'قريب الانتهاء', en: 'Near expiry' },` | **REMOVE** |
| `src/lib/library/i18n.ts` | 351 | i18n | `'inv.fefo': { ar: 'FEFO — الأقرب انتهاءً يصرف أولاً', en: 'FEFO — Firs` | **REMOVE** |
| `src/lib/library/i18n.ts` | 353 | i18n | `'inv.sweep': { ar: 'تحديث حالات الصلاحية', en: 'Refresh expiry statuse` | **REMOVE** |
| `src/lib/library/i18n.ts` | 354 | i18n | `'inv.sweepDone': { ar: 'تم تحديث حالات الصلاحية', en: 'Expiry statuses` | **REMOVE** |
| `src/lib/library/i18n.ts` | 376 | i18n | `'reports.expiry': { ar: 'تقرير الصلاحية', en: 'Expiry Report' },` | **REMOVE** |
| `src/lib/library/i18n.ts` | 425 | i18n | `'settings.allowExpired': { ar: 'السماح ببيع الأصناف منتهية الصلاحية (غ` | **REMOVE** |
| `src/lib/library/i18n.ts` | 426 | i18n | `'settings.expiryWarning': { ar: 'تنبيه قرب الانتهاء (أيام)', en: 'Expi` | **REMOVE** |
| `src/lib/library/i18n.ts` | 480 | i18n | `'diag.expirySweep': { ar: 'آخر تحديث للصلاحية', en: 'Last expiry sweep` | **REMOVE** |
| `src/lib/library/i18n.ts` | 489 | i18n | `'license.expired': { ar: 'منتهي', en: 'Expired' },` | **KEEP-NON-PRODUCT** |
| `src/lib/library/i18n.ts` | 494 | i18n | `'license.graceExpired': { ar: 'انتهت مهلة السماح', en: 'Offline grace ` | **KEEP-NON-PRODUCT** |
| `src/lib/library/i18n.ts` | 507 | i18n | `'license.daysLeft': { ar: 'متبقي {n} يوم', en: '{n} days left' },` | **KEEP-NON-PRODUCT** |
| `src/lib/library/i18n.ts` | 542 | i18n | `'error.forbidden': { ar: 'ليس لديك صلاحية لتنفيذ هذا الإجراء', en: 'Yo` | **KEEP-NON-PRODUCT** |
| `src/lib/library/i18n.ts` | 543 | i18n | `'error.unauthorized': { ar: 'انتهت الجلسة — أعد تسجيل الدخول', en: 'Se` | **REMOVE** |
| `src/lib/library/services/dashboard.ts` | 20 | service | `nearExpiryCount: number` | **REMOVE** |
| `src/lib/library/services/dashboard.ts` | 21 | service | `expiredCount: number` | **REMOVE** |
| `src/lib/library/services/dashboard.ts` | 47 | service | `const warningDays = pos.expiryWarningDays` | **REMOVE** |
| `src/lib/library/services/dashboard.ts` | 94 | service | `where: { tenantId, quantity: { gt: 0 }, status: { in: ['ACTIVE', 'EXPI` | **REMOVE** |
| `src/lib/library/services/dashboard.ts` | 95 | service | `select: { productId: true, quantity: true, costPrice: true, expiryDate` | **REMOVE** |
| `src/lib/library/services/dashboard.ts` | 122 | service | `let nearExpiryCount = 0` | **REMOVE** |
| `src/lib/library/services/dashboard.ts` | 123 | service | `let expiredCount = 0` | **REMOVE** |
| `src/lib/library/services/dashboard.ts` | 128 | service | `if (b.expiryDate) {` | **REMOVE** |
| `src/lib/library/services/dashboard.ts` | 129 | service | `const exp = new Date(b.expiryDate.getFullYear(), b.expiryDate.getMonth` | **REMOVE** |
| `src/lib/library/services/dashboard.ts` | 130 | service | `if (exp < today) expiredCount++` | **REMOVE** |
| `src/lib/library/services/dashboard.ts` | 131 | service | `else if (exp <= warningLimit) nearExpiryCount++` | **REMOVE** |
| `src/lib/library/services/dashboard.ts` | 165 | service | `nearExpiryCount,` | **REMOVE** |
| `src/lib/library/services/dashboard.ts` | 166 | service | `expiredCount,` | **REMOVE** |
| `src/lib/library/services/inventory.ts` | 6 | service | `// FEFO allocation, batch-safe stock mutations, adjustments, stocktake` | **SIMPLIFY** |
| `src/lib/library/services/inventory.ts` | 24 | service | `expiryDate: Date \| null` | **REMOVE** |
| `src/lib/library/services/inventory.ts` | 30 | service | `* FEFO — First Expiry, First Out.` | **SIMPLIFY** |
| `src/lib/library/services/inventory.ts` | 32 | service | `* expiry date are consumed last (safest commercial interpretation).` | **REMOVE** |
| `src/lib/library/services/inventory.ts` | 33 | service | `* Expired batches are NEVER allocated (unless explicitly allowed at th` | **REMOVE** |
| `src/lib/library/services/inventory.ts` | 39 | service | `opts: { includeExpired?: boolean; tenantId?: string } = {}` | **REMOVE** |
| `src/lib/library/services/inventory.ts` | 50 | service | `orderBy: [{ expiryDate: { sort: 'asc', nulls: 'last' } }, { createdAt:` | **SIMPLIFY** |
| `src/lib/library/services/inventory.ts` | 55 | service | `const eligible = opts.includeExpired` | **REMOVE** |
| `src/lib/library/services/inventory.ts` | 57 | service | `: batches.filter((b) => !b.expiryDate \|\| b.expiryDate >= today)` | **REMOVE** |
| `src/lib/library/services/inventory.ts` | 68 | service | `expiryDate: batch.expiryDate,` | **REMOVE** |
| `src/lib/library/services/inventory.ts` | 161 | service | `if (batch.status === 'DEPLETED' \|\| batch.status === 'EXPIRED') {` | **REMOVE** |
| `src/lib/library/services/inventory.ts` | 180 | service | `/** Total available (sellable) stock for a product = active, non-expir` | **REMOVE** |
| `src/lib/library/services/inventory.ts` | 194 | service | `OR: [{ expiryDate: null }, { expiryDate: { gte: today } }],` | **REMOVE** |
| `src/lib/library/services/inventory.ts` | 203 | service | `export type AdjustmentType = 'ADJUSTMENT' \| 'DAMAGE' \| 'EXPIRY_WRITE` | **HISTORICAL-DISPLAY-ONLY** |
| `src/lib/library/services/inventory.ts` | 246 | service | `countedQty === 0 && input.type === 'EXPIRY_WRITEOFF'` | **HISTORICAL-DISPLAY-ONLY** |
| `src/lib/library/services/inventory.ts` | 247 | service | `? 'EXPIRED'` | **REMOVE** |
| `src/lib/library/services/inventory.ts` | 278 | service | `): Promise<{ sessionId: string; lines: { productId: string; nameAr: st` | **REMOVE** |
| `src/lib/library/services/inventory.ts` | 284 | service | `include: { batches: { where: { quantity: { gt: 0 } }, orderBy: [{ expi` | **SIMPLIFY** |
| `src/lib/library/services/inventory.ts` | 291 | service | `batches: { id: string; batchNo: string; qty: number; expiryDate: Date ` | **REMOVE** |
| `src/lib/library/services/inventory.ts` | 309 | service | `batches: p.batches.map((b) => ({ id: b.id, batchNo: b.batchNo, qty: b.` | **REMOVE** |
| `src/lib/library/services/inventory.ts` | 342 | service | `where: { productId: line.productId, tenantId, quantity: { gt: 0 }, sta` | **REMOVE** |
| `src/lib/library/services/inventory.ts` | 343 | service | `orderBy: [{ expiryDate: { sort: 'asc', nulls: 'last' } }, { createdAt:` | **SIMPLIFY** |
| `src/lib/library/services/inventory.ts` | 351 | service | `// deficit: consume batches FEFO` | **SIMPLIFY** |
| `src/lib/library/services/inventory.ts` | 427 | service | `where: { tenantId, quantity: { gt: 0 }, status: { in: ['ACTIVE', 'EXPI` | **REMOVE** |
| `src/lib/library/services/inventory.ts` | 434 | service | `* Expiry sweep for the ACTIVE tenant only: marks ACTIVE/DEPLETED batch` | **REMOVE** |
| `src/lib/library/services/inventory.ts` | 435 | service | `* their expiry date as EXPIRED so FEFO/sales exclude them, and stamps` | **SIMPLIFY** |
| `src/lib/library/services/inventory.ts` | 436 | service | `* lastExpirySweepAt in the tenant's system config block.` | **REMOVE** |
| `src/lib/library/services/inventory.ts` | 438 | service | `export async function sweepExpiredBatchesForTenant(): Promise<number> ` | **REMOVE** |
| `src/lib/library/services/inventory.ts` | 444 | service | `expiryDate: { lt: new Date() },` | **REMOVE** |
| `src/lib/library/services/inventory.ts` | 447 | service | `data: { status: 'EXPIRED' },` | **REMOVE** |
| `src/lib/library/services/inventory.ts` | 453 | service | `system.lastExpirySweepAt = new Date().toISOString()` | **REMOVE** |
| `src/lib/library/services/inventory.ts` | 459 | service | `// never fail the sweep on a config write issue` | **REMOVE** |
| `src/lib/library/services/purchases.ts` | 26 | service | `expiryDate?: string \| null` | **REMOVE** |
| `src/lib/library/services/purchases.ts` | 102 | service | `expiryDate: v.item.expiryDate ? new Date(v.item.expiryDate) : null,` | **REMOVE** |
| `src/lib/library/services/purchases.ts` | 178 | service | `expiryDate: item.expiryDate,` | **REMOVE** |
| `src/lib/library/services/sales.ts` | 6 | service | `// Atomic sale creation with FEFO allocation, cancellation with restoc` | **SIMPLIFY** |
| `src/lib/library/services/sales.ts` | 103 | service | `expiryDate: Date \| null` | **REMOVE** |
| `src/lib/library/services/sales.ts` | 141 | service | `// FEFO allocation — expired batches are hard-blocked unless policy al` | **SIMPLIFY** |
| `src/lib/library/services/sales.ts` | 143 | service | `includeExpired: pos.allowSellingExpired,` | **REMOVE** |
| `src/lib/library/services/sales.ts` | 252 | service | `// FEFO: one SaleItem per batch allocation for full traceability` | **SIMPLIFY** |
| `src/lib/library/services/sales.ts` | 261 | service | `expiryDate: alloc.expiryDate,` | **REMOVE** |
| `src/lib/library/services/sales.ts` | 333 | service | `// group SaleItems back into logical lines (FEFO splits one line acros` | **SIMPLIFY** |
| `src/lib/library/services/sales.ts` | 355 | service | `expiry: item.expiryDate ? item.expiryDate.toISOString() : null,` | **REMOVE** |
| `src/lib/library/services/tenancy.ts` | 52 | service | `throw new ApiError('FORBIDDEN', `ليس لديك صلاحية لتنفيذ هذا الإجراء ($` | **REMOVE** |
| `src/lib/library/system.ts` | 236 | other | `* Sweeps expired batches and flags them as EXPIRED.` | **REVIEW** |
| `src/lib/library/system.ts` | 238 | other | `export async function sweepExpiredBatches(tenantId = 'default'): Promi` | **REVIEW** |
| `src/lib/library/system.ts` | 244 | other | `expiryDate: { lt: now },` | **REVIEW** |
| `src/lib/library/system.ts` | 247 | other | `status: 'EXPIRED',` | **REVIEW** |
| `src/lib/library/types.ts` | 101 | other | `allowSellingExpired: boolean` | **REVIEW** |
| `src/lib/library/types.ts` | 102 | other | `expiryWarningDays: number` | **REVIEW** |
| `src/lib/library/types.ts` | 132 | other | `lastExpirySweepAt: string \| null` | **REVIEW** |
| `src/lib/library/types.ts` | 161 | other | `\| 'EXPIRED'` | **REVIEW** |
| `src/lib/library/types.ts` | 165 | other | `\| 'OFFLINE_GRACE_EXPIRED'` | **REVIEW** |
| `src/lib/library/types.ts` | 200 | other | `status: 'ACTIVE' \| 'SUSPENDED' \| 'EXPIRED' \| 'REVOKED' \| 'INVALID'` | **REVIEW** |
| `src/lib/library/types.ts` | 315 | other | `expiredSoon: boolean` | **REVIEW** |
| `src/lib/library/types.ts` | 351 | other | `allocations: { batchNo: string \| null; expiry: string \| null; qty: n` | **REVIEW** |
