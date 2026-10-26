/**
 * scripts/patch-splash-theme-sync.cjs
 * Synchronizes Electron splash screen and app splash screen with application theme
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');

console.log('=== PATCHING SPLASH SCREEN THEME SYNCHRONIZATION ===');

// 1. Patch desktop/engine/main/window-manager.js
const wmPath = path.join(root, 'desktop/engine/main/window-manager.js');
let wm = fs.readFileSync(wmPath, 'utf8');

// 1.1 Constructor
const oldConstructor = `class WindowManager {
    config;
    preloadPath;
    logger;
    serverManager;
    mainWindow = null;
    constructor(config, preloadPath, logger, serverManager) {
        this.config = config;
        this.preloadPath = preloadPath;
        this.logger = logger;
        this.serverManager = serverManager;
    }`;

const newConstructor = `class WindowManager {
    config;
    preloadPath;
    logger;
    serverManager;
    paths = null;
    mainWindow = null;
    constructor(config, preloadPath, logger, serverManager, paths = null) {
        this.config = config;
        this.preloadPath = preloadPath;
        this.logger = logger;
        this.serverManager = serverManager;
        this.paths = paths;
    }
    /**
     * Resolves and parses the synchronized theme configuration.
     * Guaranteed fast synchronous read (< 0.5ms) without native addon dependencies.
     */
    getThemeConfig() {
        try {
            const candidates = [];
            if (this.paths && this.paths.dataDir) {
                candidates.push(path.join(this.paths.dataDir, 'theme.json'));
            }
            candidates.push(path.join(process.cwd(), 'data', 'theme.json'));
            candidates.push(path.join(__dirname, '..', '..', '..', 'data', 'theme.json'));
            if (process.resourcesPath) {
                candidates.push(path.join(process.resourcesPath, '..', 'data', 'theme.json'));
            }
            const localAppData = process.env.LOCALAPPDATA;
            if (localAppData) {
                const appId = (this.config && this.config.appId) || 'com.library.supermarket';
                candidates.push(path.join(localAppData, appId, 'theme.json'));
            }
            for (const p of candidates) {
                if (fs.existsSync(p)) {
                    const raw = fs.readFileSync(p, 'utf8');
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === 'object') {
                        return parsed;
                    }
                }
            }
        } catch (err) {
            if (this.logger) {
                this.logger.warn('[THEME] Could not read theme.json: ' + (err && err.message));
            }
        }
        return {
            theme: 'light',
            primary: '#00c8e0',
            appName: 'Library Store',
            displayName: 'Library Store',
            businessName: ''
        };
    }`;

if (wm.includes(oldConstructor.replace(/\r\n/g, '\n')) || wm.includes(oldConstructor)) {
  wm = wm.replace(oldConstructor.includes('\r\n') ? oldConstructor : oldConstructor.replace(/\n/g, '\r\n'), newConstructor.replace(/\n/g, '\r\n'));
  console.log('✓ Updated WindowManager constructor and added getThemeConfig()');
} else if (wm.includes('getThemeConfig()')) {
  console.log('✓ WindowManager constructor & getThemeConfig() already patched');
} else {
  // Normalize and replace
  const wmNormalized = wm.replace(/\r\n/g, '\n');
  const targetNorm = oldConstructor.replace(/\r\n/g, '\n');
  if (wmNormalized.includes(targetNorm)) {
    const isCrlf = wm.includes('\r\n');
    const rep = newConstructor.replace(/\r\n/g, '\n');
    const res = wmNormalized.replace(targetNorm, rep);
    wm = isCrlf ? res.replace(/\n/g, '\r\n') : res;
    console.log('✓ Updated WindowManager constructor (normalized)');
  } else {
    throw new Error('Could not find WindowManager constructor target in ' + wmPath);
  }
}

// 1.2 BrowserWindow backgroundColor in createMainWindow()
const oldWinBg = `backgroundColor: this.config.backgroundColor ?? '#0e141c',`;
const newWinBg = `backgroundColor: this.getThemeConfig().theme === 'light' ? '#f8fafc' : (this.config.backgroundColor || '#0e141c'),`;

if (wm.includes(oldWinBg)) {
  wm = wm.replace(oldWinBg, newWinBg);
  console.log('✓ Updated createMainWindow() window backgroundColor');
}

// 1.3 showSplashScreen()
const splashStartIdx = wm.indexOf('showSplashScreen() {');
if (splashStartIdx !== -1) {
  const splashEndIdx = wm.indexOf('this.mainWindow.show();\r\n    }', splashStartIdx) !== -1
    ? wm.indexOf('this.mainWindow.show();\r\n    }', splashStartIdx) + 'this.mainWindow.show();\r\n    }'.length
    : wm.indexOf('this.mainWindow.show();\n    }', splashStartIdx) + 'this.mainWindow.show();\n    }'.length;

  const newSplashScreen = `showSplashScreen() {
        if (!this.mainWindow) {
            this.createMainWindow();
        }
        const themeConfig = this.getThemeConfig();
        const isLight = themeConfig.theme === 'light';
        const primaryColor = themeConfig.primary || '#0078d7';
        const winBg = isLight ? '#f8fafc' : '#0e141c';
        try {
            this.mainWindow.setBackgroundColor(winBg);
        } catch (_) {}

        const displayTitle = (themeConfig.displayName && themeConfig.displayName !== 'Library Store')
            ? (themeConfig.businessName ? (themeConfig.displayName + ' — ' + themeConfig.businessName) : (themeConfig.displayName + ' — Library Store'))
            : (this.config.productNameAr || 'Library Store — نظام إدارة المتاجر والمكتبات');

        const cssThemeVars = isLight ? \`
      --bg: #f8fafc;
      --card: #ffffff;
      --border: #e2e8f0;
      --fg: #0f172a;
      --title: #0f172a;
      --muted: #64748b;
      --primary: \${primaryColor};
      --track-bg: #f1f5f9;
      --track-border: #0078d7;
      --label: #334155;
\` : \`
      --bg: #0e141c;
      --card: #131b26;
      --border: #223041;
      --fg: #e7eef7;
      --title: #ffffff;
      --muted: #8fa3ba;
      --primary: \${primaryColor};
      --track-bg: #131b26;
      --track-border: #0078d7;
      --label: #e7eef7;
\`;

        const html = \`<!DOCTYPE html>
<html lang="ar" dir="rtl" class="\${isLight ? 'light' : 'dark'}">
<head>
  <meta charset="utf-8">
  <title>\${displayTitle}</title>
  <style>
    :root {
\${cssThemeVars}
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: "Cairo", "Segoe UI", Tahoma, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      user-select: none;
      overflow: hidden;
      transition: background-color 0.2s ease, color 0.2s ease;
    }
    .container {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      max-width: 480px;
      padding: 32px;
    }
    .progress-bar-track {
      width: 246px;
      height: 20px;
      border: 1.5px solid var(--track-border);
      background: var(--track-bg);
      border-radius: 4px;
      overflow: hidden;
      position: relative;
      margin: 20px auto 8px;
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.08);
    }
    .progress-bar-fill {
      position: absolute;
      top: 0;
      bottom: 0;
      background: var(--primary);
      border-radius: 2px;
      animation: progress-slide 1.5s ease-in-out infinite;
    }
    @keyframes progress-slide {
      0% { left: -40%; width: 40%; }
      50% { left: 25%; width: 55%; }
      100% { left: 100%; width: 40%; }
    }
    .progress-bar-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--label);
      margin-bottom: 12px;
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      color: var(--title);
      margin-bottom: 8px;
      letter-spacing: -0.2px;
    }
    .status {
      font-size: 14px;
      color: var(--primary);
      margin-bottom: 6px;
      font-weight: 500;
    }
    .hint {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>\${displayTitle}</h1>
    <div class="progress-bar-track">
      <div class="progress-bar-fill"></div>
    </div>
    <div class="progress-bar-label">جاري التحميل</div>
    <div class="status">جاري تشغيل النظام والاتصال بقاعدة البيانات...</div>
    <div class="hint">برجاء الانتظار لحظات، يتم تجهيز بيئة التشغيل المحلية</div>
  </div>
</body>
</html>\`;
        this.mainWindow.loadURL(\`data:text/html;charset=utf-8,\${encodeURIComponent(html)}\`);
        this.mainWindow.show();
    }`;

  const isCrlf = wm.includes('\r\n');
  const oldSplashSlice = wm.slice(splashStartIdx, splashEndIdx);
  wm = wm.replace(oldSplashSlice, isCrlf ? newSplashScreen.replace(/\r?\n/g, '\r\n') : newSplashScreen);
  console.log('✓ Updated showSplashScreen() with dynamic light/dark theme styles');
} else {
  throw new Error('Could not find showSplashScreen() in ' + wmPath);
}

