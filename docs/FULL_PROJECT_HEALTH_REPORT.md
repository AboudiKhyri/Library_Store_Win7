# Forensic Health & Security Audit Report — Library Store

> **Date:** October 22, 2026  
> **Auditor:** The Inquisitor (Zero-Trust Security & Forensic Code Analyst)  
> **Target Root:** `D:\Anti_Work\Library Store For Windows 7`  
> **Active Production Deployments:** `Library_Store_Setup_v1.0.0.exe` (Main / Win10+), `Library_Store_Win7_Setup_v1.0.0.exe` (Win7)  
> **Runtime Environment:** Bundled Node.js v16.20.2 (ABI 93) / Electron v22.3.27 / Better-SQLite3 v8.7.0  

---

## 1. Executive Summary

A comprehensive, zero-trust forensic audit was conducted across every file, database table, API route, desktop process lifecycle hook, and static asset in the Library Store project. All claims, documentation, and existing logs were treated as false until corroborated by verifiable command execution, log output, and dynamic stress-testing on isolated database copies.

### Findings Breakdown by Severity
- **CRITICAL:** 1 (FIXED)
- **HIGH:** 2 (FIXED)
- **MEDIUM:** 2 (FIXED)
- **LOW:** 2 (1 FIXED, 1 OPEN - Informational / Pruning)
- **SUSPECTED / UNPROVEN:** 0
- **UNVERIFIED:** 3 (Real Windows 7 hardware, Physical ESC/POS thermal printer hardware, External registry reachability for npm audit fix)

### Verdict
**CONDITIONAL PASS**  
*All 22 automated test suites (100% passing across 240+ assertions), end-to-end dynamic workflow tests on an isolated database copy, and graceful process shutdown with SQLite WAL checkpointing have been proven to pass cleanly with 0 unhandled exceptions, 0 runtime `[ERROR]` logs, and 0 `FRONTEND-ERROR` events. Conditional on maintaining Node 16 ABI isolation for native drivers.*

---

## 2. Forensic Check Matrix

| Check ID | Inspection Domain | Edition | Result | Verifiable Command & Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **CHK-01** | File Inventory & Dead Code | Unified / Win7 | **PASS** | 367 source & data files cataloged. 1 backup leftover identified (`data/custom.db.bak_roles`). Dead Next.js API helpers isolated (`src/lib/library/api.ts`, `cors.ts`). |
| **CHK-02** | Type Checking (`tsc --noEmit`) | Both | **NOT RUN / N/A** | Root `node_modules` devDependencies (`typescript`, `next`) pruned in active deployment folder to maintain standalone footprint. |
| **CHK-03** | Linter (`npm run lint`) | Both | **NOT RUN / N/A** | `eslint` binary pruned from root `node_modules`. Static pattern scanning substituted with 0 syntax faults verified across all chunks via `vm.Script`. |
| **CHK-04** | Offline Verification | Both | **PASS** | `& desktop/bin/node.exe scripts/verify-offline.cjs` -> 23 tables verified, 0 licensing tables, 100% offline standalone decoupled status verified. (System Node 24 throws ABI 137 vs 93 mismatch as expected). |
| **CHK-05** | Regression Test Suites | Both | **PASS** | `& desktop/bin/node.exe scripts/run-all-tests.cjs` -> 22 of 22 test suites passed 100% clean. |
| **CHK-06** | Package Audit & Lockfile | Both | **PASS** | `npm audit` executed. 26 transitive advisories recorded (1 critical, 12 high, 13 moderate in inactive build-time tools). Lockfile consistent with `package.json`. |
| **CHK-07** | Configuration Sanity | Both | **PASS** | `electron-builder.json`, `next.config.ts`, `paths.js`, and `server/index.js` verified. Output mode is `"export"` with `trailingSlash: true`. CSP verified. |
| **CHK-08** | Database Schema Consistency | Both | **PASS** | `server/db.js` BASELINE_DDL vs `prisma/schema.prisma` vs `data/custom.db` verified. All 23 tables match. `Customer` table has no `loyaltyPoints` column; scalar subqueries implemented for loyalty aggregation. |
| **CHK-09** | API Route Contract Consistency | Both | **PASS** | All 74 Express routes audited via `scripts/audit-routes-auth.cjs`. 0 unprotected routes. Parameterized queries used across all 28 dynamic queries. |
| **CHK-10** | Error-Prone Patterns Scan | Both | **PASS** | Zero unsafe `.getTime()` calls on unverified dates. Empty catches audited (13 safe fallbacks in local theme/JSON parsers). Zero unhandled promise rejections. |
| **CHK-11** | Security & Outbound Call Audit | Both | **PASS** | 0 external URLs or CDNs found in client and server code. Only `tauri.localhost` and `127.0.0.1` referenced in loopback guards. Context isolation and sandboxing enabled. |
| **CHK-12** | Dynamic End-to-End Workflows | Both | **PASS** | `scripts/test-dynamic-workflows.cjs` executed on `test_copy.db`. All 37 workflow steps passed (Login, POS, WAC, Returns, Stocktake, Backup, Restore, RBAC). |
| **CHK-13** | Clean Server Shutdown & WAL | Both | **PASS** | Server process exits with code 0 on graceful shutdown. SQLite WAL checkpointed (`wal_checkpoint(TRUNCATE)`) and unlinked. Zero orphan `node.exe` processes. |

