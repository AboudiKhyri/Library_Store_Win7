# Security — Library_Store

> Library_Store · Offline Store & POS Management System · v1.0.0

Library_Store is engineered from the ground up for secure offline retail operation.

---

## 1. Authentication & Passwords

- **scrypt Hashing**: Password hashes use 16-byte random salts with 64-byte key derivations and timing-safe comparison (`src/lib/library/auth.ts`).
- **Session Tokens**: Cryptographically secure 32-byte session tokens stored in SQLite (`Session` table) with 12-hour TTL.
- **Cookie Security**: `library_session` cookie is configured with `httpOnly`, `sameSite=lax`, and `secure` in production.

---

## 2. Offline Threat Model

- **Zero Cloud Exposure**: Because Library_Store executes 100% offline, remote network attack surfaces are completely eliminated.
- **Local Loopback Isolation**: Desktop bridge communication is bound exclusively to `127.0.0.1` on designated ports.
- **Context Isolation & Sandbox**: Electron BrowserWindow runs with `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.

---

## 3. RBAC & Audit Trail

- **Role-Based Access Control**: Pre-defined and custom roles with granular permissions.
- **Tamper-Evident Audit Logging**: Every critical store action (sales, inventory adjustments, user logins, configuration modifications) is stamped in the `AuditLog` table.
