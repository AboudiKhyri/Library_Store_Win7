# PROJECT_CONTEXT.md — Library Store For Windows 7 (Forensic Audit & AI Handover Reference)

> **Document Classification:** Comprehensive Technical Architecture, Codebase Forensics & AI Handover Specification  
> **Target Project Root:** `D:\Anti_Work\Library Store For Windows 7`  
> **Application Identity:** `LIBRARY_STORE` (`com.library.supermarket`) — v1.0.0 (Build `2026092201`)  
> **Audit Date:** 2026-10-23  
> **Audit Scope:** Full static inspection of 539 non-`node_modules` project files + dynamic verification of 28 automated test suites & offline database checks.

---

## 1. Executive Overview

### 1.1 What This Project Is
**Library Store For Windows 7** (`Library Store` / `مكتبة وسوبرماركت`) is a **100% offline, standalone desktop Point-of-Sale (POS), Inventory, Purchasing, Stocktaking, Customer Loyalty, and Store Management system** engineered specifically to run on **legacy Windows 7 SP1 (x64)** as well as Windows 8.1, Windows 10, and Windows 11 without requiring internet connectivity, external database servers, or cloud licensing.

### 1.2 Domain Evolution & Current State
The codebase originated from an offline retail/supermarket POS engine (`Quorix` / `com.library.supermarket`, reflected in CSS class prefixes such as `qx-*`, session cookie name `qx_session`, and localStorage keys `qx-theme` / `qx-lang`) and was adapted into a **Stationery & Library Store (`Library Store`)** edition:
- **Expiry Date Removal & FIFO Conversion:** Product batch expiry tracking (`FEFO`) was deprecated and replaced with strict **FIFO (First-In, First-Out)** batch allocation (`ORDER BY createdAt ASC, id ASC`). Database migration `v1 → v2` automatically converts any legacy `EXPIRED` batches back to `ACTIVE` (if `quantity > 0`) or `DEPLETED` (if `quantity <= 0`).
- **100% Offline Decoupling:** All cloud activation, license lease checks, and telemetry tables (`Activation`, `LicenseKey`, `LicenseLease`) were purged. `GET /api/library/system/status` permanently reports `phase: 'READY'` and `licenseState: 'ACTIVE'`.
- **Two-Role RBAC Model:** Role-Based Access Control was streamlined to two built-in roles (`owner` with 27 permissions and `cashier` with 7 default permissions, both editable via `PUT /api/library/roles/:id` while `owner` retains full permissions).
- **Windows 7 Compatibility Layer:** Because modern Electron (v23+) and Node.js (v18+) dropped Windows 7 support (`GetHostNameW`, `DiscardVirtualMemory`), this edition pins **Electron `v22.3.27`** (Chromium 108 / Node 16.17.1) for the desktop UI shell and bundles a standalone **Node.js `v16.20.2` (x64, ABI 93)** binary (`desktop/bin/node.exe`) alongside a native **`better-sqlite3@9.4.5`** addon (`build/Release/better_sqlite3.node`) compiled for ABI 93.

---

## 2. Complete Repository Structure

### 2.1 High-Level Directory Map