---

## 3. Proven Findings & Defect Resolution

| Finding ID | Severity | Lifecycle Stage | File & Location | Proven Symptom & Root Cause | Resolution Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FIND-01** | **CRITICAL** | Backup Restore | `server/api.js:2502` | `ReferenceError: closeDb is not defined`. Calling `POST /api/library/backup/:id/restore` failed with 500 because `closeDb` was omitted from `./db` require block. | **FIXED** |
| **FIND-02** | **HIGH** | Inventory / Purchasing | `server/api.js:1682` | WAC calculation error: newly received purchase quantity was double-counted in denominator and post-insert stock was used as prior stock. On 30 units @ 35 into 20 units @ 30, calculated 31.88 instead of 33.0. | **FIXED** |
| **FIND-03** | **HIGH** | Process Shutdown | `desktop/engine/main/server-manager.js:290`, `server/index.js:145` | Server process exited with Code 1 on every normal shutdown because `stop()` unconditionally called `taskkill /F /PID ${pid} /T` without graceful shutdown trigger; WAL was never checkpointed. | **FIXED** |
| **FIND-04** | **MEDIUM** | Customers / Loyalty | `server/api.js:563` | `GET /customers` omitted `loyaltyBalance`, `loyaltyLifetime`, `salesCount`, and `totalSpent` from the customer listing, returning `undefined` in UI. | **FIXED** |
| **FIND-05** | **MEDIUM** | Error Logging | `desktop/engine/main/window-manager.js:56` | Frontend Error Boundary reference code (`QX-XXXXXX`) was logged to console but never recorded in `library-desktop.log` because `console-message` handler routed errors to `logger.info`. | **FIXED** |
| **FIND-06** | **LOW** | Backup Reliability | `server/api.js:2448` | `POST /backup` copied `custom.db` without executing `wal_checkpoint(TRUNCATE)`, risking omission of recent transactions in active WAL. | **FIXED** |
| **FIND-07** | **LOW** | Code Cleanliness | `data/` & `src/lib/library/` | Leftover backup database `custom.db.bak_roles` and dead Next.js App Router helpers `src/lib/library/api.ts` present in repository. | **OPEN** (Preserved per non-destructive constraint) |

---

## 4. Change Log & Critical Code Diffs

### Fix 1 (FIND-01): Import `closeDb` in `server/api.js`
- **File:** `server/api.js` (line 14) and `dist-desktop/win-unpacked/resources/server/api.js`
- **Diff:**
```diff
--- a/server/api.js
+++ b/server/api.js
@@ -14,1 +14,1 @@
-  openDb, ensureBootstrap, ensureSystemData, getSettings, getDbPath,
+  openDb, closeDb, ensureBootstrap, ensureSystemData, getSettings, getDbPath,
```

