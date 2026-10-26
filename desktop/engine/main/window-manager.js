"use strict";
/**
 * LIBRARY_STORE ENGINE — Secure Window Manager
 * © 2026 Library Store Engine · Software Solutions Platform · All rights reserved
 */
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = require("path");
const fs = require("fs");
class WindowManager {
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
    }
    getWindow() {
        return this.mainWindow;
    }
    /**
     * Creates and presents the primary application window.
     */
    createMainWindow() {
        this.logger.info(`[WINDOW] Creating secure BrowserWindow for ${this.config.productNameEn}...`);
        const width = this.config.defaultWidth ?? 1440;
        const height = this.config.defaultHeight ?? 900;
        const minWidth = this.config.minWidth ?? 1024;
        const minHeight = this.config.minHeight ?? 700;
        const iconPath = path.join(__dirname, '../../icons/icon.png');
        const icon = fs.existsSync(iconPath) ? iconPath : undefined;
        this.mainWindow = new electron_1.BrowserWindow({
            title: `${this.config.productNameAr} — Library Store`,
            icon,
            width,
            height,
            minWidth,
            minHeight,
            center: true,
            backgroundColor: this.getThemeConfig().theme === 'light' ? '#f8fafc' : (this.config.backgroundColor || '#0e141c'),
            show: false, // Show only when ready
            autoHideMenuBar: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
                webSecurity: true,
                allowRunningInsecureContent: false,
                preload: this.preloadPath,
            },
        });
        this.mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
            if (level >= 3 || message.includes('FRONTEND-ERROR') || message.includes('GLOBAL-ERROR')) {
                this.logger.error(`[RENDERER] ${message} (${sourceId}:${line})`);
            } else if (level === 2) {
                this.logger.warn(`[RENDERER] ${message} (${sourceId}:${line})`);
            } else {
                this.logger.info(`[RENDERER] [lvl ${level}] ${message} (${sourceId}:${line})`);
            }
        });
        // 1. Navigation Guard: Never navigate away from local trusted loopback
        const allowedOrigin = `http://127.0.0.1:${this.serverManager.getPort()}`;
        this.mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
            if (!targetUrl.startsWith(allowedOrigin)) {
                this.logger.warn(`[SECURITY] Blocked external navigation to: ${targetUrl}`);
                event.preventDefault();
            }
        });

        // 1b. Camera / Media Permission Guard: Allow only "media" for local trusted loopback
        this.mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback, details) => {
            const url = details.requestingUrl || webContents.getURL();
            if (permission === 'media' && url.startsWith(allowedOrigin)) {
                this.logger.info(`[SECURITY] Granted media permission to loopback origin: ${url}`);
                return callback(true);
            }
            this.logger.warn(`[SECURITY] Denied ${permission} permission to: ${url}`);
            return callback(false);
        });
        this.mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
            if (permission === 'media' && requestingOrigin === allowedOrigin) {
                return true;
            }
            return false;
        });
        // 2. Popup / New Window Guard
        this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            // If external link (e.g. documentation, billing), open in OS default browser
            if (url.startsWith('https://') || url.startsWith('http://')) {
                this.logger.info(`[WINDOW] Opening external link in OS browser: ${url}`);
                electron_1.shell.openExternal(url).catch(() => { });
            }
            return { action: 'deny' };
        });
        // 3. Show window when ready to paint to eliminate white flash
        this.mainWindow.once('ready-to-show', () => {
            this.logger.info('[WINDOW] Window ready-to-show: revealing window');
            this.mainWindow?.show();
            this.mainWindow?.focus();
        });
        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });
        return this.mainWindow;
    }
    /**
     * Displays an immediate native splash/loading screen while the server initializes.
     * Gives instant visual feedback to the user on application launch.
     */
    showSplashScreen() {
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

        const cssThemeVars = isLight ? `
      --bg: #f8fafc;
      --card: #ffffff;
      --border: #e2e8f0;
      --fg: #0f172a;
      --title: #0f172a;
      --muted: #64748b;
      --primary: ${primaryColor};
      --track-bg: #f1f5f9;
      --track-border: #0078d7;
      --label: #334155;
` : `
      --bg: #0e141c;
      --card: #131b26;
      --border: #223041;
      --fg: #e7eef7;
      --title: #ffffff;
      --muted: #8fa3ba;
      --primary: ${primaryColor};
      --track-bg: #131b26;
      --track-border: #0078d7;
      --label: #e7eef7;
`;

        const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl" class="${isLight ? 'light' : 'dark'}">
<head>
  <meta charset="utf-8">
  <title>${displayTitle}</title>
  <style>
    :root {
${cssThemeVars}
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
    <h1>${displayTitle}</h1>
    <div class="progress-bar-track">
      <div class="progress-bar-fill"></div>
    </div>
    <div class="progress-bar-label">جاري التحميل</div>
    <div class="status">جاري تشغيل النظام والاتصال بقاعدة البيانات...</div>
    <div class="hint">برجاء الانتظار لحظات، يتم تجهيز بيئة التشغيل المحلية</div>
  </div>
</body>
</html>`;
        this.mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
        this.mainWindow.show();
    }
    /**
     * Loads the local application server URL.
     */
    async loadApp() {
        if (!this.mainWindow) {
            this.createMainWindow();
        }
        const port = this.serverManager.getPort();
        const targetUrl = `http://127.0.0.1:${port}/`;
        const allowedOrigin = `http://127.0.0.1:${port}`;
        this.logger.info(`[WINDOW] Loading local application at ${targetUrl}`);
        try {
            // Invalidate prior sessions on launch: clear cookies and session storage for loopback origin
            try {
                await this.mainWindow.webContents.session.clearStorageData({
                    origin: allowedOrigin,
                    storages: ['cookies', 'sessionstorage'], // preserve localstorage for user theme & lang
                });
                this.logger.info(`[AUTH] Cleared prior session storage data for ${allowedOrigin}`);
            } catch (clearErr) {
                this.logger.warn(`[AUTH] Failed to clear session data on launch: ${clearErr && clearErr.message}`);
            }
            await this.mainWindow.loadURL(targetUrl);
            if (!this.mainWindow.isVisible()) {
                this.mainWindow.show();
            }
        }
        catch (err) {
            this.logger.error(`[WINDOW] Failed to load ${targetUrl}:`, err);
            this.showDiagnosticsScreen();
        }
    }
    /**
     * Renders a branded diagnostic recovery screen if the server fails.
     */
    showDiagnosticsScreen() {
        if (!this.mainWindow) {
            this.createMainWindow();
        }
        const port = this.serverManager.getPort();
        const state = this.serverManager.getState();
        const exitCode = this.serverManager.getExitCode() ?? 'N/A';
        const stderrTail = this.logger.getStderrTail().slice(-6).join('\n');
        const lastAction = this.serverManager.getLastAction();
        const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>${this.config.productNameAr} — تشخيص النظام</title>
  <style>
    :root {
      --bg: #0e141c;
      --card: #131b26;
      --border: #223041;
      --fg: #e7eef7;
      --muted: #8fa3ba;
      --danger: #f87171;
      --primary: #00c8e0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: "Segoe UI", Tahoma, "Cairo", sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 32px;
      max-width: 600px;
      width: 100%;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    h1 { font-size: 20px; color: var(--danger); margin-bottom: 8px; }
    p { color: var(--muted); font-size: 14px; margin-bottom: 20px; line-height: 1.6; }
    .table { width: 100%; font-size: 13px; margin-bottom: 20px; }
    .table td { padding: 6px 0; }
    .table td:first-child { color: var(--muted); width: 140px; }
    .code-box {
      background: #080c12;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
      font-family: Consolas, monospace;
      font-size: 12px;
      color: #cbd5e1;
      max-height: 160px;
      overflow-y: auto;
      white-space: pre-wrap;
      direction: ltr;
      text-align: left;
      margin-bottom: 24px;
    }
    .btn {
      background: var(--primary);
      color: #041017;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: bold;
      font-size: 14px;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="card">
    <h1>تعذر تشغيل خدمة ${this.config.productNameAr}</h1>
    <p>لم يتمكن النظام من الاتصال بالخادم المحلي الداخلي. يمكنك إعادة المحاولة أو مراجعة بيانات التشخيص التالية:</p>

    <table class="table">
      <tr><td>المنفذ المستهدف:</td><td>${port}</td></tr>
      <tr><td>حالة الخدمة:</td><td>${state} (${exitCode})</td></tr>
      <tr><td>الإجراء الأخير:</td><td>${lastAction}</td></tr>
    </table>

    <div class="code-box">${stderrTail || 'لا توجد رسائل خطأ إضافية.'}</div>

    <button class="btn" onclick="window.libraryStore ? window.libraryStore.restartServer() : location.reload()">إعادة تشغيل الخدمة (Retry)</button>
  </div>
</body>
</html>`;
        this.mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
        this.mainWindow.show();
    }
}
exports.WindowManager = WindowManager;