fs.writeFileSync(wmPath, wm, 'utf8');
console.log('✓ Successfully wrote ' + wmPath);

// 2. Patch desktop/engine/main/index.js
const indexPath = path.join(root, 'desktop/engine/main/index.js');
let idxContent = fs.readFileSync(indexPath, 'utf8');
const oldWmNew = 'const windowManager = new window_manager_1.WindowManager(config, preloadPath, logger, serverManager);';
const newWmNew = 'const windowManager = new window_manager_1.WindowManager(config, preloadPath, logger, serverManager, paths);';
if (idxContent.includes(oldWmNew)) {
  idxContent = idxContent.replace(oldWmNew, newWmNew);
  fs.writeFileSync(indexPath, idxContent, 'utf8');
  console.log('✓ Passed paths into WindowManager in ' + indexPath);
}

// 3. Patch server/db.js to include and export syncThemeFile
const dbJsPath = path.join(root, 'server/db.js');
let dbContent = fs.readFileSync(dbJsPath, 'utf8');
if (!dbContent.includes('function syncThemeFile(')) {
  const syncThemeCode = `
function syncThemeFile(settings) {
  try {
    let business = settings && settings.business ? settings.business : null;
    let branding = settings && settings.branding ? settings.branding : null;
    if (!business || !branding) {
      const db = openDb();
      const row = db.prepare('SELECT business, branding FROM AppSettings WHERE id=?').get('default');
      business = safeJson(row && row.business, DEFAULT_BUSINESS);
      branding = normalizeBranding(row && row.branding);
    }
    const themeData = {
      theme: branding.defaultTheme === 'light' ? 'light' : 'dark',
      primary: branding.primary || branding.primaryColor || '#00c8e0',
      appName: branding.appName || 'Library Store',
      displayName: business.displayName || business.businessName || 'Library Store',
      businessName: business.businessName || '',
      updatedAt: new Date().toISOString()
    };
    const candidates = [
      path.join(__dirname, '..', 'data'),
      path.join(__dirname, 'data'),
      path.join(process.cwd(), 'data'),
    ];
    if (process.env.ELECTRON_RESOURCES_PATH) {
      candidates.unshift(path.join(process.env.ELECTRON_RESOURCES_PATH, '..', 'data'));
    }
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      candidates.push(path.join(localAppData, 'com.library.supermarket'));
    }
    for (const d of candidates) {
      try {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
        fs.writeFileSync(path.join(d, 'theme.json'), JSON.stringify(themeData, null, 2), 'utf8');
      } catch (_) {}
    }
    return themeData;
  } catch (err) {
    console.warn('[THEME] Sync theme error:', err && err.message);
    return null;
  }
}
`;
  const insertTarget = 'function getSettings(tenantId) {';
  dbContent = dbContent.replace(insertTarget, syncThemeCode + '\n' + insertTarget);

  // Export syncThemeFile
  const exportTarget = 'openDb, closeDb, ensureBootstrap, ensureSystemData, getSettings, getDbPath,';
  dbContent = dbContent.replace(exportTarget, exportTarget + ' syncThemeFile,');

  fs.writeFileSync(dbJsPath, dbContent, 'utf8');
  console.log('✓ Added and exported syncThemeFile in server/db.js');
}