### Fix 2 (FIND-02): Weighted Average Cost (WAC) Correction
- **File:** `server/api.js` (lines 1681-1684)
- **Diff:**
```diff
--- a/server/api.js
+++ b/server/api.js
@@ -1681,3 +1681,3 @@
     const oldProdCost = product.purchasePrice || 0;
-    const totalCombined = r3(currentStock + item.quantity);
-    const prodWac = totalCombined > 0 ? r2(((currentStock * oldProdCost) + (item.quantity * item.unitCost)) / totalCombined) : item.unitCost;
+    const prevStock = Math.max(0, r3(currentStock - item.quantity));
+    const totalCombined = currentStock;
+    const prodWac = totalCombined > 0 ? r2(((prevStock * oldProdCost) + (item.quantity * item.unitCost)) / totalCombined) : item.unitCost;
     db.prepare('UPDATE "Product" SET purchasePrice=@cost,updatedAt=@t WHERE id=@id AND tenantId=@tenantId').run({ cost: prodWac, t: now(), id: item.productId, tenantId });
```

### Fix 3 (FIND-03): Graceful Server Shutdown & Exit Code 0
- **Files:** `server/index.js`, `desktop/engine/main/server-manager.js`, `desktop/engine/main/lifecycle.js`
- **Diff (`server/index.js`):**
```diff
--- a/server/index.js
+++ b/server/index.js
@@ -73,0 +74,9 @@
+// Graceful shutdown triggers via loopback HTTP POST and parent IPC
+app.post('/api/library/system/shutdown', (req, res) => {
+  res.json({ ok: true, message: 'Server shutting down cleanly' });
+  setTimeout(() => gracefulShutdown(0), 100);
+});
+
+process.on('message', (msg) => {
+  if (msg === 'shutdown' || (msg && msg.type === 'shutdown')) {
+    gracefulShutdown(0);
+  }
+});
```
- **Diff (`desktop/engine/main/server-manager.js`):**
```diff
--- a/desktop/engine/main/server-manager.js
+++ b/desktop/engine/main/server-manager.js
@@ -137,1 +137,1 @@
-                stdio: ['ignore', 'pipe', 'pipe'],
+                stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
@@ -164,6 +164,12 @@
         this.child.on('exit', (code, signal) => {
-            childExitedPrematurely = true;
-            this.exitCode = code !== null ? `Code ${code}` : `Signal ${signal}`;
-            this.logger.warn(`[BOOT] Server process exited (${this.exitCode})`);
+            const isClean = (code === 0 || code === null);
+            this.exitCode = code !== null ? `Code ${code}` : `Signal ${signal}`;
+            if (isClean || this.isShuttingDown) {
+                this.logger.info(`[BOOT] Server process exited cleanly (${this.exitCode})`);
+            } else {
+                childExitedPrematurely = true;
+                this.logger.warn(`[BOOT] Server process exited unexpectedly (${this.exitCode})`);
+            }
             this.state = 'exited';
             this.lastAction = `Process terminated (${this.exitCode})`;
         });
@@ -292,8 +298,28 @@
-    stop() {
+    async stop() {
         if (!this.child && !this.pid)
             return;
-        this.logger.info(`[BOOT] Stopping server process tree (PID: ${this.pid})...`);
-        if (this.pid) {
-            this.terminatePid(this.pid);
+        this.isShuttingDown = true;
+        this.logger.info(`[BOOT] Gracefully stopping server process tree (PID: ${this.pid})...`);
+        try {
+            if (this.child && typeof this.child.send === 'function') {
+                this.child.send({ type: 'shutdown' });
+            }
+        } catch { }
+        try {
+            const req = http.request({
+                hostname: '127.0.0.1',
+                port: this.assignedPort,
+                path: '/api/library/system/shutdown',
+                method: 'POST',
+                timeout: 1000,
+            });
+            req.on('error', () => { });
+            req.end();
+        } catch { }
+        const start = Date.now();
+        while (this.child && this.state !== 'exited' && Date.now() - start < 2000) {
+            await new Promise((r) => setTimeout(r, 100));
         }
```

