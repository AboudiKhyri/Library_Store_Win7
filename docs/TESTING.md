# Testing & Verification — Library_Store

> Library_Store · Offline Store & POS Management System · v1.0.0

This document outlines verification procedures and tests for the standalone offline **Library_Store** system.

## System Architecture

Library_Store is 100% offline and standalone:
- **Database**: Local SQLite database located at `data/custom.db` with WAL mode.
- **Tenancy**: Static single-tenant context (`tenantId = 'default'`).
- **Network**: Zero outbound network or DNS requests. No license servers, no activation gates, no grace periods.
- **Peripherals**: Full access to receipt printers, barcode scanners, and cash drawers without remote licensing caps.

## Verification Procedures

### 1. Offline System Status Check
```bash
curl -s http://127.0.0.1:3210/api/library/system/status
```
Expected response:
```json
{
  "ok": true,
  "data": {
    "phase": "READY",
    "tenantId": "default",
    "ready": true,
    "version": "1.0.0",
    "database": {
      "connected": true,
      "mode": "WAL"
    }
  }
}
```

### 2. Authentication & Session
- Default owner user: `admin`
- Login endpoint: `POST /api/library/auth/login`
- Session cookie: `qx_session`

### 3. POS & Inventory Flow
1. Verify existing products: `GET /api/library/products`
2. Perform sale: `POST /api/library/sales`
   - Invoice generated (`INV-...`)
   - Inventory decremented automatically
   - Batch allocation (FEFO) applied
3. Create purchase order: `POST /api/library/purchases`
4. Receive purchase order: `POST /api/library/purchases/:id/receive`
   - Inventory incremented
   - Stock movements recorded

### 4. Database Safety
- All business records (Users, Products, Suppliers, Customers, Sales, Batches, StockMovements) persist in `data/custom.db`.
- Database backups can be created locally via `POST /api/library/backups`.
