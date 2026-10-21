# Deployment — Library_Store

> Library_Store · Offline Store & POS Management System · v1.0.0

Library_Store is deployed as a self-contained offline application. It requires zero cloud infrastructure and zero license servers.

---

## 1. Local Development / Server Run

```bash
# Install dependencies
npm install

# Run Next.js web application
npm run dev

# Or build standalone production server
npm run build
npm start
```

---

## 2. Desktop Packaging (Windows)

The application packages into a standalone Windows installer using Electron & Electron Builder:

```bash
# 1. Prepare desktop bundle
npm run desktop:prepare

# 2. Package into unpacked directory
npm run desktop:pack

# 3. Create Windows NSIS Setup Installer
npm run desktop:dist
```

Output:
- Executable: `dist/win-unpacked/Library_Store.exe`
- Installer: `dist/Library_Store-Setup-1.0.0.exe`

---

## 3. Runtime Data Locations

- **Database**: `data/custom.db`
- **Backups**: `data/backups/`
- **Logs**: `data/logs/library-desktop.log`
