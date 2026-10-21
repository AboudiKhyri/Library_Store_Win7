# Configuration — Library_Store

> Library_Store · Offline Store & POS Management System · v1.0.0

All configurations in **Library_Store** are locally stored and managed. The system requires no remote configuration or external connection.

---

## 1. Environment Variables

The application reads from `.env` in the project root (or environment variables passed by the desktop launcher):

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | SQLite connection string | `"file:../data/custom.db"` |
| `PORT` | Local loopback server port | `3210` |
| `NODE_ENV` | Runtime environment | `production` (in packaged build) |

---

## 2. Store & Business Configuration

Store settings are stored directly in `data/custom.db` under the `AppSettings` table (`id = 'default'`).
They can be managed directly via the **Settings** screen in the application:
- **Business Details**: Store name, tax number, phone numbers, address, receipt header/footer.
- **Branding**: Primary color, secondary color, accent color, theme preference.
- **Hardware Settings**:
  - Receipt Printer (ESC/POS, USB/Network/Serial)
  - Barcode Scanner (HID / Virtual COM)
  - Cash Drawer (kick-out pulse via printer or direct COM)
- **POS Configuration**: Tax rates, receipt paper size (80mm / 58mm), barcode label template.