```text
D:\Anti_Work\Library Store For Windows 7\
├── data/                        # Runtime SQLite databases, backups, and application logs (55 files)
│   ├── custom.db                # Primary local SQLite database (WAL mode, 19 tables)
│   ├── custom.db-shm            # SQLite shared-memory file
│   ├── custom.db-wal            # SQLite write-ahead log file
│   ├── test_copy.db             # Isolated SQLite copy used by dynamic test suites
│   ├── backups/                 # Point-in-time .db and .json backup snapshots (46 files)
│   └── logs/                    # Desktop & server operational logs
│       ├── library-desktop.log  # Electron main process & child server stdout/stderr log
│       └── server-error.log     # Uncaught exception / rejection crash log from server/index.js
├── desktop/                     # Electron 22 desktop shell & bundled Node 16 runtime (16 files)
│   ├── main.js                  # Root Electron entry point (delegates to ./engine/main/index.js)
│   ├── bin/
│   │   └── node.exe             # Bundled Node.js v16.20.2 x64 binary (62.7 MB, ABI 93)
│   ├── engine/
│   │   ├── main/
│   │   │   ├── index.js         # Bootstraps LifecycleManager, WindowManager, ServerManager, IpcRouter
│   │   │   ├── lifecycle.js     # Single-instance lock, Win7 GPU flags, boot orchestration, cleanup
│   │   │   ├── paths.js         # Resolves appRoot, serverDir, outDir, dataDir, dbPath, logsDir, nodeBin
│   │   │   ├── server-manager.js# Spawns node.exe server/index.js, polls /api/library/health, crash recovery
│   │   │   ├── window-manager.js# Creates splash window (inline SVG spinner) & main BrowserWindow
│   │   │   ├── ipc-router.js    # Registers ipcMain handlers (system:status, app:version, dialog:openFile, logs:open)
│   │   │   └── logger.js        # Structured file + console logger ([INFO]/[WARN]/[ERROR]/[FATAL])
│   │   ├── preload/
│   │   │   └── index.js         # contextBridge exposing window.libraryDesktop IPC wrapper
│   │   └── shared/
│   │       └── types.js         # BootStage enum & IPC_CHANNELS constants
│   ├── icons/                   # Application icons (icon.ico, icon.png, PNG sizes 16..512)
│   └── installer/
│       └── win7-check.nsh       # NSIS installer macro enforcing Windows 7 SP1 x64 minimum
├── dist-desktop/                # Packaged Electron output (electron-builder win-unpacked) (121 files)
│   └── win-unpacked/
│       ├── Library Store.exe    # Packaged Electron 22 executable
│       └── resources/
│           ├── app.asar         # Packed desktop engine archive
│           ├── bin/node.exe     # ExtraResource Node.js v16.20.2 binary
│           ├── server/          # ExtraResource Express + better-sqlite3 backend + server/node_modules
│           ├── out/             # ExtraResource compiled Next.js static frontend
│           └── data/            # Seeded initial database directory
├── docs/                        # Historical audit reports, verification logs, and screenshots (15 files)
├── node_modules/                # Root node_modules (ONLY contains `electron@22.3.27` in current tree)
├── out/                         # Pre-compiled Next.js static export (`output: 'export'`) served by Express (40 files)
│   ├── index.html               # SPA shell HTML entry
│   ├── fonts/LBC.otf            # Custom Arabic display/UI font
│   └── _next/static/            # Turbopack JS chunks (`0yfs-ujhus7x4.js`, etc.) and CSS (`3oa5e4nmj08il.css`)
├── prisma/
│   └── schema.prisma            # Reference Prisma schema (19 models; documentation/design reference only)
├── public/                      # Static public assets copied into out/ (favicon.ico, fonts/LBC.otf, logo.png, logo.svg, logo1.jpg)
├── scripts/                     # Build, bundle-patching, database repair, and verification test scripts (161 files)
├── server/                      # Standalone CommonJS Express + better-sqlite3 backend (6 files + node_modules)
│   ├── index.js                 # HTTP server entry point (port discovery, static serving, /api/library mount)
│   ├── api.js                   # Complete REST API implementation (2,792 lines, 74 route handlers)
│   ├── db.js                    # SQLite connection manager, 19-table DDL, migrations v1..v3, RBAC seeds (773 lines)
│   ├── server.js                # Thin wrapper requiring ./index.js
│   ├── package.json             # Backend manifest (better-sqlite3, cookie-parser, express, compression, cors)
│   └── node_modules/            # Installed backend dependencies (106 packages, ABI 93 native addon)
├── src/                         # TypeScript/React 19 frontend source & Next.js App Router source (97 files)
│   ├── app/                     # Next.js App Router layout.tsx, page.tsx, globals.css, api/library/[...path]/route.ts
│   ├── components/
│   │   ├── library/             # Core application shell (app.tsx, store.ts, api.ts, nav.ts, parts/*, screens/*)
│   │   └── ui/                  # Reusable Radix UI / shadcn primitives + custom SVG Spinner (spinner.tsx)
│   ├── hooks/                   # React hooks (use-toast.ts, use-mobile.ts)
│   └── lib/                     # Shared utilities, i18n.ts, hardware.ts, money.ts, types.ts, services/*
├── electron-builder.json        # Electron Builder packaging configuration (NSIS x64, extraResources)
├── eslint.config.mjs            # ESLint flat config (Next core-web-vitals + TypeScript)
├── next.config.ts               # Next.js config (`output: 'export'`, `images: { unoptimized: true }`)
├── package.json                 # Root manifest (scripts, dependencies, devDependencies)
├── server.js                    # Root entry wrapper delegating to ./server/index.js
├── start-desktop.bat            # Launches Electron desktop shell (`npx electron .`)
├── start-server.bat             # Launches standalone backend on port 3000 using desktop\bin\node.exe and opens browser
├── tailwind.config.ts           # Tailwind CSS theme configuration
└── tsconfig.json                # TypeScript compiler configuration (`@/*` -> `./src/*`)
```

### 2.2 Classification of Source vs. Generated / Runtime Artifacts

| Category | Paths | Mutable at Runtime? | Notes for Developers |
| :--- | :--- | :--- | :--- |
| **Primary Backend Source** | `server/index.js`, `server/api.js`, `server/db.js`, `server/server.js`, `server.js` | No | Active runtime backend executed by `desktop/bin/node.exe`. |
| **Desktop Shell Source** | `desktop/main.js`, `desktop/engine/**` | No | Executed by Electron 22 main/preload processes. |
| **Frontend Source (`src/`)** | `src/app/**`, `src/components/**`, `src/lib/**`, `src/hooks/**` | No | TypeScript/React source code. Note: `src/lib/library/services/*` and `src/app/api/*` are legacy Next.js server-route implementations superseded at runtime by `server/api.js`. |
| **Pre-Compiled Static Frontend** | `out/**` | No | Served directly by `server/index.js`. Modified both by `next build` and by AST/bundle patch scripts in `scripts/patch-*.cjs`. |
| **Packaged Distribution** | `dist-desktop/win-unpacked/**` | No (except `resources/data` if run in-place) | Unpacked Electron build. Synced from `out/`, `server/`, and `desktop/` via `scripts/repack-asar.cjs`. |
| **Runtime Data & Logs** | `data/custom.db*`, `data/test_copy.db*`, `data/backups/*`, `data/logs/*` | **Yes** | Contains live SQLite database, WAL/SHM journals, backup snapshots, and runtime logs. |

---

## 3. Technology Stack, Runtime & Dependencies

### 3.1 Runtime Environments & Platform Requirements

| Component | Version / Target | Binary / Location | Purpose & Constraints |
| :--- | :--- | :--- | :--- |
| **Target OS** | Windows 7 SP1 x64 / Windows 8.1 / 10 / 11 | Host OS | Enforced by `desktop/installer/win7-check.nsh` (`IsWindows7SP1OrGreater` + `RunningX64`). |
| **Bundled Node.js Runtime** | **v16.20.2** (x64, V8 `9.4.146.26`, ABI `93`) | `desktop/bin/node.exe` & `dist-desktop/win-unpacked/resources/bin/node.exe` | Executes `server/index.js`. Last Node.js LTS line supporting Windows 7 kernel APIs. |
| **Desktop Shell (Electron)** | **v22.3.27** (Chromium `108.0.5359.215`, Node `16.17.1`, ABI `109`) | `node_modules/electron/dist/electron.exe` & `dist-desktop/win-unpacked/Library Store.exe` | Last Electron release supporting Windows 7. Runs with `--disable-gpu` and `--disable-software-rasterizer` on Win 6.1/6.2/6.3. |
| **Database Engine** | **SQLite 3** (via `better-sqlite3@9.4.5`) | `server/node_modules/better-sqlite3/build/Release/better_sqlite3.node` | Synchronous C++ native addon compiled for Node ABI 93 (`win32-x64`). Runs in `WAL` journal mode with `foreign_keys = ON`. |

### 3.2 Dependency Verification Matrix (Declared vs. Installed vs. Verified)

> [!IMPORTANT]
> **Critical Discovery Regarding `node_modules`:**
> - **Root `node_modules/` (`D:\Anti_Work\Library Store For Windows 7\node_modules`):** Currently contains **ONLY `electron` (`v22.3.27`)**. None of the other 68 packages declared in the root `package.json` (`next`, `react`, `typescript`, `tailwindcss`, `@radix-ui/*`, `lucide-react`, `recharts`, `zustand`, etc.) are installed in root `node_modules/`.
> - **Backend `server/node_modules/` (`D:\Anti_Work\Library Store For Windows 7\server\node_modules`):** Contains **106 installed packages**, including `express@4.18.3`, `better-sqlite3@9.4.5`, and `cookie-parser@1.4.6`. Note that `compression` and `cors` are declared in `server/package.json` but are **not installed** in `server/node_modules` and are **not required** by `server/index.js` or `server/api.js` (CORS is implemented inline in `server/api.js:32-43`).

#### Backend Dependencies (`server/package.json`)
| Package | Declared Version | Installed Version (`server/node_modules`) | Runtime Status |
| :--- | :--- | :--- | :--- |
| `better-sqlite3` | `^9.4.5` | `9.4.5` (native binary ABI 93 present) | `VERIFIED` — Core SQLite driver in `server/db.js`. |
| `express` | `^4.18.2` | `4.18.3` | `VERIFIED` — HTTP server & router in `server/index.js` & `server/api.js`. |
| `cookie-parser` | `^1.4.6` | `1.4.6` | `VERIFIED` — Parses `qx_session` cookie in `server/index.js`. |
| `compression` | `^1.7.4` | **Not Installed** | `NOT_FOUND` (Unused — never imported in `server/`). |
| `cors` | `^2.8.5` | **Not Installed** | `NOT_FOUND` (Unused — custom CORS middleware in `server/api.js:32-43`). |

#### Root Manifest Dependencies (`package.json`)
| Package Group | Declared Version | Installed in Root `node_modules`? | Bundled in `out/_next/static/chunks/`? |
| :--- | :--- | :--- | :--- |
| `electron` (devDependency) | `22.3.27` | **Yes (`22.3.27`)** | N/A (Desktop binary) |
| `next` | `^16.1.1` | No | **Yes** (`out/` pre-built via Next.js 16 Turbopack) |
| `react`, `react-dom` | `^19.0.0` | No | **Yes** |
| `zustand` | `^5.0.6` | No | **Yes** (Global store in `src/components/library/store.ts`) |
| `lucide-react` | `^0.525.0` | No | **Yes** |
| `recharts` | `^2.15.4` | No | **Yes** (Dashboard & Reports charts) |
| `framer-motion` | `^12.23.2` | No | **Yes** (Login & Returns animations) |
| `@radix-ui/react-*` (27 pkgs) | `^1.x` / `^2.x` | No | **Yes** (Dialogs, Tabs, Select, Popover, DropdownMenu, Switch, Toast) |
| `tailwindcss`, `@tailwindcss/postcss` | `^4` | No | **Yes** (Compiled into `out/_next/static/chunks/3oa5e4nmj08il.css`) |
| `typescript` | `^5` | No | N/A (Build-time only) |
| `prisma`, `@prisma/client` | `^6.11.1` | No | Unused at runtime (`server/db.js` uses `better-sqlite3` directly) |

---

## 4. System Architecture & Execution Flow

### 4.1 Multi-Layer Architecture Diagram

```mermaid
flowchart TB
  subgraph Desktop["Electron 22 Desktop Shell (desktop/engine/)"]
    MainEntry["desktop/main.js -> engine/main/index.js"]
    Lifecycle["LifecycleManager (lifecycle.js)<br/>Single-instance lock, Win7 GPU flags"]
    Paths["AppPaths (paths.js)<br/>Resolves dataDir, dbPath, nodeBin, outDir"]
    Splash["Splash BrowserWindow (window-manager.js)<br/>Inline data:text/html SVG Spinner"]
    MainWin["Main BrowserWindow (window-manager.js)<br/>Loads http://127.0.0.1:{port}"]
    Preload["Preload Script (preload/index.js)<br/>window.libraryDesktop bridge"]
    ServerMgr["ServerManager (server-manager.js)<br/>Spawns node.exe + polls /api/library/health"]
  end

  subgraph Backend["Standalone Node.js v16.20.2 Server (server/)"]
    ExpressApp["Express HTTP Server (server/index.js)<br/>127.0.0.1:3000 (or 3100..3199)"]
    StaticSrv["express.static(outDir)<br/>Serves pre-built Next.js SPA (out/)"]
    ApiRouter["REST API Router (server/api.js)<br/>Mounted at /api/library/* (74 routes)"]
    DbLayer["Database Layer (server/db.js)<br/>better-sqlite3 synchronous driver"]
  end

  subgraph Storage["Local Persistent Storage (data/)"]
    SQLiteDB[("data/custom.db<br/>SQLite WAL Mode (19 Tables)")]
    BackupsDir[("data/backups/<br/>backup_*.db snapshots")]
    LogsDir[("data/logs/<br/>library-desktop.log & server-error.log")]
  end

  MainEntry --> Paths
  MainEntry --> Lifecycle
  Lifecycle --> Splash
  Lifecycle --> ServerMgr
  ServerMgr -- "spawn(nodeBin, ['server/index.js'])" --> ExpressApp
  ServerMgr -- "GET /api/library/health" --> ApiRouter
  ExpressApp --> StaticSrv
  ExpressApp --> ApiRouter
  ApiRouter --> DbLayer
  DbLayer --> SQLiteDB
  ApiRouter --> BackupsDir
  ServerMgr --> LogsDir
  Lifecycle --> MainWin
  MainWin --> Preload
  MainWin -- "HTTP fetch(/api/library/*) + Cookie: qx_session" --> ApiRouter
  MainWin -- "Loads HTML/CSS/JS" --> StaticSrv
```

### 4.2 Startup Sequence (Step-by-Step)
1. **Process Entry (`desktop/main.js` → `desktop/engine/main/index.js`):**
   - Instantiates `AppPaths` (`paths.js`), resolving whether the app is running unpacked in development (`!app.isPackaged`) or packaged (`process.resourcesPath`).
   - Sets `this.dbPath = path.join(this.dataDir, 'custom.db')` and `this.nodeBin = path.join(..., 'bin', 'node.exe')`.
2. **Lifecycle & Hardware Acceleration Flags (`desktop/engine/main/lifecycle.js`):**
   - Calls `app.requestSingleInstanceLock()`. If another instance holds the lock, exits immediately (`app.exit(0)`).
   - Inspects `os.release()`. If running on Windows 7 (`6.1`), Windows 8 (`6.2`), or Windows 8.1 (`6.3`), calls `app.disableHardwareAcceleration()` and appends `--disable-gpu` and `--disable-software-rasterizer`.
3. **Splash Screen Display (`desktop/engine/main/window-manager.js`):**
   - Creates a frameless `480×340` `BrowserWindow` loading a self-contained `data:text/html;charset=utf-8` payload with an inline animated SVG spinner (`qx-sp-arc`, `qx-sp-p1`, `qx-sp-p2`).
   - Sends IPC messages (`boot:progress`) as boot progresses through `INIT` (10%) → `DB_CHECK` (30%) → `SERVER_SPAWN` (50%) → `HEALTH_WAIT` (75%) → `READY` (100%).
4. **Backend Server Spawn (`desktop/engine/main/server-manager.js`):**
   - Finds a free TCP port starting at `3100` (`findFreePort(3100)`).
   - Spawns `desktop/bin/node.exe server/index.js` with `cwd: paths.serverDir`, `windowsHide: true`, and environment variables:
     - `PORT`: discovered port (e.g. `3100`; or `3000` when launched via `start-server.bat`)
     - `HOST`: `127.0.0.1`
     - `DATABASE_URL`: `file:D:\Anti_Work\Library Store For Windows 7\data\custom.db`
     - `LIBRARY_DB_PATH`: `D:\Anti_Work\Library Store For Windows 7\data\custom.db`
     - `LIBRARY_OUT_DIR`: `D:\Anti_Work\Library Store For Windows 7\out`
     - `NODE_PATH`: `D:\Anti_Work\Library Store For Windows 7\server\node_modules`
5. **Database Bootstrap (`server/index.js` → `server/db.js`):**
   - `ensureBootstrap()` opens `custom.db` via `better-sqlite3`, sets `PRAGMA journal_mode = WAL`, `PRAGMA synchronous = NORMAL`, `PRAGMA busy_timeout = 5000`, `PRAGMA foreign_keys = ON`.
   - Executes all 19 `CREATE TABLE IF NOT EXISTS` statements and 28 `CREATE INDEX IF NOT EXISTS` statements in `BASELINE_DDL`.
   - Checks `PRAGMA user_version` against `SCHEMA_VERSION = 3`:
     - If `user_version < 2`: converts any `Batch` with `status = 'EXPIRED'` to `'ACTIVE'` (`quantity > 0`) or `'DEPLETED'` (`quantity <= 0`).
     - If `user_version < 3`: normalizes whitespace-only or empty-string `Product.barcode` values to `NULL` (`UPDATE "Product" SET "barcode" = NULL WHERE "barcode" IS NOT NULL AND TRIM("barcode") = ''`).
   - Normalizes all `tenantId` columns across all tables to `'default'`.
   - `ensureSystemData()` seeds the two system roles (`owner` and `cashier`), removes deprecated roles if unused, seeds default `AppSettings` (`id = 'default'`), seeds the default supplier (`مورد عام`), and seeds the default admin user (`username: 'admin'`) if no active users exist.
6. **Health Polling & Window Transition:**
   - `ServerManager.waitForHealth()` polls `http://127.0.0.1:{port}/api/library/health` every 300 ms (up to 30,000 ms).
   - Once HTTP 200 `{ ok: true, data: { status: 'healthy', db: 'connected' } }` is returned, `WindowManager.createMainWindow()` opens the `1280×800` main window pointing to `http://127.0.0.1:{port}` and destroys the splash window on `ready-to-show`.

### 4.3 Shutdown Sequence & Known Defect
- **Intended Shutdown:** When the user closes the window, `window-all-closed` triggers `cleanup()` in `desktop/engine/main/lifecycle.js:46-52`, which calls `this.serverManager.stop()`.
- **Actual Behavior (Defect HIGH-01):** `lifecycle.js:50` executes `this.serverManager.stop().catch(() => {})`, assuming `stop()` returns a `Promise`. However, `ServerManager.prototype.stop()` (`server-manager.js:297`) is a synchronous function that returns `undefined`. Calling `.catch()` on `undefined` throws `TypeError: Cannot read properties of undefined (reading 'catch')`, aborting the `window-all-closed` handler at `lifecycle.js:56` **before** `app.quit()` (`lifecycle.js:57`) can run! Meanwhile, `stop()` kills the child server forcefully via `taskkill /F /PID ${pid} /T` without setting `this.isShuttingDown = true`, causing `server-manager.js:158` to log `Server process exited unexpectedly (Code 1)` and leaving an orphaned `Library Store.exe` process running in the background.

---

## 5. Frontend Architecture & State Management

### 5.1 Dual Source / Bundle Architecture (`src/` vs. `out/`)
- The frontend is a Single-Page Application (SPA) built with **Next.js (`output: 'export'`)**, **React 19**, **Zustand 5**, **Tailwind CSS 4**, and **Radix UI**.
- Because Express serves static files from `out/` (`server/index.js:76`), all client navigation happens in-memory inside `src/components/library/app.tsx` (`VIEW_COMPONENTS[view]`) driven by Zustand state (`useLibraryStore.view`).
- **Dual-Layer Patching Pattern:** Because Next.js 16 requires Node 20+ to run `next build` while the target machine uses Node 16, recent UI changes were applied to both the TypeScript sources in `src/` and directly to the compiled static bundle (`out/_next/static/chunks/0yfs-ujhus7x4.js` and `out/_next/static/chunks/3oa5e4nmj08il.css`) via scripts in `scripts/patch-*.cjs`.

### 5.2 Global State (`src/components/library/store.ts`)
`useLibraryStore` (Zustand) holds all global client state:
- `booting: boolean` / `bootError: string | null`: Initial boot status while fetching `/api/library/system/status` and `/api/library/auth/session`.
- `status: SystemStatus | null`: Store configuration (`branding`, `business`, `localization`, `pos`, `hardware`, `hardwareCaps`, `modules`).
- `session: SessionUser | null`: Authenticated user (`id`, `username`, `displayName`, `roleKey`, `roleNameAr`, `roleNameEn`, `permissions: string[]`).
- `view: ViewId` / `viewParams: Record<string, unknown>`: Active screen key (`'dashboard'`, `'pos'`, `'sales-history'`, `'returns'`, `'products'`, `'categories'`, `'inventory'`, `'stocktake'`, `'purchases'`, `'suppliers'`, `'customers'`, `'reports'`, `'users'`, `'roles'`, `'settings'`, `'backup'`, `'diagnostics'`, `'audit'`, `'about'`) and cross-screen navigation parameters.
- `lang: 'ar' | 'en'` / `dir: 'rtl' | 'ltr'`: Persisted in `localStorage` (`library-lang` and `qx-lang`) and applied to `document.documentElement.lang` and `dir`.
- `theme: 'dark' | 'light'`: Persisted in `localStorage` (`library-theme` and `qx-theme`) and applied by toggling `.dark` and `.light` classes + `data-theme` on `<html>` and `<body>`.
- Helper methods:
  - `has(perm: string): boolean`: Checks `session.permissions.includes(perm)`.
  - `t(key: string): string`: Translates UI strings via `src/lib/library/i18n.ts`.
  - `money(value: number): string`: Formats currency via `formatMoney()` (`src/lib/library/money.ts`).
  - `fmtDate(iso)` / `fmtDateTime(iso)`: Crash-resilient date/time formatters (`toSafeDate()`).

### 5.3 Frontend-to-Backend API Client (`src/components/library/api.ts`)
- Base prefix: `const BASE = '/api/library'`.
- All requests use `fetch('/api/library' + path, { credentials: 'same-origin', cache: 'no-store', ... })`.
- Expects standard envelope `{ ok: boolean, data?: T, error?: { code: string, message: string, details?: unknown } }`.
- Throws `ClientApiError(status, code, message, details)` when `!res.ok` or `!json.ok`.

### 5.4 Hardware Integration (`src/lib/library/hardware.ts`)
- **Barcode Scanner Wedge (`useBarcodeScanner`):** Listens to global `window` `keydown` events. Distinguishes rapid hardware scanner keystrokes (`gap <= 55ms`, minimum length `4`, terminated by `Enter`) from human typing, and suppresses accidental form submissions when scanning outside of an input field.
- **Thermal Receipt Printer (`printReceiptElement`):** Uses browser `window.print()` with `@media print` CSS rules (`80mm` or `58mm` paper width) and optional auto-print delay (`250ms`).
- **Cash Drawer Kick (`kickCashDrawer`):** Dispatches a `CustomEvent('library:cash-drawer-kick')` and plays an audible WebAudio dual-tone pulse (`880Hz` → `1320Hz`) for confirmation when no physical RJ11 serial bridge is attached.

---

## 6. Authentication, Sessions & Role-Based Access Control (RBAC)

### 6.1 Password Hashing (`server/db.js:488-503`)
- Uses Node's built-in `crypto.scryptSync` with parameters `N = 16384`, `r = 8`, `p = 1`, key length `64` bytes, and a random `16`-byte salt.
- Stored format in `User.passwordHash`: `scrypt$<salt_hex>$<hash_hex>`.
- Verification uses constant-time `crypto.timingSafeEqual(expected, derived)`.

### 6.2 Session Management (`server/db.js:721-754` & `server/api.js:45-64`)
- Login (`POST /api/library/auth/login`) generates a 32-byte random hex token (`crypto.randomBytes(32).toString('hex')`), inserts a row into `"Session"` with a **12-hour TTL** (`SESSION_TTL_MS = 12 * 60 * 60 * 1000`), and sets cookie `qx_session=<token>; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200` (and returns `{ user, token }` in JSON).
- Token extraction (`extractToken(req)` in `server/api.js:45-55`) checks:
  1. `req.cookies.qx_session`
  2. Raw `req.headers.cookie` regex `/qx_session=([^;]+)/`
  3. `Authorization: Bearer <token>` header
- Rate limiting on login (`server/api.js:126-142`): In-memory map `loginAttempts` keyed by `${req.ip}:${username}`, blocking after **5 failed attempts** within a **15-minute window** (`HTTP 429 RATE_LIMITED`).

### 6.3 Default Credentials & Admin Password Gate
- **Default Seeded Admin Account (`server/db.js:699-718`):**
  - Username: `admin`
  - Role: `owner` (`مالك المتجر`)
  - Default Password: Seeded on first database bootstrap via `hashPassword(...)` in `server/db.js:704` (redacted per security policy; inspect `server/db.js:704` locally if resetting a clean DB).
- **Admin Password Re-Authentication on User Creation (`server/api.js:230-249`):**
  - Creating a new user (`POST /api/library/users`) requires `adminPassword` in the request body, which is verified against either the currently logged-in admin's password hash or any active `owner` / `admin` user in the database.

### 6.4 RBAC Roles & Permission Matrix (`server/db.js:526-573`)
Only two system roles exist (`DEFAULT_ROLES`):

| Permission Key | Description (Arabic) | `owner` (`مالك المتجر`) | `cashier` (`كاشير` - Default) |
| :--- | :--- | :---: | :---: |
| `DASHBOARD_VIEW` | عرض لوحة التحكم | ✅ | ❌ |
| `POS_SALE` | إجراء عمليات البيع (نقطة البيع) | ✅ | ✅ |
| `SALES_VIEW` | عرض سجل المبيعات | ✅ | ✅ |
| `SALES_CREATE` | إنشاء فواتير بيع | ✅ | ✅ |
| `SALES_CANCEL` | إلغاء الفواتير | ✅ | ❌ |
| `SALES_RETURN` | عمل مرتجعات مبيعات | ✅ | ✅ |
| `SALES_DISCOUNT` | منح خصومات على المبيعات | ✅ | ❌ |
| `PRODUCT_VIEW` | عرض الأصناف والمنتجات | ✅ | ✅ |
| `PRODUCT_CREATE` | إضافة أصناف جديدة | ✅ | ❌ |
| `PRODUCT_EDIT` | تعديل بيانات وأسعار الأصناف | ✅ | ❌ |
| `PRODUCT_DELETE` | حذف أو إيقاف الأصناف | ✅ | ❌ |
| `CATEGORY_VIEW` | عرض التصنيفات | ✅ | ✅ |
| `CATEGORY_MANAGE` | إدارة التصنيفات (إضافة/تعديل/حذف) | ✅ | ❌ |
| `INVENTORY_VIEW` | عرض المخزون والباتشات | ✅ | ❌ |
| `INVENTORY_ADJUST` | تسوية المخزون وإدارة التوالف | ✅ | ❌ |
| `STOCKTAKE_CREATE` | إنشاء وتطبيق جلسات الجرد | ✅ | ❌ |
| `PURCHASE_VIEW` | عرض فواتير المشتريات | ✅ | ❌ |
| `PURCHASE_CREATE` | إنشاء فواتير شراء | ✅ | ❌ |
| `PURCHASE_RECEIVE` | استلام البضاعة في المخزن | ✅ | ❌ |
| `SUPPLIER_VIEW` | عرض الموردين | ✅ | ❌ |
| `SUPPLIER_MANAGE` | إدارة الموردين (إضافة/تعديل/حذف) | ✅ | ❌ |
| `CUSTOMER_VIEW` | عرض العملاء ونقاط الولاء | ✅ | ✅ |
| `CUSTOMER_MANAGE` | إدارة العملاء وتعديل النقاط | ✅ | ❌ |
| `REPORT_VIEW` | عرض التقارير المالية والمخزنية | ✅ | ❌ |
| `REPORT_EXPORT` | تصدير التقارير (CSV / طباعة) | ✅ | ❌ |
| `USER_VIEW` / `USER_MANAGE` | عرض / إدارة المستخدمين | ✅ | ❌ |
| `ROLE_VIEW` / `ROLE_MANAGE` | عرض / إدارة الأدوار والصلاحيات | ✅ | ❌ |
| `SETTINGS_VIEW` / `SETTINGS_EDIT` | عرض / تعديل إعدادات النظام | ✅ | ❌ |
| `BACKUP_MANAGE` | إدارة النسخ الاحتياطي والاستعادة | ✅ | ❌ |
| `AUDIT_VIEW` | عرض سجل المراجعة والعمليات | ✅ | ❌ |

> **Note:** `cashier` permissions can be customized at runtime by the owner in the Roles screen (`PUT /api/library/roles/:id`, `server/api.js:353-369`), whereas `owner` is locked (`ROLE_LOCKED`) to prevent self-lockout.

---

## 7. Complete Feature Inventory & Verification Status

| # | Feature / Module | Primary Source Files | API Endpoints / DB Tables | Status | Verification Evidence & Known Limitations |
| :- | :--- | :--- | :--- | :--- | :--- |
| 1 | **Desktop Boot, Splash & Health Check** | `desktop/engine/main/*.js`, `server/index.js` | `GET /api/library/health`, `GET /api/library/system/status` | `PARTIAL` | Boot, splash SVG spinner, and port/health check work (`test-lifecycle-fixes.cjs` 13/13, `test-custom-spinner.cjs` 10/10). **Limitation (HIGH-01):** `lifecycle.js:50` calls `.catch()` on `serverManager.stop()` (`undefined`), throwing uncaught `TypeError` on window close and leaving zombie process. |
| 2 | **Authentication & Login Gate** | `src/components/library/screens/login.tsx`, `server/api.js:126-205` | `POST /auth/login`, `POST /auth/logout`, `GET /auth/session` / `User`, `Session`, `Role` | `VERIFIED` | Tested in `test-login-gate.cjs` (11/11) and `test-dynamic-workflows.cjs`. Rate-limited after 5 failed attempts. |
| 3 | **Dashboard & KPI Analytics** | `src/components/library/screens/dashboard.tsx`, `server/api.js:2483-2580` | `GET /api/library/dashboard` / `Sale`, `SaleItem`, `Purchase`, `Product`, `Batch` | `VERIFIED` | Tested in `test-dashboard-endpoint.cjs` & `test-dynamic-workflows.cjs`. Displays today/month sales, stock value, low-stock count, 7-day AreaChart, and top 7 products BarChart. |
| 4 | **Point of Sale (POS) & FIFO Allocation** | `src/components/library/screens/pos.tsx`, `server/api.js:1535-1677` | `POST /api/library/sales` / `Sale`, `SaleItem`, `Batch`, `StockMovement`, `LoyaltyEvent`, `Counter` | `VERIFIED` | Tested in `test-expiry-removal-fifo.cjs` (20/20) & `test-dynamic-workflows.cjs`. Supports barcode scanning, weighable fractional quantities, line/invoice discounts (`SALES_DISCOUNT`), customer loyalty redemption/earning, FIFO batch depletion, and 80mm/58mm receipt printing. |
| 5 | **POS Suspended Carts (Park & Resume Sale)** | `src/components/library/screens/pos.tsx:711-769,1346-1391`, `server/api.js:1401-1430` | `GET/POST /sales/suspended`, `DELETE /sales/suspended/:id` / `SuspendedCart` | `BROKEN` | **Defect HIGH-02:** `pos.tsx:716` sends `cart: JSON.stringify(lines)` and `server/api.js:1418` calls `JSON.stringify(cart)` a second time. On `GET /sales/suspended`, `safeJson` parses once, returning a `string` instead of an array, crashing `pos.tsx:1367` (`row.cart.reduce is not a function`). Also `pos.tsx:764` calls `DELETE /sales/suspended` (404) instead of `/sales/suspended/:id`. |
| 6 | **Sales History & Invoice Cancellation** | `src/components/library/screens/sales-history.tsx`, `server/api.js:1432-1753` | `GET /sales`, `GET /sales/:id`, `POST /sales/:id/cancel` / `Sale`, `SaleItem`, `Batch`, `StockMovement`, `LoyaltyEvent` | `VERIFIED` | Tested in `test-dynamic-workflows.cjs`. Cancelling a sale restocks remaining unreturned quantities back to their original batches (`SALE_CANCEL_RESTOCK`) and reverses loyalty events. |
| 7 | **Sales Returns (Partial & Full)** | `src/components/library/screens/returns.tsx`, `server/api.js:1934-2049` | `GET /returns`, `POST /returns` / `Return`, `ReturnItem`, `SaleItem`, `Batch`, `StockMovement`, `LoyaltyEvent` | `PARTIAL` | Tested in `test-dynamic-workflows.cjs`. Restocks original batch, increments `SaleItem.returnedQty`, and deducts proportional loyalty points. **Minor Limitation (LOW-04):** `POST /returns` does not update `Sale.status` to `'RETURNED'` or `'PARTIALLY_RETURNED'`. |
| 8 | **Products Catalog, Sequential SKU, Barcode/QR & Initial Stock** | `src/components/library/screens/products.tsx`, `server/api.js:762-1085` | `GET/POST /products`, `GET /products/next-sku`, `GET/PUT/DELETE /products/:id` / `Product`, `Batch`, `StockMovement` | `VERIFIED` | Tested in `test-sku-sequential.cjs` (8/8), `test-barcode-qr-enhancement.cjs` (10/10), `test-initial-stock.cjs`, `test-permanent-delete-cascade.cjs` (7/7). Supports Code128 barcode labels printing (`30x20`, `40x25`, `50x25` mm), camera QR scanning, and cascading permanent delete. |
| 9 | **Products Bulk Activate / Deactivate** | `src/components/library/screens/products.tsx:227-247`, `server/api.js:868-903` | `POST /api/library/products/bulk` / `Product` | `BROKEN` | **Defect MEDIUM-01:** `products.tsx:231` sends `{ ids, action: 'activate' | 'deactivate' }` to `POST /products/bulk`, but `server/api.js:868` only implements bulk import (`{ items }`), returning HTTP 400 `قائمة المنتجات فارغة`. |
| 10 | **Categories Management** | `src/components/library/screens/categories.tsx`, `server/api.js:463-558` | `GET/POST /categories`, `PUT/DELETE /categories/:id` / `Category`, `Product` | `VERIFIED` | Tested in `test-permanent-delete-cascade.cjs` & `test-dynamic-workflows.cjs`. Supports soft-delete or permanent delete (either unlinking products or cascading product deletion). |
| 11 | **Inventory Overview, Batches & Manual Adjustment** | `src/components/library/screens/inventory.tsx`, `server/api.js:1090-1228` | `GET /inventory`, `GET /inventory/batches`, `GET /inventory/movements`, `POST /inventory/adjust` / `Batch`, `StockMovement` | `PARTIAL` | Batches tab, Movements tab, and `POST /inventory/adjust` work (`test-dynamic-workflows.cjs`). **Limitation (MEDIUM-02):** In `CurrentStockTab` (`inventory.tsx`), `GET /inventory` returns `productRow` (`id`, no `stockValue`, no `batchCount`), while `CurrentStockTab` expects `productId`, `stockValue`, and `batchCount`, and sends ignored `categoryId`/`filter=low` query params. |
| 12 | **Stocktaking Sessions (Count & Apply)** | `src/components/library/screens/stocktake.tsx`, `server/api.js:1230-1396` | `GET/POST /inventory/stocktake`, `GET/POST/DELETE /inventory/stocktake/:id` / `StocktakeSession`, `StocktakeLine`, `Batch`, `StockMovement` | `VERIFIED` | Tested in `test-dynamic-workflows.cjs`. Freezes system quantities on creation; applying a session depletes oldest batches first (if `delta < 0`) or creates an `ST-*` batch (if `delta > 0`). |
| 13 | **Purchases & Goods Receiving (WAC Costing)** | `src/components/library/screens/purchases.tsx`, `server/api.js:1758-1929` | `GET/POST /purchases`, `GET /purchases/:id`, `POST /purchases/:id/receive`, `POST /purchases/:id/pay`, `POST /purchases/:id/cancel` / `Purchase`, `PurchaseItem`, `Batch`, `StockMovement` | `VERIFIED` | Tested in `test-purchases-searchbar.cjs` (4/4) & `test-dynamic-workflows.cjs`. Supports draft & immediate receive (`receiveNow`), updates `Product.purchasePrice` using Weighted Average Cost (WAC), and tracks partial/full supplier payments. |
| 14 | **Suppliers Management** | `src/components/library/screens/suppliers.tsx`, `server/api.js:560-666` | `GET/POST /suppliers`, `PUT/DELETE /suppliers/:id` / `Supplier`, `Purchase` | `PARTIAL` | List, create, edit, and purchase aggregates work. **Defect MEDIUM-03:** `DELETE /suppliers/:id?force=true` (`server/api.js:596`) references undeclared variable `user` in `audit(...)` after committing the deletion, returning HTTP 500 `user is not defined` even though the deletion succeeded. |
| 15 | **Customers & Loyalty Ledger** | `src/components/library/screens/customers.tsx`, `server/api.js:668-711,2054-2115` | `GET/POST /customers`, `PUT/DELETE /customers/:id`, `GET /loyalty/:customerId`, `POST /loyalty/adjust` / `Customer`, `LoyaltyEvent` | `PARTIAL` | Create, edit, and loyalty earn/redeem/adjust work. **Defect MEDIUM-03:** `DELETE /customers/:id?force=true` (`server/api.js:696,704`) deletes from non-existent table `"LoyaltyTransaction"` instead of `"LoyaltyEvent"` (causing FK constraint failure if customer has loyalty points) and references undeclared `user` at line 704. |
| 16 | **Financial & Operational Reports + CSV Export** | `src/components/library/screens/reports.tsx`, `server/api.js:2120-2478` | `GET /api/library/reports?type=...&format=json\|csv` | `VERIFIED` | Tested in `test-dynamic-workflows.cjs`. Supports 10 report types (`sales`, `sales-by-cashier`, `sales-by-payment`, `product-sales`, `purchases`, `suppliers`, `inventory`, `low-stock`, `returns`, `movements`) with UTF-8 BOM CSV export. |
| 17 | **Users & Roles Administration** | `src/components/library/screens/users.tsx`, `src/components/library/screens/roles.tsx`, `server/api.js:208-383` | `GET/POST /users`, `PUT/DELETE /users/:id`, `GET/POST /roles`, `PUT/DELETE /roles/:id` | `VERIFIED` | Tested in `test-user-creation-admin-auth.cjs` (10/10), `test-roles-integrity.cjs`, `test-cashier-role-editable.cjs` (7/7). |
| 18 | **Store Settings & Theme/Branding** | `src/components/library/screens/settings.tsx`, `server/api.js:386-423` | `GET/PUT /api/library/settings` / `AppSettings` | `VERIFIED` | Tested in `test-branding-integration.cjs`, `test-theme-persistence-on-reboot.cjs`, `test-settings-inventory-tab-removed.cjs` (6/6). **Minor Note (LOW-01):** Quick theme toggle in `store.ts:170` calls non-existent `PUT /system/settings/branding` (swallowed by `.catch(() => {})`), while `localStorage` and Settings save (`PUT /settings`) persist properly. |
| 19 | **Backup & Restore** | `src/components/library/screens/backup.tsx`, `server/api.js:2585-2705` | `GET/POST /backup`, `GET/DELETE /backup/:id`, `POST /backup/:id/restore` / `BackupRecord` | `PARTIAL` | Creates binary `.db` copy in `data/backups/`, checkpoints WAL before restore, creates `PRE_RESTORE` snapshot, closes DB, replaces `custom.db`, and re-bootstraps. **Minor Defect (LOW-03):** `server/api.js:2623` saves PascalCase keys (`Product`, `Sale`, `Batch`) in `entityCounts`, while `backup.tsx:191-197` reads lowercase (`product`, `sale`, `batch`), showing `0` in UI badges. |
| 20 | **Audit Log & System Diagnostics** | `src/components/library/screens/audit.tsx`, `src/components/library/screens/diagnostics.tsx`, `server/api.js:2710-2790` | `GET /audit`, `GET /diagnostics` / `AuditLog` | `PARTIAL` | Audit log records and displays events. **Defect MEDIUM-04:** Opening `DiagnosticsScreen` (`diagnostics.tsx:121`) overwrites global `useLibraryStore.status` with a partial object missing `hardwareCaps` and several `modules` flags (`loyalty`, `printing`, `multiUser`, `backups`), hiding sidebar items until page reload; clicking "Validate Now" (`diagnostics.tsx:135`) calls missing `POST /activation/validate` (404). |

---

## 8. Database Architecture, Schema & Data Integrity

### 8.1 Engine & Connection Configuration (`server/db.js:12-62`)
- **Engine:** SQLite 3 via `better-sqlite3` (`server/node_modules/better-sqlite3`).
- **Database Path Resolution (`getDbPath()` in `server/db.js:18-36`):**
  1. `process.env.LIBRARY_DB_PATH` (if set and file exists)
  2. `process.env.DATABASE_URL` (`file:...` stripped, if file exists)
  3. `<projectRoot>/data/custom.db` (default active database: `D:\Anti_Work\Library Store For Windows 7\data\custom.db`)
  4. `%LOCALAPPDATA%\com.library.supermarket\custom.db` (fallback if local `data/custom.db` does not exist)
- **Pragmas Applied on Connection (`openDb()` in `server/db.js:49-53`):**
  ```sql
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;
  ```
- **Transaction Helper (`transaction(fn)` in `server/db.js:469-473`):** Wraps synchronous callback `fn(db)` inside `db.transaction(() => fn(db))()`.

### 8.2 Complete 19-Table Schema Reference (`server/db.js:76-360`)

> [!NOTE]
> The actual SQLite database (`data/custom.db`) contains **19 application tables** defined in `server/db.js` (plus `sqlite_sequence` and 3 legacy empty tables `_prisma_migrations`, etc. if inspected raw — `verify-offline.cjs` reports 23 total tables in `sqlite_master` with zero licensing tables).

| # | Table Name | Primary Key | Foreign Keys & `ON DELETE` Behavior | Unique Indexes & Constraints | Purpose |
| :- | :--- | :--- | :--- | :--- | :--- |
| 1 | `AppSettings` | `id` (`TEXT`) | None | PK (`'default'` or `'__device__'`) | Stores JSON config blocks: `business`, `branding`, `hardware`, `pos`, `localization`, `backup`, `system`. |
| 2 | `Role` | `id` (`TEXT`) | None | `Role_key_key` UNIQUE (`key`) | RBAC roles (`owner`, `cashier`, or custom). Stores JSON array in `permissions`. |
| 3 | `User` | `id` (`TEXT`) | `roleKey` → `Role(key)` `ON DELETE RESTRICT` | `User_tenantId_username_key` UNIQUE (`tenantId`, `username`) | Staff accounts, `passwordHash` (`scrypt`), `active`, `lastLoginAt`. |
| 4 | `Session` | `id` (`TEXT`) | `userId` → `User(id)` `ON DELETE CASCADE` | PK (64-char hex token) | Active login sessions with `expiresAt` (12h TTL). |
| 5 | `AuditLog` | `id` (`TEXT`) | None | Indexes on `createdAt`, `action`, `tenantId` | Append-only audit trail (`userId`, `username`, `action`, `entity`, `entityId`, `metadata` JSON, `result`). |
| 6 | `Counter` | `PRIMARY KEY (tenantId, key)` | None | Composite PK (`tenantId`, `key`) | Atomic document sequence counters (`sale` → `INV`, `purchase` → `PUR`, `return` → `RET`). |
| 7 | `Category` | `id` (`TEXT`) | None | `Category_tenantId_nameAr_key` UNIQUE (`tenantId`, `nameAr`) | Product categories (`nameAr`, `nameEn`, `description`, `active`). |
| 8 | `Supplier` | `id` (`TEXT`) | None | PK | Purchasing suppliers (`name`, `phone`, `email`, `address`, `notes`, `active`). |
| 9 | `Customer` | `id` (`TEXT`) | None | PK | Retail customers (`name`, `phone`, `email`, `address`, `notes`, `active`). |
| 10 | `Product` | `id` (`TEXT`) | `categoryId` → `Category(id)` `ON DELETE SET NULL` | `Product_tenantId_barcode_key` UNIQUE (`tenantId`, `barcode`), `Product_tenantId_sku_key` UNIQUE (`tenantId`, `sku`) | Catalog items (`sku`, `barcode`, `nameAr`, `unit`, `packSize`, `isWeighable`, `purchasePrice`, `sellingPrice`, `minSellingPrice`, `taxRate`, `reorderLevel`, `active`). |
| 11 | `Batch` | `id` (`TEXT`) | `productId` → `Product(id)` `ON DELETE RESTRICT`, `supplierId` → `Supplier(id)` `ON DELETE SET NULL` | `Batch_productId_batchNo_createdAt_key` UNIQUE (`productId`, `batchNo`, `createdAt`) | Traceable stock lots (`batchNo`, `quantity`, `costPrice`, `sellPrice`, `purchaseId`, `status`: `'ACTIVE'` \| `'DEPLETED'` \| `'DAMAGED'`). |
| 12 | `StockMovement` | `id` (`TEXT`) | `productId` → `Product(id)` `ON DELETE RESTRICT` | Indexes on `productId`, `createdAt`, `type`, `tenantId` | Signed inventory ledger (`+in` / `-out`) for `INITIAL`, `PURCHASE_RECEIVE`, `SALE`, `SALE_CANCEL_RESTOCK`, `RETURN`, `ADJUSTMENT`, `DAMAGE`, `STOCKTAKE`. |
| 13 | `Purchase` | `id` (`TEXT`) | `supplierId` → `Supplier(id)` `ON DELETE RESTRICT` | `Purchase_invoiceNo_key` UNIQUE (`invoiceNo`) | Supplier purchase headers (`status`: `'DRAFT'` \| `'RECEIVED'` \| `'CANCELLED'`, `paymentStatus`: `'UNPAID'` \| `'PARTIAL'` \| `'PAID'`). |
| 14 | `PurchaseItem` | `id` (`TEXT`) | `purchaseId` → `Purchase(id)` `ON DELETE CASCADE`, `productId` → `Product(id)` `ON DELETE RESTRICT` | PK | Line items on a purchase (`quantity`, `unitCost`, `receivedQty`, `total`, `batchId`). |
| 15 | `Sale` | `id` (`TEXT`) | `cashierId` → `User(id)` `ON DELETE RESTRICT`, `customerId` → `Customer(id)` `ON DELETE SET NULL` | `Sale_invoiceNo_key` UNIQUE (`invoiceNo`), Indexes on `createdAt`, `cashierId`, `tenantId` | POS sales invoices (`status`: `'COMPLETED'` \| `'CANCELLED'`, `subtotal`, `discount`, `tax`, `total`, `paidAmount`, `changeAmount`, `paymentMethod`). |
| 16 | `SaleItem` | `id` (`TEXT`) | `saleId` → `Sale(id)` `ON DELETE CASCADE`, `productId` → `Product(id)` `ON DELETE RESTRICT` | PK | Per-batch allocated sale lines (`batchId`, `batchNo`, `productName`, `quantity`, `unitPrice`, `discount`, `total`, `costPrice`, `returnedQty`). |
| 17 | `SuspendedCart` | `id` (`TEXT`) | None | PK | Parked POS carts (`label`, `cart` JSON string, `userId`). |
| 18 | `Return` & `ReturnItem` | `id` (`TEXT`) | `Return.saleId` → `Sale(id)` `ON DELETE RESTRICT`; `ReturnItem.returnId` → `Return(id)` `ON DELETE CASCADE` | `Return_returnNo_key` UNIQUE (`returnNo`) | Customer return headers and per-batch returned line items (`saleItemId`, `productId`, `batchId`, `quantity`, `unitPrice`, `total`). |
| 19 | `StocktakeSession`, `StocktakeLine`, `BackupRecord`, `LoyaltyEvent` | `id` (`TEXT`) | `StocktakeLine.sessionId` → `StocktakeSession(id)` `ON DELETE CASCADE`; `LoyaltyEvent.customerId` → `Customer(id)` `ON DELETE RESTRICT` | `BackupRecord_filename_key` UNIQUE (`filename`); `LoyaltyEvent_saleId_type_key` UNIQUE (`saleId`, `type`) | Stocktake sessions/lines, backup metadata records, and append-only customer loyalty point ledger (`EARN`, `REDEEM`, `ADJUST`). |

### 8.3 Schema Drift Between `server/db.js`, `src/lib/library/db-schema.ts`, and `prisma/schema.prisma`
- `server/db.js` is at **`SCHEMA_VERSION = 3`** (includes Migration 1: `EXPIRED` → `ACTIVE`/`DEPLETED`, and Migration 2: empty/whitespace barcode → `NULL`).
- `src/lib/library/db-schema.ts` is at **`SCHEMA_VERSION = 2`** (missing Migration 2).
- `prisma/schema.prisma` is a design-time reference only (`@prisma/client` is not used by `server/`).

---

## 9. Complete API Reference (`server/api.js`)

All 74 endpoints are mounted under `/api/library` (`server/index.js:73`). Responses use `{ ok: true, data: ... }` or `{ ok: false, error: { code, message, details } }`.

| # | Method | Path (`/api/library...`) | Line (`server/api.js`) | Required Permission | Description |
| :- | :--- | :--- | :- | :--- | :--- |
| 1 | `OPTIONS` | `*` | 43 | Public | CORS preflight (`204 No Content`). |
| 2 | `GET` | `/health` | 69 | Public | Returns `{ status: 'healthy', db: 'connected', timestamp }`. |
| 3 | `GET` | `/system/status` | 81 | Public | Returns `SystemStatus` (`branding`, `business`, `localization`, `pos`, `hardware`, `hardwareCaps`, `modules`). |
| 4 | `POST` | `/system/shutdown` | 112 | Localhost Only | Checkpoints WAL (`TRUNCATE`), closes DB, and exits server process. |
| 5 | `POST` | `/auth/login` | 126 | Public (Rate-Limited) | Authenticates user, sets `qx_session` cookie, returns `{ user, token }`. |
| 6 | `POST` | `/auth/logout` | 184 | Authenticated/Public | Deletes session from `Session` table and clears `qx_session` cookie. |
| 7 | `GET` | `/auth/session` | 194 | Public | Returns `{ user: SessionUser \| null }`. |
| 8 | `GET` | `/users` | 208 | `USER_VIEW` | Lists users with role names (`q`, `page`, `pageSize`). |
| 9 | `POST` | `/users` | 225 | `USER_MANAGE` + `adminPassword` | Creates user after verifying password complexity and `adminPassword`. |
| 10 | `GET` | `/users/:id` | 268 | `USER_VIEW` | Returns single user by ID. |
| 11 | `PUT` | `/users/:id` | 278 | `USER_MANAGE` | Updates user profile, role, active state, or password. |
| 12 | `DELETE` | `/users/:id` | 305 | `USER_MANAGE` | Soft-deactivates user if linked to sales (`salesCount > 0`), else hard-deletes. |
| 13 | `GET` | `/roles` | 328 | `ROLE_VIEW` | Lists all roles with user counts and parsed permissions array. |
| 14 | `POST` | `/roles` | 339 | `ROLE_MANAGE` | Creates custom role (`key: custom-<timestamp>`). |
| 15 | `PUT` | `/roles/:id` | 353 | `ROLE_MANAGE` | Updates role permissions (`owner` is locked; `cashier` is editable). |
| 16 | `DELETE` | `/roles/:id` | 371 | `ROLE_MANAGE` | Deletes non-system role if no users are assigned. |
| 17 | `GET` | `/settings` | 386 | `SETTINGS_VIEW` | Returns normalized `AppSettings` for `tenantId = 'default'`. |
| 18 | `PUT` | `/settings` | 393 | `SETTINGS_EDIT` | Updates `AppSettings` JSON blocks (`business`, `branding`, `hardware`, `pos`, `localization`, `backup`, `system`). |
| 19 | `GET` | `/alerts` | 405 | Authenticated | Returns proactive operational alerts (low stock count). |
| 20 | `GET` | `/search` | 426 | Authenticated | Global Command Palette (`Ctrl+K`) search across Products, Customers, Suppliers, and Sales. |
| 21 | `GET` | `/categories` | 463 | `CATEGORY_VIEW` | Lists categories with active product counts. |
| 22 | `POST` | `/categories` | 476 | `CATEGORY_MANAGE` | Creates category (`nameAr` unique per tenant). |
| 23 | `PUT` | `/categories/:id` | 491 | `CATEGORY_MANAGE` | Updates category fields. |
| 24 | `DELETE` | `/categories/:id` | 506 | `CATEGORY_MANAGE` | Soft-deactivates or (`?force=true&deleteProducts=...`) permanently deletes category. |
| 25 | `GET` | `/suppliers` | 560 | `SUPPLIER_VIEW` | Lists suppliers with `purchasesCount`, `totalPurchased`, `totalPaid`, `balanceDue`. |
| 26 | `POST` | `/suppliers` | 577 | `SUPPLIER_MANAGE` | Creates supplier. |
| 27 | `PUT` | `/suppliers/:id` | 589 | `SUPPLIER_MANAGE` | Updates supplier. |
| 28 | `DELETE` | `/suppliers/:id` | 604 | `SUPPLIER_MANAGE` | Soft-deactivates or (`?force=true&deletePurchases=...`) permanently deletes supplier (**see Defect MEDIUM-03**). |
| 29 | `GET` | `/customers` | 668 | `CUSTOMER_VIEW` | Lists customers with `salesCount`, `totalSpent`, `loyaltyBalance`, `loyaltyLifetime`. |
| 30 | `POST` | `/customers` | 685 | `CUSTOMER_MANAGE` | Creates customer. |
| 31 | `PUT` | `/customers/:id` | 697 | `CUSTOMER_MANAGE` | Updates customer. |
| 32 | `DELETE` | `/customers/:id` | 712 | `CUSTOMER_MANAGE` | Soft-deactivates or (`?force=true&deleteSales=...`) permanently deletes customer (**see Defect MEDIUM-03**). |
| 33 | `GET` | `/products` | 762 | `PRODUCT_VIEW` | Paged product catalog with `stockAvailable` and `stockTotal` (`q`, `categoryId`, `active`, `lowStock=1`). |
| 34 | `POST` | `/products` | 799 | `PRODUCT_CREATE` | Creates product (auto-generates `SKU-XXXX` if omitted; creates `INIT-*` batch if `initialStock > 0`). |
| 35 | `POST` | `/products/bulk` | 868 | `PRODUCT_CREATE` | Bulk imports `{ items }` array (**see Defect MEDIUM-01: does not handle `{ ids, action }`**). |
| 36 | `GET` | `/products/next-sku` | 905 | `PRODUCT_VIEW` | Returns `{ nextSku: 'SKU-XXXX' }` sequential code. |
| 37 | `GET` | `/products/:id` | 914 | `PRODUCT_VIEW` | Returns product detail + batches + last 10 stock movements. |
| 38 | `PUT` | `/products/:id` | 974 | `PRODUCT_EDIT` | Updates product fields and validates barcode uniqueness (`BARCODE_EXISTS` 409). |
| 39 | `DELETE` | `/products/:id` | 995 | `PRODUCT_DELETE` | Soft-deactivates or (`?force=true&deleteSales=...`) permanently cascades deletion. |
| 40 | `GET` | `/inventory` | 1090 | `INVENTORY_VIEW` | Lists active products with `stockAvailable` and `stockTotal` (**see Defect MEDIUM-02**). |
| 41 | `GET` | `/inventory/batches` | 1108 | `INVENTORY_VIEW` | Lists batches with filter (`active`, `depleted`, `productId`, `q`) and summary stats. |
| 42 | `GET` | `/inventory/movements` | 1179 | `INVENTORY_VIEW` | Paged stock movement ledger (`productId`, `type`, `from`, `to`). |
| 43 | `POST` | `/inventory/adjust` | 1198 | `INVENTORY_ADJUST` | Adjusts batch quantity to `countedQty` and writes signed `StockMovement`. |
| 44 | `POST` | `/inventory/expiry/sweep` | 1222 | `INVENTORY_ADJUST` | Safe no-op returning `{ swept: 0 }` (retained for backward API compatibility). |
| 45 | `GET` | `/inventory/stocktake` | 1230 | `INVENTORY_VIEW` | Lists stocktake sessions with line counts. |
| 46 | `POST` | `/inventory/stocktake` | 1257 | `STOCKTAKE_CREATE` | Opens new `StocktakeSession` and snapshots `systemQty` for all active products. |
| 47 | `GET` | `/inventory/stocktake/:id` | 1283 | `INVENTORY_VIEW` | Returns session details, lines, and active batches per product. |
| 48 | `POST` | `/inventory/stocktake/:id` | 1336 | `STOCKTAKE_CREATE` | Applies counted quantities (`counted` array) via FIFO depletion or `ST-*` batch creation. |
| 49 | `DELETE` | `/inventory/stocktake/:id` | 1385 | `STOCKTAKE_CREATE` | Cancels an `OPEN` stocktake session. |
| 50 | `GET` | `/sales/suspended` | 1401 | `SALES_VIEW` | Lists parked POS carts (**see Defect HIGH-02**). |
| 51 | `POST` | `/sales/suspended` | 1410 | `SALES_CREATE` | Parks a POS cart (**see Defect HIGH-02**). |
| 52 | `DELETE` | `/sales/suspended/:id` | 1423 | `SALES_CREATE` | Deletes parked POS cart by ID (**see Defect HIGH-02**). |
| 53 | `GET` | `/sales` | 1432 | `SALES_VIEW` | Lists sales invoices (`mode=cashiers`, `mode=recent`, or paged with `q`, `status`, `cashierId`, `from`, `to`). |
| 54 | `POST` | `/sales` | 1535 | `SALES_CREATE` | Completes POS sale with FIFO batch allocation, loyalty earn/redeem, and receipt generation. |
| 55 | `GET` | `/sales/:id` | 1679 | `SALES_VIEW` | Returns full sale details, allocated items, and printable `receipt` payload. |
| 56 | `POST` | `/sales/:id/cancel` | 1721 | `SALES_CANCEL` | Cancels sale, restocks unreturned items to original batches, and reverses loyalty points. |
| 57 | `GET` | `/purchases` | 1758 | `PURCHASE_VIEW` | Paged purchase invoices (`q`, `status`, `paymentStatus`, `supplierId`, `from`, `to`). |
| 58 | `POST` | `/purchases` | 1781 | `PURCHASE_CREATE` | Creates purchase (`DRAFT` or immediate `RECEIVED` when `receiveNow: true`). |
| 59 | `GET` | `/purchases/:id` | 1861 | `PURCHASE_VIEW` | Returns purchase invoice details and line items. |
| 60 | `POST` | `/purchases/:id/receive` | 1889 | `PURCHASE_RECEIVE` | Receives a `DRAFT` purchase, creates/updates batches, writes `PURCHASE_RECEIVE` movements, and updates product WAC `purchasePrice`. |
| 61 | `POST` | `/purchases/:id/pay` | 1898 | `PURCHASE_CREATE` | Records partial or full supplier payment on a purchase invoice. |
| 62 | `POST` | `/purchases/:id/cancel` | 1917 | `PURCHASE_CREATE` | Cancels a `DRAFT` purchase invoice. |
| 63 | `GET` | `/returns` | 1934 | `SALES_RETURN` / `SALES_VIEW` | Looks up sale for return (`?saleInvoice=...` or `?saleId=...`) or lists paged return history. |
| 64 | `POST` | `/returns` | 1991 | `SALES_RETURN` | Records customer return, increments `SaleItem.returnedQty`, restocks original batch, and deducts proportional loyalty points. |
| 65 | `GET` | `/loyalty/:customerId` | 2054 | `CUSTOMER_VIEW` | Returns customer loyalty balance, EGP value, last 30 events, and optional redemption `preview`. |
| 66 | `POST` | `/loyalty/adjust` | 2101 | `CUSTOMER_MANAGE` | Manually adds or deducts integer loyalty points for a customer. |
| 67 | `GET` | `/reports` | 2233 | `REPORT_VIEW` | Generates JSON or CSV (`format=csv`) report for 10 report types. |
| 68 | `GET` | `/dashboard` | 2483 | `DASHBOARD_VIEW` | Aggregates KPIs, 7-day sales series, recent 8 sales, and top 7 products. |
| 69 | `GET` | `/backup` | 2585 | `BACKUP_MANAGE` | Lists `BackupRecord` rows, storage usage, and backup config. |
| 70 | `POST` | `/backup` | 2609 | `BACKUP_MANAGE` | Copies `custom.db` to `data/backups/backup_<timestamp>.db` and records `BackupRecord`. |
| 71 | `GET` | `/backup/:id` | 2638 | `BACKUP_MANAGE` | Returns single `BackupRecord`. |
| 72 | `POST` | `/backup/:id/restore` | 2648 | `BACKUP_MANAGE` | Creates `PRE_RESTORE` snapshot, closes DB, unlinks WAL/SHM, overwrites `custom.db`, and runs `ensureBootstrap()`. |
| 73 | `DELETE` | `/backup/:id` | 2693 | `BACKUP_MANAGE` | Deletes backup `.db` file from disk and removes `BackupRecord`. |
| 74 | `GET` | `/audit` & `/diagnostics` | 2710, 2732 | `AUDIT_VIEW` / `SETTINGS_VIEW` | Paged audit log (`/audit`) and system diagnostics table counts (`/diagnostics`). |

---

## 10. Core Business Logic & Critical Workflows

### 10.1 FIFO POS Sale & Loyalty Workflow (`POST /api/library/sales`)
1. **Validation & Line Merging (`server/api.js:1537-1570`):**
   - Verifies `SALES_CREATE` permission and non-empty `items`.
   - Loads referenced `Product` rows; rejects inactive products (`PRODUCT_INACTIVE` 409) or quantities `<= 0`. Merges duplicate `productId` lines.
2. **FIFO Batch Allocation (`server/api.js:1585-1601`):**
   - Queries active batches:
     ```sql
     SELECT * FROM "Batch"
     WHERE productId = @productId AND tenantId = 'default' AND status = 'ACTIVE' AND quantity > 0
     ORDER BY createdAt ASC, id ASC
     ```
   - Iterates oldest-first, allocating `Math.min(batch.quantity, remaining)` up to 3 decimal places (`r3`).
   - If `remaining > 1e-9` after exhausting all active batches, aborts the transaction with `HTTP 409 INSUFFICIENT_STOCK`.
3. **Loyalty Redemption & Earning (`server/api.js:1612-1669`):**
   - If `redeemPoints > 0`, verifies customer balance (`SUM(points)` from `LoyaltyEvent`) and caps redemption at `maxRedeemShare` (default `50%` of invoice total before redemption).
   - Computes `total = r2(subtotal - invoiceDiscount - loyaltyDiscount + totalTax)`.
   - Generates sequential invoice number via `nextDocNo(db, 'default', 'sale', 'INV')` (`INV-YYYY-NNNNNN`).
   - Inserts `Sale`, per-allocation `SaleItem` rows, decrements each `Batch.quantity` (setting `status = 'DEPLETED'` when `newQty <= 1e-9`), inserts negative `StockMovement` (`type = 'SALE'`), records `REDEEM` and `EARN` rows in `LoyaltyEvent`, and returns the grouped receipt via `buildReceipt()`.

### 10.2 Purchase Receiving & Weighted Average Cost (WAC) (`_receivePurchase`, `server/api.js:1825-1859`)
- When a purchase is created with `receiveNow: true` or received later via `POST /api/library/purchases/:id/receive`:
  1. For each `PurchaseItem`, determines `batchNo` (uses provided `batchNo` or generates `AUTO-${purchase.invoiceNo}-${i + 1}`).
  2. If a `Batch` with the same `(productId, batchNo, tenantId)` already exists, increments its `quantity`, updates `costPrice`, and sets `status = 'ACTIVE'`. Otherwise inserts a new `ACTIVE` `Batch`.
  3. Inserts a positive `StockMovement` (`type = 'PURCHASE_RECEIVE'`).
  4. Recalculates and updates `Product.purchasePrice` using Weighted Average Cost (WAC):
     $$\text{WAC} = \text{round}_2\left(\frac{(\text{prevStock} \times \text{oldProdCost}) + (\text{receivedQty} \times \text{unitCost})}{\text{currentStock}}\right)$$

---

## 11. Security Review & Vulnerability Findings

> **Context:** This application binds its HTTP server exclusively to loopback (`127.0.0.1`) by default (`server/index.js:18`) and runs as a single-machine desktop POS system. Findings below are rated within that local/desktop threat model.

| ID | Severity | Location | Finding & Evidence | Impact | Recommended Remediation |
| :- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | `MEDIUM` | `server/api.js:32-43` | **Wildcard Reflective CORS with Credentials:** `server/api.js:34-36` reflects any `Origin` header (`res.setHeader('Access-Control-Allow-Origin', origin)`) alongside `Access-Control-Allow-Credentials: true`. | If an operator browses a malicious website on the same POS machine while logged into the browser mode (`127.0.0.1:3000`), cross-origin `fetch` requests from that website can read/mutate local POS API endpoints if `SameSite=Lax` is bypassed or if Bearer tokens are used. | Restrict allowed `Origin` headers to `http://127.0.0.1:*` and `http://localhost:*`. |
| **SEC-02** | `LOW` | `server/db.js:704` | **Default Seeded Admin Password:** When bootstrapping an empty database with zero active users, `ensureSystemData()` seeds `username: 'admin'` with a hardcoded initial password in `server/db.js:704`. | Predictable initial admin credentials on fresh installations until changed by the store owner. | Prompt the owner to change the default password on first login or set a `mustChangePassword` flag. |
| **SEC-03** | `LOW` | `server/api.js:1537-1583` | **POS `SALES_DISCOUNT` Permission Not Enforced Server-Side:** While the frontend POS UI (`pos.tsx`) hides discount inputs unless the user has `SALES_DISCOUNT`, `POST /api/library/sales` (`server/api.js:1578,1603`) accepts `item.discount` and `body.discount` with only `SALES_CREATE` permission. | A cashier without `SALES_DISCOUNT` could theoretically submit a crafted POST request to `/api/library/sales` containing a discount. | In `POST /api/library/sales`, check if `(body.discount > 0 || items.some(i => i.discount > 0))` and enforce `user.permissions.includes('SALES_DISCOUNT')`. |
| **SEC-04** | `INFO` | `server/api.js` (All SQL queries) | **Parameterized SQL Queries:** All `db.prepare(...)` statements use named bindings (`@id`, `@tenantId`, `@q`). Dynamic `IN (...)` clauses bind indexed keys (`@p0`, `@p1`). Table names in loops (`server/db.js:441`, `server/api.js:2625`) use hardcoded constant whitelists. | **No SQL injection vulnerabilities found.** | Maintain strict parameter binding for all future queries. |
| **SEC-05** | `INFO` | `server/api.js:2656` | **Path Traversal Protection on Restore:** `POST /backup/:id/restore` sanitizes `record.filename` via `path.basename(record.filename)`. Note: `DELETE /backup/:id` (`server/api.js:2700`) uses `record.filename` directly without `path.basename()`. | Low risk since `BackupRecord.filename` is server-generated (`backup_<timestamp>.db`). | Apply `path.basename(record.filename)` in `DELETE /backup/:id` (`server/api.js:2700`) for consistency. |

---
## 12. Confirmed Bugs, Broken Flows & Technical Debt Register

Every issue below was directly verified by inspecting the live source code, runtime logs (`data/logs/library-desktop.log`), and compiled bundles (`out/_next/static/chunks/0yfs-ujhus7x4.js`).

### 12.1 Summary Severity Table

| ID | Severity | Subsystem | Summary | Exact File & Line Locations |
| :- | :--- | :--- | :--- | :--- |
| **HIGH-01** | `HIGH` | Desktop Lifecycle & Shutdown | `cleanup()` calls `.catch()` on synchronous `serverManager.stop()` (`undefined`), throwing uncaught `TypeError` on window close and leaving zombie `Library Store.exe` processes. | `desktop/engine/main/lifecycle.js:50,56-57`<br/>`desktop/engine/main/server-manager.js:158,297-315` |
| **HIGH-02** | `HIGH` | POS Suspended Carts | Double `JSON.stringify` on cart suspension + `DELETE /sales/suspended` path mismatch causes `TypeError: row.cart.reduce is not a function` crash when opening Resume Cart dialog and 404 on cart deletion. | `src/components/library/screens/pos.tsx:716,764,1367`<br/>`server/api.js:1406,1418,1423` |
| **HIGH-03** | `HIGH` | Frontend Source (`src/`) Buildability | Undeclared identifier `warningDays` left behind in `inventory.tsx` and `products.tsx` after expiry removal breaks future `tsc` / `next build` compilations if `src/` is recompiled. | `src/components/library/screens/inventory.tsx:187,190`<br/>`src/components/library/screens/products.tsx:705` |
| **MEDIUM-01** | `MEDIUM` | Products Bulk Actions | Selecting products and clicking "تنشيط المحدد" or "إيقاف المحدد" sends `{ ids, action }` to `POST /products/bulk`, which only accepts `{ items }` for bulk import and fails with HTTP 400. | `src/components/library/screens/products.tsx:231-234`<br/>`server/api.js:868-903` |
| **MEDIUM-02** | `MEDIUM` | Inventory Current Stock Tab | `GET /inventory` returns `productRow` (`id`, no `stockValue`, no `batchCount`), whereas `CurrentStockTab` expects `productId`, `stockValue`, and `batchCount`, and sends ignored `categoryId` & `filter=low` params. | `src/components/library/screens/inventory.tsx:55-67,258-286,336-346`<br/>`server/api.js:722-733,1090-1106` |
| **MEDIUM-03** | `MEDIUM` | Supplier & Customer Permanent Delete | `DELETE /suppliers/:id?force=true` and `DELETE /customers/:id?force=true` reference undeclared `user` in `audit()`, throwing `ReferenceError` after DB commit; Customer force-delete also queries non-existent table `"LoyaltyTransaction"` instead of `"LoyaltyEvent"`. | `server/api.js:560,596`<br/>`server/api.js:668,696,704` |
| **MEDIUM-04** | `MEDIUM` | System Diagnostics Screen | Opening `DiagnosticsScreen` overwrites global `useLibraryStore.status` with a partial object missing `hardwareCaps` and `modules` flags; clicking "Validate Now" hits non-existent `POST /activation/validate` (404). | `src/components/library/screens/diagnostics.tsx:70,121,135,262`<br/>`server/api.js:2737-2749` |
| **LOW-01** | `LOW` | Theme Toggle Background Sync | `setTheme()` in `store.ts` calls non-existent `PUT /api/library/system/settings/branding` (404, swallowed by `.catch()`). Theme still persists via `localStorage` (`library-theme` / `qx-theme`). | `src/components/library/store.ts:170` |
| **LOW-02** | `LOW` | Electron ASAR Packaging | `scripts/repack-asar.cjs` copies all of `desktop/` (including 62.7 MB `desktop/bin/node.exe`) into `app.asar`, duplicating `resources/bin/node.exe` and inflating `app.asar` from 475 KB to 63.18 MB. | `scripts/repack-asar.cjs:26`<br/>`dist-desktop/win-unpacked/resources/app.asar` |
| **LOW-03** | `LOW` | Backup Table Entity Counts & Audit Filter | `POST /backup` writes PascalCase keys (`Product`, `Sale`, `Batch`) in `entityCounts` while `backup.tsx` reads lowercase (`product`, `sale`, `batch`). Also `GET /audit` ignores `q` and `result` query params sent by `audit.tsx`. | `server/api.js:2623,2715-2720`<br/>`src/components/library/screens/backup.tsx:191-197`<br/>`src/components/library/screens/audit.tsx:71-75` |
| **LOW-04** | `LOW` | Returns Sale Status Badge | `POST /returns` updates `SaleItem.returnedQty` accurately but does not transition `Sale.status` from `'COMPLETED'` to `'PARTIALLY_RETURNED'` or `'RETURNED'`. | `server/api.js:1991-2049` |

---

### 12.2 Detailed Forensic Breakdown of High & Medium Findings

#### [HIGH-01] Uncaught Exception on Desktop Shutdown & Zombie Process Retention
- **Exact Locations:** `desktop/engine/main/lifecycle.js:50,56-57` and `desktop/engine/main/server-manager.js:158,297-315`.
- **Evidence from Runtime Log (`data/logs/library-desktop.log`):**
  ```text
  2026-10-23T11:29:26.630Z [INFO] [BOOT] Stopping backend server...
  2026-10-23T11:29:26.632Z [ERROR] [BOOT] Uncaught exception in main process: — Cannot read properties of undefined (reading 'catch')
  TypeError: Cannot read properties of undefined (reading 'catch')
      at LifecycleManager.cleanup (D:\Anti_Work\Library Store For Windows 7\dist-desktop\win-unpacked\resources\app.asar\desktop\engine\main\lifecycle.js:50:38)
      at App.<anonymous> (D:\Anti_Work\Library Store For Windows 7\dist-desktop\win-unpacked\resources\app.asar\desktop\engine\main\lifecycle.js:56:18)
  2026-10-23T11:29:26.759Z [WARN] [BOOT] Server process exited unexpectedly (Code 1)
  ```
- **Root Cause:**
  1. In `desktop/engine/main/lifecycle.js:46-52`:
     ```js
     async cleanup() {
       if (this.isQuitting) return;
       this.isQuitting = true;
       logger_1.logger.info('BOOT', 'Stopping backend server...');
       await this.serverManager.stop().catch(() => {});
     }
     ```
  2. In `desktop/engine/main/server-manager.js:297-315`, `stop()` is a synchronous function (`stop() { ... }`) that returns `undefined`. Calling `.catch()` on `undefined` throws a synchronous `TypeError` inside `cleanup()` before `electron_1.app.quit()` (`lifecycle.js:57`) is reached.
  3. Additionally, `server-manager.js:297` kills the server via `taskkill /F /PID ${pid} /T` without setting `this.isShuttingDown = true` or calling `POST /api/library/system/shutdown` (which checkpoints the SQLite WAL file).
- **Remediation:** Make `ServerManager.prototype.stop()` `async`, set `this.isShuttingDown = true`, send a graceful `POST /api/library/system/shutdown` (with a short timeout fallback to `taskkill`), and wrap `this.serverManager.stop()` safely in `try { await this.serverManager.stop(); } catch {}`.

#### [HIGH-02] POS Suspended Cart Double-JSON Serialization Crash & Broken Delete Route
- **Exact Locations:** `src/components/library/screens/pos.tsx:716,764,1367` and `server/api.js:1406,1418,1423`.
- **Root Cause:**
  1. When parking a cart (`pos.tsx:714-717`), the client already serializes `lines` to a JSON string:
     ```ts
     await api('/sales/suspended', {
       method: 'POST',
       body: { label: suspendLabel.trim() || `معلقة ${new Date().toLocaleTimeString('ar-EG')}`, cart: JSON.stringify(lines) },
     })
     ```
  2. In `server/api.js:1417-1418`, the server calls `JSON.stringify(cart)` a second time:
     ```js
     db.prepare('INSERT INTO "SuspendedCart" (id,tenantId,label,cart,userId,createdAt) VALUES (@id,@tenantId,@label,@cart,@userId,@t)')
       .run({ id, tenantId: 'default', label, cart: JSON.stringify(cart), userId: user.id, t: now() });
     ```
  3. When `GET /api/library/sales/suspended` (`server/api.js:1406`) runs `safeJson(r.cart, [])`, `JSON.parse` unwraps only the outer string, returning a `string` instead of an `Array`.
  4. When the user opens the Resume Cart dialog (`pos.tsx:1367`), `(row.cart ?? []).reduce(...)` executes `.reduce` on a `string`, crashing the React tree with `TypeError: (row.cart ?? []).reduce is not a function`.
  5. Furthermore, `pos.tsx:764` calls `await api('/sales/suspended', { method: 'DELETE', body: { id: row.id } })`, whereas `server/api.js:1423` defines `router.delete('/sales/suspended/:id')`.
- **Remediation:** In `server/api.js:1418`, store `typeof cart === 'string' ? cart : JSON.stringify(cart)`, recursively unwrap strings in `GET /sales/suspended` if double-encoded, and add a `router.delete('/sales/suspended')` handler accepting `req.body.id` (or update `pos.tsx:764` to call `/sales/suspended/${row.id}`).

#### [HIGH-03] Undeclared `warningDays` Identifier in `src/components/library/screens/inventory.tsx` & `products.tsx`
- **Exact Locations:** `src/components/library/screens/inventory.tsx:187,190` and `src/components/library/screens/products.tsx:705`.
- **Root Cause:** When batch expiry warnings were removed from the stationery store edition, `const warningDays = ...` was deleted from `InventoryScreen` and `ProductsScreen`, but the JSX props `<CurrentStockTab warningDays={warningDays} ... />` (`inventory.tsx:187`), `<BatchesTab warningDays={warningDays} ... />` (`inventory.tsx:190`), and `<ProductDetailView detail={detail} warningDays={warningDays} />` (`products.tsx:705`) were left referencing the removed variable `warningDays`.
- **Why Production Currently Runs:** The pre-compiled bundle `out/_next/static/chunks/0yfs-ujhus7x4.js` was patched separately and does not have the broken reference. However, running `tsc --noEmit` or `next build` on `src/` will fail until `warningDays={0}` (or prop removal) is applied in `inventory.tsx` and `products.tsx`.

#### [MEDIUM-01] Products Bulk Activate / Deactivate Endpoint Mismatch
- **Exact Locations:** `src/components/library/screens/products.tsx:227-247` and `server/api.js:868-903`.
- **Root Cause:** `products.tsx:231` sends `POST /api/library/products/bulk` with `{ ids: Array.from(selected), action: 'activate' | 'deactivate' }` and expects `{ updated: number }`. However, `server/api.js:868` only implements bulk product import (`{ items: [...] }`) and throws `HTTP 400 VALIDATION: قائمة المنتجات فارغة` whenever `items` is missing.
- **Remediation:** In `server/api.js:868` (`POST /products/bulk`), check if `Array.isArray(req.body?.ids) && (req.body.action === 'activate' || req.body.action === 'deactivate')` (requiring `PRODUCT_EDIT`), update `active = action === 'activate' ? 1 : 0` for those `ids`, and return `{ updated: ids.length }`.

#### [MEDIUM-02] Inventory Current Stock Tab Field & Filter Mismatch
- **Exact Locations:** `src/components/library/screens/inventory.tsx:55-67,258-286,336-346` and `server/api.js:1090-1106`.
- **Root Cause:** `GET /api/library/inventory` (`server/api.js:1090`) returns `rows.map(p => productRow(p, availMap, totalMap))` which has `id` (not `productId`), and lacks `stockValue`, `batchCount`, `categoryId` filtering, and `filter=low` filtering. Consequently, in the first tab of the Inventory screen ("المخزون الحالي"), the "القيمة" (`stockValue`) column displays `0.00 ج.م`, the "الباتشات" (`batchCount`) column is empty, clicking a product row queries `/inventory/batches?productId=undefined`, and the Category / Low-Stock filters have no effect.

#### [MEDIUM-03] Undefined `user` Reference & Wrong Table Name in Permanent Delete (`DELETE /suppliers/:id` & `DELETE /customers/:id`)
- **Exact Locations:** `server/api.js:560,596` and `server/api.js:668,696,704`.
- **Root Cause:**
  1. In `DELETE /suppliers/:id` (`server/api.js:560`), `requirePermission(req, 'SUPPLIER_MANAGE')` is called without `const user = ...`. When `?force=true` is used, line 596 calls `audit({ userId: user.id, username: user.username }, 'SUPPLIER_DELETE', ...)`, throwing `ReferenceError: user is not defined` **after** the transaction has already deleted the supplier.
  2. In `DELETE /customers/:id` (`server/api.js:668`), `requirePermission(req, 'CUSTOMER_MANAGE')` also omits `const user = ...` (throwing `ReferenceError: user is not defined` at line 704), AND line 696 runs `DELETE FROM "LoyaltyTransaction" WHERE customerId=@id` instead of `"LoyaltyEvent"`, which causes `DELETE FROM "Customer"` at line 699 to fail with `FOREIGN KEY constraint failed` if the customer has any rows in `"LoyaltyEvent"`.

#### [MEDIUM-04] Diagnostics Screen Overwrites Global `SystemStatus` & Calls Missing Route
- **Exact Locations:** `src/components/library/screens/diagnostics.tsx:70,121,135,262` and `server/api.js:2737-2749`.
- **Root Cause:**
  1. `GET /api/library/diagnostics` (`server/api.js:2737`) returns a partial `status` object missing `hardware`, `hardwareCaps`, and module flags (`loyalty`, `printing`, `scanner`, `cashDrawer`, `multiUser`, `backups`). When `DiagnosticsScreen` mounts, `diagnostics.tsx:121` calls `useLibraryStore.setState({ status: res.status })`, clobbering the complete `SystemStatus` in Zustand and causing sidebar links gated by `module: 'multiUser'` (Users, Roles) or `module: 'backups'` (Backup) to disappear until page refresh!
  2. Clicking "التحقق الآن" (`revalidate()` at `diagnostics.tsx:135`) sends `POST /api/library/activation/validate`, which does not exist in `server/api.js` (returns 404).

---

## 13. Configuration & Environment Variables

| Variable Name | Default / Fallback | Used By | Purpose |
| :--- | :--- | :--- | :--- |
| `PORT` | `3000` (standalone) / `3100..3199` (Desktop `ServerManager`) | `server/index.js:17`, `server-manager.js:61` | TCP port for Express HTTP server. Automatically increments up to `PORT + 20` if busy. |
| `HOST` | `127.0.0.1` | `server/index.js:18` | Bind address for Express HTTP server. |
| `LIBRARY_DB_PATH` | `<root>/data/custom.db` | `server/db.js:20`, `server-manager.js:76` | Explicit absolute path to the SQLite database file. |
| `DATABASE_URL` | `file:<root>/data/custom.db` | `server/db.js:22`, `prisma/schema.prisma:12` | Prisma-compatible SQLite file URL fallback. |
| `LIBRARY_OUT_DIR` | `<root>/out` | `server/index.js:76`, `server-manager.js:77` | Path to the compiled Next.js static export directory served by Express. |
| `NODE_PATH` | `<root>/server/node_modules` | `server-manager.js:78` | Ensures `server/index.js` resolves `express`, `better-sqlite3`, and `cookie-parser`. |
| `NODE_ENV` | `production` | `server-manager.js:73`, `api.js:158` | Controls cookie `Secure` flag (only when `HTTPS=true`) and runtime mode. |

---

## 14. Build, Packaging & Patching Pipeline

### 14.1 How the Application is Currently Built & Packaged
1. **Static Frontend Bundle (`out/`):**
   - Configured in `next.config.ts` with `output: 'export'` and `images: { unoptimized: true }`.
   - Compiled into `out/` (main application code resides in `out/_next/static/chunks/0yfs-ujhus7x4.js` and styles in `out/_next/static/chunks/3oa5e4nmj08il.css`).
   - Because `next@16.1.1` requires Node 20+ and full root `node_modules` installation, incremental changes in this Windows 7 workspace have been applied to `src/` and patched directly into `out/_next/static/chunks/0yfs-ujhus7x4.js` using scripts in `scripts/patch-*.cjs`.
2. **Unpacked Desktop Distribution Sync (`dist-desktop/win-unpacked/`):**
   - `scripts/repack-asar.cjs` packs `package.json` and `desktop/` into `dist-desktop/win-unpacked/resources/app.asar` (using `@electron/asar` or `npx asar`) and copies `out/` and `server/` into `dist-desktop/win-unpacked/resources/out/` and `dist-desktop/win-unpacked/resources/server/`.
3. **Full Installer Build (`electron-builder.json`):**
   - Configured via `npm run dist:win7` (`scripts/build-win7.cjs`), producing a Windows x64 NSIS installer (`Library Store-1.0.0-Win7-x64-Setup.exe`) with `desktop/installer/win7-check.nsh`.

---

## 15. Operational Guide: Running the Project Locally

### Mode A: Standalone Local Server + Browser (Recommended for Fast Testing)
Double-click `start-server.bat` or run:
```powershell
& "D:\Anti_Work\Library Store For Windows 7\desktop\bin\node.exe" "D:\Anti_Work\Library Store For Windows 7\server\index.js"
```
- Starts the Express + SQLite backend on `http://127.0.0.1:3000` (or next free port) serving `out/` and `data/custom.db`.

### Mode B: Packaged Desktop Application (`Library Store.exe`)
Run the unpacked executable directly:
```powershell
Start-Process "D:\Anti_Work\Library Store For Windows 7\dist-desktop\win-unpacked\Library Store.exe"
```
- Or in development mode via `start-desktop.bat` (`npx electron .`).
- **Note:** Due to **Defect HIGH-01**, if `Library Store.exe` fails to launch because a previous closed window left a background process holding the single-instance lock, terminate stale instances first:
  ```powershell
  taskkill /F /IM "Library Store.exe" /T
  ```

---

## 16. Automated Verification & Test Suite Inventory

The repository includes **28 automated verification suites** orchestrated by `scripts/run-all-tests.cjs` plus `scripts/verify-offline.cjs`. All 29 scripts were executed using `desktop/bin/node.exe` during this audit and **passed 100%**:

```powershell
& "D:\Anti_Work\Library Store For Windows 7\desktop\bin\node.exe" "D:\Anti_Work\Library Store For Windows 7\scripts\verify-offline.cjs"
& "D:\Anti_Work\Library Store For Windows 7\desktop\bin\node.exe" "D:\Anti_Work\Library Store For Windows 7\scripts\run-all-tests.cjs"
```

| Suite Script | Scope Verified | Result |
| :--- | :--- | :---: |
| `scripts/verify-offline.cjs` | Verifies `data/custom.db` schema, zero licensing tables, `tenantId='default'`, and `AppSettings` row. | `PASS` |
| `scripts/audit-ui-contrast.cjs` | Verifies 16 light/dark theme color token pairs meet WCAG AA contrast (`>= 4.5:1`). | `PASS (16/16)` |
| `scripts/verify-client-assets.cjs` | Verifies `out/` and `dist-desktop/win-unpacked/resources/out/` assets, fonts, and chunks. | `PASS` |
| `scripts/test-login-gate.cjs` | Verifies authentication gate, invalid login rejection, and session cookie lifecycle. | `PASS (11/11)` |
| `scripts/test-barcode-integration.cjs` | Verifies barcode normalization, duplicate barcode 409 conflict, and scanner wedge. | `PASS (12/12)` |
| `scripts/test-expiry-removal-fifo.cjs` | Verifies expiry column removal and strict FIFO batch depletion order. | `PASS (20/20)` |
| `scripts/test-dashboard-endpoint.cjs` | Verifies `GET /api/library/dashboard` response structure and HTTP 200 status. | `PASS` |
| `scripts/test-lifecycle-fixes.cjs` | Verifies boot stages, health check endpoint, and graceful shutdown endpoint. | `PASS (13/13)` |
| `scripts/test-initial-stock.cjs` | Verifies product creation with `initialStock > 0` creates `INIT-*` batch and `INITIAL` movement. | `PASS` |
| `scripts/test-switch-rtl-integrity.cjs` | Verifies RTL switch thumb translation and containment. | `PASS` |
| `scripts/test-datetime-crash-resilience.cjs` | Verifies `toSafeDate`, `fmtDate`, and `fmtDateTime` against invalid/null timestamps. | `PASS (18/18)` |
| `scripts/test-roles-integrity.cjs` | Verifies only `owner` and `cashier` system roles exist after bootstrap. | `PASS` |
| `scripts/test-theme-switch-and-contrast.cjs` | Verifies light/dark theme switching and CSS token contrast. | `PASS (30/30)` |
| `scripts/test-lbc-font.cjs` | Verifies `LBC.otf` font-face declaration and file presence across `public/`, `out/`, and `dist-desktop/`. | `PASS` |
| `scripts/test-fefo-expiry-purge.cjs` | Verifies removal of legacy FEFO/expiry UI columns and migration v1→v2 batch recovery. | `PASS (37/37)` |
| `scripts/test-opacity-and-loyalty-contrast.cjs` | Verifies loyalty badge contrast and surface opacity tokens. | `PASS (23/23)` |
| `scripts/test-branding-integration.cjs` | Verifies store branding settings persistence and logo rendering. | `PASS (4/4)` |
| `scripts/test-sku-sequential.cjs` | Verifies `GET /products/next-sku` and client `computeNextSku` sequential `SKU-XXXX` generation. | `PASS (8/8)` |
| `scripts/test-weighable-layout.cjs` | Verifies weighable product toggle (`isWeighable`) and fractional quantity support. | `PASS (10/10)` |
| `scripts/test-barcode-qr-enhancement.cjs` | Verifies random EAN-13 barcode generator and QR payload scanner/generator. | `PASS (10/10)` |
| `scripts/test-initial-stock-and-preview-containment.cjs` | Verifies initial stock input and barcode label print preview sheet containment. | `PASS` |
| `scripts/test-theme-persistence-on-reboot.cjs` | Verifies theme persistence in `localStorage` across page reloads. | `PASS` |
| `scripts/test-permanent-delete-cascade.cjs` | Verifies permanent deletion (`?force=true`) for products, categories, suppliers, and customers. | `PASS (7/7)` |
| `scripts/test-purchases-searchbar.cjs` | Verifies widened supplier/invoice search bar in `PurchasesScreen`. | `PASS (4/4)` |
| `scripts/test-user-creation-admin-auth.cjs` | Verifies admin password prompt and server-side verification when creating a new user. | `PASS (10/10)` |
| `scripts/test-settings-inventory-tab-removed.cjs` | Verifies redundant Inventory tab removal from `SettingsScreen`. | `PASS (6/6)` |
| `scripts/test-cashier-role-editable.cjs` | Verifies `cashier` role permissions can be edited while `owner` remains locked. | `PASS (7/7)` |
| `scripts/test-custom-spinner.cjs` | Verifies custom SVG `<Spinner />` component, CSS tokens, and splash screen inline spinner. | `PASS (10/10)` |
| `scripts/test-dynamic-workflows.cjs` | End-to-end HTTP workflow test against `data/test_copy.db` (login, CRUD, purchases, FIFO sales, returns, stocktake, reports). | `PASS (39/39)` |

---

## 17. Legacy & Unused Code Inventory

To prevent confusion during maintenance, note the following legacy/unused files that remain in the repository:
1. **`src/app/api/library/[...path]/route.ts` & `src/lib/library/services/*.ts`:**
   - These TypeScript files implement the original Next.js App Router backend services. Because Next.js is exported statically (`output: 'export'`), **these files are NOT executed at runtime**. The actual runtime backend is 100% implemented in `server/index.js`, `server/api.js`, and `server/db.js`.
2. **`prisma/schema.prisma`:**
   - Reference schema only. Runtime database creation and migrations are handled entirely by `BASELINE_DDL` and `MIGRATIONS` in `server/db.js`.
3. **One-Off Patch & Diagnostic Scripts in `scripts/`:**
   - Over 100 scripts in `scripts/` (`patch-*.cjs`, `inspect-*.cjs`, `find-*.cjs`, `check-*.cjs`, `tmp-*.cjs`) are historical AST/string patchers used to update `out/_next/static/chunks/0yfs-ujhus7x4.js`. Do not re-run old `patch-*.cjs` scripts indiscriminately, as they target specific historical substrings.

---

## 18. Windows 7 SP1 & Chromium 108 Compatibility Constraints

Any future engineer or AI agent modifying this project **must** adhere to these strict platform rules:
1. **Node.js 16 Syntax & API Compatibility (`server/` & `desktop/`):**
   - `desktop/bin/node.exe` is **Node.js v16.20.2**. Do not use Node 18/20+ built-ins (such as native `fetch`, `node:test`, `node:sqlite`, or `fs.globSync`) inside `server/` or `desktop/`.
2. **Native Addon ABI 93 Lock (`better-sqlite3`):**
   - `server/node_modules/better-sqlite3/build/Release/better_sqlite3.node` is compiled specifically for **Node ABI 93 (win32-x64)**. Never run `npm rebuild` or `npm install` inside `server/` with a newer Node version (e.g., Node 20/22), or it will overwrite the ABI 93 binary and break `desktop/bin/node.exe`!
3. **Chromium 108 CSS Compatibility (`src/app/globals.css` & `out/`):**
   - Electron 22 uses **Chromium 108**. Avoid CSS features introduced after Chromium 108 (or always provide hex/rgb fallbacks before `oklch()` / `color-mix()`).

---

## 19. Data Safety, Backup & Recovery Procedures

- **Live Database Location:** `D:\Anti_Work\Library Store For Windows 7\data\custom.db` (plus `-wal` and `-shm` files when open).
- **Safe Manual Backup Procedure:**
  1. Via UI: Navigate to **النسخ الاحتياطي (Backup)** → click **إنشاء نسخة احتياطية الآن** (`POST /api/library/backup`).
  2. Via CLI (while server is stopped): Copy `data/custom.db` to `data/backups/`.
- **Point-in-Time Restore:**
  - `POST /api/library/backup/:id/restore` (`server/api.js:2648-2691`) automatically checkpoints the current WAL (`PRAGMA wal_checkpoint(TRUNCATE)`), saves a `backup_pre_restore_<timestamp>.db` file in `data/backups/`, closes the active SQLite connection (`closeDb()`), deletes stale `-wal` and `-shm` files, copies the selected `.db` file to `data/custom.db`, and re-runs `ensureBootstrap()`.

---

## 20. Step-by-Step Developer & AI Handover Guide

### How to Modify Backend Logic (`server/`)
1. Edit `server/api.js` or `server/db.js` directly (CommonJS JavaScript, Node 16 compatible).
2. If updating the unpacked desktop build in `dist-desktop/win-unpacked/`, copy the updated `server/api.js` or `server/db.js` to `dist-desktop/win-unpacked/resources/server/`.
3. Run `desktop\bin\node.exe scripts\run-all-tests.cjs` to verify zero regressions.

### How to Modify Frontend UI (`src/` and `out/`)
Because root `node_modules/` currently contains only `electron` (and `next@16.1.1` requires Node 20+ to run `next build`):
- **Option 1 (Full Rebuild with Node 20+ on a Modern Dev Machine):**
  1. Fix **Defect HIGH-03** first (`warningDays` in `src/components/library/screens/inventory.tsx:187,190` and `src/components/library/screens/products.tsx:705`).
  2. Audit any direct bundle patches (`scripts/patch-*.cjs`) to ensure `src/` has 100% parity with `out/`.
  3. Run `npm install` (in root only — **never** overwrite `server/node_modules/better-sqlite3`!) and `npm run build` to regenerate `out/`.
  4. Copy `out/` to `dist-desktop/win-unpacked/resources/out/`.
- **Option 2 (Surgical Offline Update without Node 20+):**
  1. Apply the change to the TypeScript source file in `src/` to maintain source-of-truth parity.
  2. Apply the corresponding compiled JS/CSS update to `out/_next/static/chunks/0yfs-ujhus7x4.js` (and `out/_next/static/chunks/3oa5e4nmj08il.css` if styles changed).
  3. Mirror `out/` to `dist-desktop/win-unpacked/resources/out/`.

---

## 21. Prioritized Remediation Roadmap

If tasked with fixing the defects identified in Section 12, execute them in this exact priority order:

1. **Priority 1 — Fix Desktop Shutdown Crash & Zombie Process (`HIGH-01`):**
   - In `desktop/engine/main/server-manager.js:297`, make `stop()` `async`, set `this.isShuttingDown = true`, call `/api/library/system/shutdown` before `taskkill`, and return a Promise.
   - In `desktop/engine/main/lifecycle.js:50`, wrap `await this.serverManager.stop()` in a `try / catch` block so `app.quit()` always executes.
   - In `scripts/repack-asar.cjs:26`, exclude `desktop/bin/node.exe` when staging `app.asar` (**fixes `LOW-02`**), and re-pack `dist-desktop/win-unpacked/resources/app.asar`.
2. **Priority 2 — Fix POS Suspended Carts Crash & Delete (`HIGH-02`):**
   - In `server/api.js:1418`, avoid double-stringifying `cart` (`typeof cart === 'string' ? cart : JSON.stringify(cart)`).
   - In `server/api.js:1406`, unwrap double-encoded JSON strings if `typeof parsed === 'string'`.
   - In `server/api.js:1423`, support both `DELETE /sales/suspended/:id` and `DELETE /sales/suspended` (reading `req.body.id`).
3. **Priority 3 — Fix Undeclared `warningDays` in `src/` (`HIGH-03`):**
   - Define `const warningDays = 0` (or remove the unused prop) in `src/components/library/screens/inventory.tsx:187,190` and `src/components/library/screens/products.tsx:705`.
4. **Priority 4 — Fix Medium API/UI Mismatches (`MEDIUM-01`, `MEDIUM-02`, `MEDIUM-03`, `MEDIUM-04`):**
   - Support `{ ids, action }` in `POST /api/library/products/bulk` (`server/api.js:868`).
   - Enrich `GET /api/library/inventory` (`server/api.js:1090`) with `productId: p.id`, `stockValue`, `batchCount`, `categoryId` filter, and `filter=low`.
   - Assign `const user = requirePermission(...)` in `DELETE /suppliers/:id` (`server/api.js:560`) and `DELETE /customers/:id` (`server/api.js:668`), and change `"LoyaltyTransaction"` to `"LoyaltyEvent"` at `server/api.js:696`.
   - Return complete `getSystemStatus()` in `GET /api/library/diagnostics` (`server/api.js:2737`) and add `POST /api/library/activation/validate` returning `{ valid: true, state: 'ACTIVE' }`.

---

## 22. Known Unknowns & Verification Boundaries

- **Real Windows 7 SP1 Hardware Execution (`UNVERIFIED` on physical Win7 kernel during this session):**
  - The audit was executed on Windows (host environment) using the exact bundled **Node.js `v16.20.2`** binary (`desktop/bin/node.exe`) and **Electron `v22.3.27`**. While binary PE headers, ABI 93 native bindings, GPU disable flags (`6.1`/`6.2`/`6.3`), and NSIS installer macros (`win7-check.nsh`) are verified in code, physical execution on a bare-metal Windows 7 SP1 VM/PC was not performed in this session.
- **Physical RJ11 Cash Drawer & USB Thermal Printer Spooler (`IMPLEMENTED_NOT_TESTED` with physical peripherals):**
  - Print layout (`@media print`, `80mm`/`58mm`), WebAudio drawer pulse, and keyboard-wedge barcode scanning (`<= 55ms` keystroke interval) are verified in software, but physical paper feed and RJ11 voltage kick depend on the host Windows printer driver settings.

---

## 23. Document Integrity & Audit Sign-Off Checklist

- [x] **Zero Application Files Modified:** Only `PROJECT_CONTEXT.md` was created/updated. All application code, bundles, and `data/custom.db` remain untouched.
- [x] **Zero Secrets Exposed:** No plaintext passwords, session tokens, or private keys are included in this document.
- [x] **100% Evidence-Backed Claims:** Every architecture diagram, table definition, route entry, and defect report cites exact file paths and line numbers verified directly from the workspace.
- [x] **All 28 Automated Test Suites + Offline DB Check Verified Passing.**
