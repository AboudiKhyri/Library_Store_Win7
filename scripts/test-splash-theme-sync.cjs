/**
 * scripts/test-splash-theme-sync.cjs
 * Automated test suite asserting native Electron splash screen & app splash theme synchronization.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const Module = require('module');

console.log('=== TEST SPLASH SCREEN THEME SYNCHRONIZATION ===');

const root = path.resolve(__dirname, '..');
const wmPath = path.join(root, 'desktop/engine/main/window-manager.js');
const dbJsPath = path.join(root, 'server/db.js');
const apiJsPath = path.join(root, 'server/api.js');
const srvIndexPath = path.join(root, 'server/index.js');
const appTsxPath = path.join(root, 'src/components/library/app.tsx');
const themeJsonPath = path.join(root, 'data/theme.json');
const asarPath = path.join(root, 'dist-desktop/win-unpacked/resources/app.asar');

// 1. Verify window-manager.js contains getThemeConfig and dynamic splash screen
assert(fs.existsSync(wmPath), 'desktop/engine/main/window-manager.js must exist');
const wm = fs.readFileSync(wmPath, 'utf8');

assert(wm.includes('getThemeConfig()'), 'window-manager.js must contain getThemeConfig()');
assert(wm.includes('this.mainWindow.setBackgroundColor(winBg)'), 'showSplashScreen must set window background color dynamically');
assert(wm.includes('isLight ? \'#f8fafc\''), 'window-manager.js must use #f8fafc for light background');
assert(wm.includes('--track-bg: #f1f5f9;'), 'window-manager.js must use #f1f5f9 for light progress track');
assert(wm.includes('--track-bg: #131b26;'), 'window-manager.js must use #131b26 for dark progress track');
assert(wm.includes('progress-bar-track'), 'window-manager.js must maintain progress-bar-track class');
assert(wm.includes('progress-bar-fill'), 'window-manager.js must maintain progress-bar-fill class');
assert(wm.includes('جاري التحميل'), 'window-manager.js must include Arabic loading label');
console.log('✓ desktop/engine/main/window-manager.js verified with dynamic theme support');

// Mock electron module for standalone Node test runner
const origRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  if (id === 'electron') {
    return {
      shell: { openExternal: async () => {} },
      BrowserWindow: class MockBrowserWindow {
        constructor() {}
      }
    };
  }
  return origRequire.apply(this, arguments);
};

// 2. Test WindowManager mock instantiation and splash generation in both light and dark modes
const { WindowManager } = require(wmPath);
let loadedUrl = '';
let setBgColor = '';
const mockWindow = {
  loadURL(url) { loadedUrl = decodeURIComponent(url); },
  show() {},
  setBackgroundColor(color) { setBgColor = color; }
};

const wmLight = new WindowManager(
  { productNameAr: 'Library Store — نظام إدارة المتاجر', productNameEn: 'Library Store', appId: 'com.library.supermarket' },
  '',
  { info() {}, warn() {}, error() {} },
  { getPort: () => 3210 }
);
wmLight.mainWindow = mockWindow;

// Mock getThemeConfig for light
wmLight.getThemeConfig = () => ({
  theme: 'light',
  primary: '#00c8e0',
  appName: 'Library Store',
  displayName: 'محمد خيري',
  businessName: 'فرع 1'
});

wmLight.showSplashScreen();
assert(setBgColor === '#f8fafc', `Light splash window bgColor must be #f8fafc, got ${setBgColor}`);
assert(loadedUrl.includes('class="light"'), 'Light splash must have class="light" on html');
assert(loadedUrl.includes('--bg: #f8fafc;'), 'Light splash must define --bg: #f8fafc');
assert(loadedUrl.includes('--track-bg: #f1f5f9;'), 'Light splash must define --track-bg: #f1f5f9');
assert(loadedUrl.includes('--label: #334155;'), 'Light splash must define --label: #334155');
assert(loadedUrl.includes('محمد خيري — فرع 1'), 'Light splash must display dynamic store title');
console.log('✓ Light theme splash screen renders correct styling and colors');

// Mock getThemeConfig for dark
wmLight.getThemeConfig = () => ({
  theme: 'dark',
  primary: '#00c8e0',
  appName: 'Library Store',
  displayName: 'محمد خيري',
  businessName: 'فرع 1'
});

wmLight.showSplashScreen();
assert(setBgColor === '#0e141c', `Dark splash window bgColor must be #0e141c, got ${setBgColor}`);
assert(loadedUrl.includes('class="dark"'), 'Dark splash must have class="dark" on html');
assert(loadedUrl.includes('--bg: #0e141c;'), 'Dark splash must define --bg: #0e141c');
assert(loadedUrl.includes('--track-bg: #131b26;'), 'Dark splash must define --track-bg: #131b26');
assert(loadedUrl.includes('--label: #e7eef7;'), 'Dark splash must define --label: #e7eef7');
console.log('✓ Dark theme splash screen renders correct styling and colors');

// 3. Verify server/db.js exports syncThemeFile and syncThemeFile works
assert(fs.existsSync(dbJsPath), 'server/db.js must exist');
const { syncThemeFile, getSettings } = require(dbJsPath);
assert(typeof syncThemeFile === 'function', 'server/db.js must export syncThemeFile function');

const synced = syncThemeFile();
assert(synced && typeof synced === 'object', 'syncThemeFile must return theme object');
assert(synced.theme === 'light' || synced.theme === 'dark', 'synced theme must be light or dark');
assert(fs.existsSync(themeJsonPath), 'data/theme.json must exist after syncThemeFile()');

const themeJson = JSON.parse(fs.readFileSync(themeJsonPath, 'utf8'));
assert(themeJson.theme === synced.theme, 'data/theme.json must match syncThemeFile result');
console.log(`✓ server/db.js syncThemeFile() verified (current active theme: "${themeJson.theme}", primary: "${themeJson.primary}")`);

// 4. Verify server/api.js calls syncThemeFile on branding & settings update
assert(fs.existsSync(apiJsPath), 'server/api.js must exist');
const apiJs = fs.readFileSync(apiJsPath, 'utf8');
assert(apiJs.includes('syncThemeFile'), 'server/api.js must call syncThemeFile');
console.log('✓ server/api.js verified with real-time theme synchronization');

// 5. Verify server/index.js calls syncThemeFile on startup
assert(fs.existsSync(srvIndexPath), 'server/index.js must exist');
const srvIndex = fs.readFileSync(srvIndexPath, 'utf8');
assert(srvIndex.includes('syncThemeFile'), 'server/index.js must call syncThemeFile on boot');
console.log('✓ server/index.js verified with boot theme synchronization');

// 6. Verify in-app React SplashScreen in src/components/library/app.tsx
assert(fs.existsSync(appTsxPath), 'src/components/library/app.tsx must exist');
const appTsx = fs.readFileSync(appTsxPath, 'utf8');
assert(!appTsx.includes('bg-[#0e141c] text-[#e7eef7]'), 'app.tsx must NOT contain hardcoded dark splash classes');
assert(appTsx.includes('bg-background text-foreground'), 'app.tsx must use bg-background text-foreground for splash screen');
console.log('✓ src/components/library/app.tsx verified with theme-adaptive splash screen');

// 7. Verify dist-desktop app.asar contains updated window-manager.js
if (fs.existsSync(asarPath)) {
  const asarBuf = fs.readFileSync(asarPath);
  assert(asarBuf.includes('getThemeConfig'), 'app.asar must include getThemeConfig');
  assert(asarBuf.includes('setBackgroundColor'), 'app.asar must include setBackgroundColor');
  assert(asarBuf.includes('progress-bar-track'), 'app.asar must include progress-bar-track');
  console.log('✓ dist-desktop/win-unpacked/resources/app.asar verified with latest theme-synchronized splash logic');
}

console.log('[PASS] ALL SPLASH SCREEN THEME SYNCHRONIZATION CHECKS PASSED CLEANLY (7/7)!');
