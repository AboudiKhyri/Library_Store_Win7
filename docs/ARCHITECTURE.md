# Architecture — Library_Store

> Library_Store · Offline Store & POS Management System · v1.0.0

Library_Store is a **standalone, offline-first desktop application** designed for supermarket, retail, and library management. It requires zero cloud infrastructure, zero license activation servers, and operates 100% locally on the host machine.

---

## 1. System Topology

```
┌────────────────────────────────────────────────────────┐
│  Host Machine (Windows Desktop)                        │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Electron Desktop Shell                          │  │
│  │  - Window Management & System Tray               │  │
│  │  - Secure IPC Bridge (libraryStore:*)            │  │
│  │  - Embedded Chromium UI View                     │  │
│  └──────────────────▲───────────────────────────────┘  │
│                     │ loopback HTTP (port 3210)        │
│  ┌──────────────────▼───────────────────────────────┐  │
│  │  Local Next.js Application Server                │  │
│  │  - Standalone Node runtime                       │  │
│  │  - API Routes (/api/library/**)                  │  │
│  │  - Business Domain Services                      │  │
│  │  - Clean Offline Bootstrap & Health Checks       │  │
│  └──────────────────▲───────────────────────────────┘  │
│                     │ embedded driver / WAL            │
│  ┌──────────────────▼───────────────────────────────┐  │
│  │  Local SQLite Database (data/custom.db)          │  │
│  │  - Single tenant context (tenantId = 'default')  │  │
│  │  - Automatic schema bootstrap & migrations       │  │
│  │  - Safe local backups (data/backups/)            │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 2. Core Architectural Principles

1. **100% Offline by Design**:
   - Zero outbound DNS or network calls.
   - All assets (scripts, fonts, icons, styles) are bundled locally.
   - Hardware interfaces (ESC/POS receipt printers, serial barcode scanners, cash drawers) communicate directly over local COM/USB/raw ports.

2. **Data Isolation & Safety**:
   - Primary database: `data/custom.db` (SQLite with WAL journaling enabled).
   - Unified single-tenant model (`tenantId = 'default'`).
   - Backup creation and restore fully local (`data/backups/`).

3. **Domain Layering**:
   - **Shell / Desktop Engine**: `desktop/engine/` orchestrates child server lifecycles, health probing, port selection, and native IPC.
   - **Frontend UI**: `src/components/library/` contains the UI components, responsive layouts, POS interface, and store views.
   - **API Layer**: `src/app/api/library/` handles HTTP API routes with role-based authorization and structured JSON responses.
   - **Domain Services**: `src/lib/library/services/` encapsulates business logic for Inventory, Sales, Purchasing, Loyalty, and System Administration.