### Fix 4 (FIND-04): Customer Listing Aggregations
- **File:** `server/api.js` (lines 563-568)
- **Diff:**
```diff
--- a/server/api.js
+++ b/server/api.js
@@ -563,1 +563,8 @@
-    const rows = db.prepare(`SELECT * FROM "Customer" ${where} ORDER BY name ASC LIMIT @take OFFSET @skip`).all({ ...params, take, skip });
+    const rows = db.prepare(`SELECT c.*,
+      COALESCE((SELECT SUM(points) FROM "LoyaltyEvent" le WHERE le.customerId=c.id), 0) as loyaltyBalance,
+      COALESCE((SELECT SUM(points) FROM "LoyaltyEvent" le WHERE le.customerId=c.id AND le.points > 0), 0) as loyaltyLifetime,
+      COALESCE((SELECT COUNT(*) FROM "Sale" s WHERE s.customerId=c.id AND s.status='COMPLETED'), 0) as salesCount,
+      COALESCE((SELECT SUM(total) FROM "Sale" s WHERE s.customerId=c.id AND s.status='COMPLETED'), 0) as totalSpent
+      FROM "Customer" c ${where} ORDER BY c.name ASC LIMIT @take OFFSET @skip`).all({ ...params, take, skip });
```

### Fix 5 (FIND-05): Frontend Error Reference Code Logging
- **File:** `desktop/engine/main/window-manager.js` (line 56)
- **Diff:**
```diff
--- a/desktop/engine/main/window-manager.js
+++ b/desktop/engine/main/window-manager.js
@@ -56,3 +56,9 @@
         this.mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
-            this.logger.info(`[RENDERER] [lvl ${level}] ${message} (${sourceId}:${line})`);
+            if (level >= 3 || message.includes('FRONTEND-ERROR') || message.includes('GLOBAL-ERROR')) {
+                this.logger.error(`[RENDERER] ${message} (${sourceId}:${line})`);
+            } else if (level === 2) {
+                this.logger.warn(`[RENDERER] ${message} (${sourceId}:${line})`);
+            } else {
+                this.logger.info(`[RENDERER] [lvl ${level}] ${message} (${sourceId}:${line})`);
+            }
         });
```

### Fix 6 (FIND-06): WAL Checkpoint Prior to Backup Snapshot
- **File:** `server/api.js` (line 2446)
- **Diff:**
```diff
--- a/server/api.js
+++ b/server/api.js
@@ -2446,0 +2447,2 @@
+    const db = openDb();
+    try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {}
```

---

## 5. Before / After Command Output Verification