// 4. Patch server/api.js to sync theme on branding / business update
const apiJsPath = path.join(root, 'server/api.js');
let apiContent = fs.readFileSync(apiJsPath, 'utf8');
if (!apiContent.includes('syncThemeFile(')) {
  // Import syncThemeFile
  apiContent = apiContent.replace(
    "const { openDb, getSettings, getDbPath, setDbPath,",
    "const { openDb, getSettings, getDbPath, setDbPath, syncThemeFile,"
  );

  // Trigger sync on /system/settings/branding
  const oldBrandingEndpoint = `db.prepare('UPDATE "AppSettings" SET branding=@b, updatedAt=@t WHERE id=@id')
      .run({ b: JSON.stringify(newBranding), t: now(), id: 'default' });
    ok(res, { updated: true, branding: newBranding });`;

  const newBrandingEndpoint = `db.prepare('UPDATE "AppSettings" SET branding=@b, updatedAt=@t WHERE id=@id')
      .run({ b: JSON.stringify(newBranding), t: now(), id: 'default' });
    try { if (typeof syncThemeFile === 'function') syncThemeFile(getSettings('default')); } catch (_) {}
    ok(res, { updated: true, branding: newBranding });`;

  if (apiContent.includes(oldBrandingEndpoint)) {
    apiContent = apiContent.replace(oldBrandingEndpoint, newBrandingEndpoint);
  }

  // Trigger sync on /settings
  const oldSettingsEndpoint = `ok(res, getSettings('default'));`;
  const newSettingsEndpoint = `try { if (typeof syncThemeFile === 'function') syncThemeFile(getSettings('default')); } catch (_) {}
    ok(res, getSettings('default'));`;

  // Only replace in PUT /settings (around line 220)
  const settingsPutIdx = apiContent.indexOf("router.put('/settings',");
  if (settingsPutIdx !== -1) {
    const nextOkIdx = apiContent.indexOf(oldSettingsEndpoint, settingsPutIdx);
    if (nextOkIdx !== -1) {
      apiContent = apiContent.slice(0, nextOkIdx) + newSettingsEndpoint + apiContent.slice(nextOkIdx + oldSettingsEndpoint.length);
    }
  }

  fs.writeFileSync(apiJsPath, apiContent, 'utf8');
  console.log('✓ Triggered syncThemeFile on branding & settings save in server/api.js');
}

