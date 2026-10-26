"use strict";
/**
 * LIBRARY_STORE ENGINE — Universal Electron Desktop Engine Entrypoint
 * © 2026 Library Store Engine · Software Solutions Platform · All rights reserved
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcRouter = exports.AppLifecycle = exports.WindowManager = exports.ServerManager = exports.DesktopLogger = exports.resolvePaths = exports.normalizeWindowsPath = void 0;
exports.runDesktop = runDesktop;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const paths_1 = require("./paths");
const logger_1 = require("./logger");
const server_manager_1 = require("./server-manager");
const window_manager_1 = require("./window-manager");
const lifecycle_1 = require("./lifecycle");
const ipc_router_1 = require("./ipc-router");
__exportStar(require("../shared/types"), exports);
var paths_2 = require("./paths");
Object.defineProperty(exports, "normalizeWindowsPath", { enumerable: true, get: function () { return paths_2.normalizeWindowsPath; } });
Object.defineProperty(exports, "resolvePaths", { enumerable: true, get: function () { return paths_2.resolvePaths; } });
var logger_2 = require("./logger");
Object.defineProperty(exports, "DesktopLogger", { enumerable: true, get: function () { return logger_2.DesktopLogger; } });
var server_manager_2 = require("./server-manager");
Object.defineProperty(exports, "ServerManager", { enumerable: true, get: function () { return server_manager_2.ServerManager; } });
var window_manager_2 = require("./window-manager");
Object.defineProperty(exports, "WindowManager", { enumerable: true, get: function () { return window_manager_2.WindowManager; } });
var lifecycle_2 = require("./lifecycle");
Object.defineProperty(exports, "AppLifecycle", { enumerable: true, get: function () { return lifecycle_2.AppLifecycle; } });
var ipc_router_2 = require("./ipc-router");
Object.defineProperty(exports, "IpcRouter", { enumerable: true, get: function () { return ipc_router_2.IpcRouter; } });
/**
 * Boots a Library Store Product desktop instance.
 */
async function runDesktop(config) {
    // 1. Resolve paths
    const paths = (0, paths_1.resolvePaths)(config);
    // 2. Initialize persistent logger
    const logger = new logger_1.DesktopLogger(paths.logFile);
    logger.info(`[BOOT] Launching ${config.productNameEn} (Product ID: ${config.productId}) v${config.version} (Build: ${config.build})`);
    // 3. Instantiate core modules
    const preloadPath = path.join(__dirname, '..', 'preload', 'index.js');
    const serverManager = new server_manager_1.ServerManager(config, paths, logger);
    const windowManager = new window_manager_1.WindowManager(config, preloadPath, logger, serverManager, paths);
    const lifecycle = new lifecycle_1.AppLifecycle(logger, serverManager, windowManager);
    const ipcRouter = new ipc_router_1.IpcRouter(config, paths, serverManager, windowManager, logger);
    // 4. Single-instance lock
    if (!lifecycle.enforceSingleInstance()) {
        return;
    }
    // 5. Register lifecycle hooks
    lifecycle.registerShutdownHooks();
    // 6. Register IPC handlers
    ipcRouter.registerHandlers();
    // 7. Boot sequence once Electron is ready
    await electron_1.app.whenReady();
    logger.info('[BOOT] Electron app is ready. Showing immediate splash screen...');
    // Present splash screen immediately (< 150ms) for instant feedback
    windowManager.showSplashScreen();
    // Start the supervised local server (resilient cold start)
    const serverStarted = await serverManager.start();
    if (serverStarted) {
        logger.info('[BOOT] Server successfully verified. Loading UI...');
        await windowManager.loadApp();
    }
    else {
        logger.error('[BOOT] Server startup failed. Revealing diagnostic recovery interface.');
        windowManager.showDiagnosticsScreen();
    }
}