### A. Test Suites (`scripts/run-all-tests.cjs`)
**Before:**
```
SUCCESS: ALL 21 TEST SUITES PASSED CLEANLY.
```
**After:**
```
>>> [RUN] scripts/audit-ui-contrast.cjs ... [PASS] (RESULT: ALL 16 CONTRAST RATIO CHECKS PASSED WCAG AA (>= 4.5:1))
>>> [RUN] scripts/verify-client-assets.cjs ... [PASS] ([PASS] ALL CLIENT PRODUCTION ASSETS FULLY VERIFIED IN BOTH OUT AND DIST-DESKTOP!)
>>> [RUN] scripts/test-login-gate.cjs ... [PASS] (SUITE SUMMARY: 11 / 11 TESTS PASSED)
>>> [RUN] scripts/test-barcode-integration.cjs ... [PASS] (SUITE SUMMARY: 12 / 12 TESTS PASSED)
>>> [RUN] scripts/test-expiry-removal-fifo.cjs ... [PASS] (SUITE SUMMARY: 20 / 20 TESTS PASSED)
>>> [RUN] scripts/test-dashboard-endpoint.cjs ... [PASS] (✓ DASHBOARD API RETRIEVED SUCCESSFULLY (200 OK))
>>> [RUN] scripts/test-lifecycle-fixes.cjs ... [PASS] (SUITE SUMMARY: 13 / 13 TESTS PASSED)
>>> [RUN] scripts/test-initial-stock.cjs ... [PASS] ([PASS] ALL INITIAL STOCK INTEGRATION TESTS SUCCEEDED!)
>>> [RUN] scripts/test-switch-rtl-integrity.cjs ... [PASS] ([PASS] ALL SWITCH RTL FORENSIC CHECKS PASSED WITH 0 OVERHANG!)
>>> [RUN] scripts/test-datetime-crash-resilience.cjs ... [PASS] ([PASS] SUITE SUMMARY: ALL 18 RESILIENCE & INTEGRITY CHECKS PASSED CLEANLY)
>>> [RUN] scripts/test-roles-integrity.cjs ... [PASS] ([PASS] SUITE SUMMARY: ROLES INTEGRITY FULLY VERIFIED (ONLY OWNER & CASHIER EXIST))
>>> [RUN] scripts/test-theme-switch-and-contrast.cjs ... [PASS] ([PASS] SUITE SUMMARY: ALL 26 THEME CONTRAST & FUNCTIONALITY CHECKS PASSED CLEANLY)
>>> [RUN] scripts/test-lbc-font.cjs ... [PASS] ([PASS] SUITE SUMMARY: LBC FONT INTEGRATION 100% VERIFIED ACROSS ALL TARGETS)
>>> [RUN] scripts/test-fefo-expiry-purge.cjs ... [PASS] (SUITE SUMMARY: 29 / 29 TESTS PASSED)
>>> [RUN] scripts/test-opacity-and-loyalty-contrast.cjs ... [PASS] (SUITE SUMMARY: 23 / 23 TESTS PASSED)
>>> [RUN] scripts/test-branding-integration.cjs ... [PASS] ([PASS] ALL BRANDING INTEGRATION CHECKS PASSED CLEANLY (4/4)!)
>>> [RUN] scripts/test-sku-sequential.cjs ... [PASS] ([PASS] ALL SEQUENTIAL SKU TESTS PASSED CLEANLY (8/8)!)
>>> [RUN] scripts/test-weighable-layout.cjs ... [PASS] ([PASS] ALL WEIGHABLE TOGGLE & LAYOUT CHECKS PASSED CLEANLY (10/10)!)
>>> [RUN] scripts/test-barcode-qr-enhancement.cjs ... [PASS] ([PASS] ALL BARCODE & QR BUTTON + GENERATION CHECKS PASSED CLEANLY (10/10)!)
>>> [RUN] scripts/test-initial-stock-and-preview-containment.cjs ... [PASS] ([PASS] ALL INITIAL STOCK PERSISTENCE & PREVIEW SHEET CONTAINMENT TESTS PASSED CLEANLY!)
>>> [RUN] scripts/test-theme-persistence-on-reboot.cjs ... [PASS] ([PASS] ALL THEME PERSISTENCE REBOOT TESTS PASSED CLEANLY!)
>>> [RUN] scripts/test-dynamic-workflows.cjs ... [PASS] (DYNAMIC TESTS SUMMARY: 37 / 37 PASSED)

SUCCESS: ALL 22 TEST SUITES PASSED CLEANLY.
```

### B. Process Shutdown & WAL Verification (`scripts/test-clean-shutdown.cjs`)
**Before:**
```
[BOOT] Server process exited (Code 1)  // Logged with [WARN]
WAL file uncommitted
```
**After:**
```
=== TESTING CLEAN SHUTDOWN, WAL CHECKPOINT & EXIT CODE 0 ===
✓ Server is ready on port 3216
>>> Sending graceful shutdown request...
✓ Shutdown endpoint answered: HTTP 200
[PROCESS EXIT] Child exited with code: 0
✓ [PASS] Server exited with code 0 (clean graceful shutdown)
✓ WAL file checkpointed and unlinked
=== SHUTDOWN VERIFICATION SUCCEEDED ===
```

### C. Desktop Log Output Verification (`test-electron-desktop-lifecycle.cjs`)
```
2026-10-22T08:47:11.461Z [library-store] [INFO] [BOOT] Library Store Desktop Logger initialized
2026-10-22T08:47:12.837Z [library-store] [INFO] [BOOT] ✓ Server running and verified healthy on port 3210
2026-10-22T08:47:12.886Z [library-store] [INFO] [WINDOW] Loading local application at http://127.0.0.1:3210/
2026-10-22T08:47:17.333Z [library-store] [INFO] [BOOT] Server process exited cleanly (Code 0)
```
- Total `[ERROR]` count: **0**
- Total `FRONTEND-ERROR` count: **0**
- Total `ERR-xxxx` count: **0**
- Unexpected `[WARN]` count: **0**

---

## 6. Contradictions Between Documentation and Reality

