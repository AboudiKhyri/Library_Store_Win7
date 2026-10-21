# Database — Library_Store

> Library_Store · Offline Store & POS Management System · v1.0.0
> Schema: `prisma/schema.prisma` · Engine: SQLite (`data/custom.db`) via Prisma 6 / Node:SQLite.

## 1. Model Map

| Model | Purpose |
|---|---|
| `AppSettings` | JSON configuration blocks (id = 'default' or '\_\_device\_\_') |
| `Role` | System roles (global keys) + custom roles |
| `User` | User accounts with roles and hashed credentials |
| `Session` | Database-backed sessions (opaque token, 12h TTL) |
| `AuditLog` | Tamper-evident action log with user, entity, metadata, result |
| `Counter` | Atomic document numbering for sales, purchases, and returns |
| `Category` / `Supplier` / `Customer` | Store business entities and master data |
| `Product` | Store catalog items: barcode/SKU, unit, packSize, **isWeighable**, prices, reorder level |
| `Batch` | Traceable stock units with expiry dates, cost, and FEFO inventory status |
| `StockMovement` | Signed append-only inventory ledger (9 movement types) |
| `Purchase` / `PurchaseItem` | Purchasing invoices with per-line batch allocation |
| `Sale` / `SaleItem` | POS sales transactions with itemized batch tracking |
| `SuspendedCart` | Parked POS carts for multi-tasking cashiers |
| `Return` / `ReturnItem` | Customer and supplier returns linked to sales/purchases |
| `StocktakeSession` / `StocktakeLine` | Physical inventory count sessions |
| `BackupRecord` | Metadata registry for local database backup files |
| `LoyaltyEvent` | Customer loyalty points ledger (EARN/REDEEM/ADJUST) |

---

## 2. Offline Single-Tenant Storage

All business tables maintain a standardized `tenantId = 'default'` to ensure total consistency across the database. The system operates as a unified offline local store.

---

## 3. Backups

- Backups are stored locally in `data/backups/` in `library-backup-v1` format.
- Automatic `PRE_RESTORE` safety snapshots are created prior to restoring any backup file.