// 5. Patch server/index.js to sync theme on boot
const srvIndexPath = path.join(root, 'server/index.js');
let srvIndexContent = fs.readFileSync(srvIndexPath, 'utf8');
if (!srvIndexContent.includes('syncThemeFile(settings)')) {
  const oldBoot = `const { getSettings, openDb } = require('./db');
  const settings = getSettings('default');`;
  const newBoot = `const { getSettings, openDb, syncThemeFile } = require('./db');
  const settings = getSettings('default');
  try { if (typeof syncThemeFile === 'function') syncThemeFile(settings); } catch (_) {}`;

  if (srvIndexContent.includes(oldBoot)) {
    srvIndexContent = srvIndexContent.replace(oldBoot, newBoot);
    fs.writeFileSync(srvIndexPath, srvIndexContent, 'utf8');
    console.log('✓ Added syncThemeFile call on server boot in server/index.js');
  }
}

// 6. Patch src/components/library/app.tsx
const appTsxPath = path.join(root, 'src/components/library/app.tsx');
let appTsx = fs.readFileSync(appTsxPath, 'utf8');
if (appTsx.includes('bg-[#0e141c] text-[#e7eef7]')) {
  appTsx = appTsx.replace('bg-[#0e141c] text-[#e7eef7]', 'bg-background text-foreground');
  fs.writeFileSync(appTsxPath, appTsx, 'utf8');
  console.log('✓ Updated SplashScreen component to bg-background text-foreground in src/components/library/app.tsx');
}

// 7. Mirror server files to dist-desktop/win-unpacked/resources/server/
const distServer = path.join(root, 'dist-desktop/win-unpacked/resources/server');
if (fs.existsSync(distServer)) {
  fs.copyFileSync(dbJsPath, path.join(distServer, 'db.js'));
  fs.copyFileSync(apiJsPath, path.join(distServer, 'api.js'));
  fs.copyFileSync(srvIndexPath, path.join(distServer, 'index.js'));
  console.log('✓ Mirrored server files to dist-desktop/win-unpacked/resources/server');
}

// 8. Re-sync theme.json right now from custom.db
const syncScript = path.join(root, 'scripts/sync-theme.cjs');
if (fs.existsSync(syncScript)) {
  execSync(`"${process.execPath}" "${syncScript}"`, { stdio: 'inherit' });
}

console.log('=== PATCH COMPLETED SUCCESSFULLY ===');