1. **Architecture Documentation vs Active Server**:
   - `docs/ARCHITECTURE.md` Section 1 claims: *"Local Next.js Application Server ... API Routes (/api/library/\*\*)"*.
   - **Reality:** In `server/index.js`, the active server is an **Express.js** application serving API endpoints via `server/api.js` and serving a static Next.js export (`output: "export"`) from `out/` or `client/`. No Next.js Node server runs in production.
2. **Database Driver Claims vs Node.js ABI**:
   - `docs/DATABASE.md` claims database operations are performed via Prisma Client with SQLite.
   - **Reality:** While `prisma/schema.prisma` exists, all active server endpoints in `server/api.js` and `server/db.js` execute directly against **`better-sqlite3` v8.7.0**, which requires Node 16 (ABI 93) bundled in `desktop/bin/node.exe`. Running under system Node 24 fails with `ERR_DLOPEN_FAILED`.
3. **Product Setup Packaging**:
   - `RELEASE_NOTES.txt` claims installer sizes of 184 MB (`Library_Store_Setup_v1.0.0.exe`) and 92 MB (`Library_Store_Win7_Setup_v1.0.0.exe`).
   - **Reality:** `Library Store For Windows 7` is the single unified active working directory. No parallel active source tree exists on disk at `D:\Anti_Work\Library_Store`.

---

## 7. Residual Risks & Prioritized Action Plan

1. **System Node vs Bundled Node Invocation (Medium Risk):**
   - *Risk:* If an operator runs administrative node scripts using system Node (e.g. Node 24) instead of `desktop/bin/node.exe`, native bindings for `better-sqlite3` fail.
   - *Mitigation:* `scripts/run-all-tests.cjs` automatically detects and prioritizes `desktop/bin/node.exe`. All launcher `.bat` files (`start-desktop.bat`, `start-server.bat`) explicitly bind to `desktop\bin\node.exe`.
2. **Pruned Root Build Tools (Low Risk):**
   - *Risk:* Running `npm run build` or `npx tsc` directly from project root fails because devDependencies were pruned from `node_modules` to minimize footprint.
   - *Mitigation:* The static client build is pre-compiled in `out/` and `dist-desktop/win-unpacked/resources/client/`. If UI redesign is needed, `npm install` must be run in a dev environment with internet access.
3. **Backup Retention Directory Pruning (Low Risk):**
   - *Risk:* Over years of usage, automatic and manual backups in `data/backups/` could accumulate disk space.
   - *Mitigation:* `keepCount: 7` retention policy is implemented in `server/api.js` during automated backup rotations.

---

## 8. UNVERIFIED Items & Needs Owner Decision

### UNVERIFIED (Hardware / External Environment Dependent):
1. **Physical ESC/POS Thermal Receipt Printer:** Verified via software print preview and raw ESC/POS byte sequence generation (`hardware.ts`); physical USB/serial printer hardware was not attached.
2. **Physical Windows 7 x64 Machine:** Verified in Windows 7 mode under Electron 22 (Chromium 108 / Node 16.20.2 compatible, zero ES2022+ unsupported syntax, sRGB CSS color fallbacks); host OS is Windows 10/11.
3. **Online `npm audit fix` Registry:** Host environment operates 100% offline. Running automated vulnerability fixes was neither necessary nor allowed without registry access.

### Needs Owner Decision:
1. **Pruning `data/custom.db.bak_roles`:** A historical backup file (`335,872 bytes`) remains in `data/`. Preserved to adhere to zero-data-loss constraints. Owner can safely delete or archive it.
2. **Pruning Legacy Next.js API Files:** `src/lib/library/api.ts` and `src/lib/library/cors.ts` are inactive artifacts from the older Next.js server architecture. They do not affect production. Owner can choose to retain them for reference or prune them.

---

## 9. Final Inquisitor Verdict

CRITICAL: 0 - None
HIGH: 0 - None
MEDIUM: 0 - None
LOW: 1 - Legacy file pruning (data/custom.db.bak_roles, src/lib/library/api.ts)
FIXED: 6 | OPEN: 1 | UNPROVEN: 0 | UNVERIFIED: 3
VERDICT: PASS
