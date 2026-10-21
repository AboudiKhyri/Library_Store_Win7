# Release & Packaging — Library_Store

> Library_Store · Offline Store & POS Management System · v1.0.0

## 1. Versioning Standards

- **Package Name**: `library-store`
- **Application Version**: `1.0.0`
- **Application ID**: `com.library.supermarket`
- **Executable Name**: `Library_Store.exe`
- **Setup Name**: `Library_Store-Setup-1.0.0.exe`

---

## 2. Release Steps

1. Verify local SQLite database schema (`data/custom.db`).
2. Run `npm run build` to compile the Next.js standalone application.
3. Run `npm run desktop:prepare` to stage desktop assets.
4. Run `npm run desktop:dist` to produce the installer via Electron Builder.
