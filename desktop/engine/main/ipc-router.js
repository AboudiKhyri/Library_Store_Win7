"use strict";
/**
 * LIBRARY_STORE ENGINE — Secure Typed IPC Router
 * © 2026 Library Store Engine · Software Solutions Platform · All rights reserved
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcRouter = void 0;
const electron_1 = require("electron");
class IpcRouter {
    config;
    paths;
    serverManager;
    windowManager;
    logger;
    constructor(config, paths, serverManager, windowManager, logger) {
        this.config = config;
        this.paths = paths;
        this.serverManager = serverManager;
        this.windowManager = windowManager;
        this.logger = logger;
    }
    registerHandlers() {
        const handleAppInfo = (event) => {
            this.validateSender(event);
            const info = {
                productId: this.config.productId,
                productNameAr: this.config.productNameAr,
                productNameEn: this.config.productNameEn,
                version: this.config.version,
                build: this.config.build,
                electronVersion: process.versions.electron,
                chromiumVersion: process.versions.chrome,
                nodeVersion: process.versions.node,
            };
            return info;
        };
        electron_1.ipcMain.handle('library-store:get-app-info', handleAppInfo);

        // 2. Get Diagnostic State
        const handleDiagnostics = (event) => {
            this.validateSender(event);
            const diagnostics = {
                product: this.config.productId,
                productNameAr: this.config.productNameAr,
                version: this.config.version,
                build: this.config.build,
                electronVersion: process.versions.electron,
                chromiumVersion: process.versions.chrome,
                nodeVersion: process.versions.node,
                platform: process.platform,
                arch: process.arch,
                port: this.serverManager.getPort(),
                serverPid: this.serverManager.getPid(),
                serverState: this.serverManager.getState(),
                serverExitCode: this.serverManager.getExitCode(),
                uptimeSec: this.serverManager.getUptime(),
                logPath: this.logger.getLogPath(),
                dataPath: this.paths.dataDir,
                lastAction: this.serverManager.getLastAction(),
                stderrTail: this.logger.getStderrTail(),
            };
            return diagnostics;
        };
        electron_1.ipcMain.handle('library-store:get-diagnostics', handleDiagnostics);

        // 3. Restart Server / Retry
        const handleRestart = async (event) => {
            this.validateSender(event);
            this.logger.info('[IPC] Manual restart requested via IPC');
            this.serverManager.stop();
            const ok = await this.serverManager.start();
            if (ok) {
                await this.windowManager.loadApp();
            }
            else {
                this.windowManager.showDiagnosticsScreen();
            }
            return ok;
        };
        electron_1.ipcMain.handle('library-store:restart-service', handleRestart);

        // 4. Open Verified External URL
        const handleOpenExternal = async (event, url) => {
            this.validateSender(event);
            if (typeof url !== 'string')
                return false;
            // Only allow https links
            if (!url.startsWith('https://'))
                return false;
            try {
                await electron_1.shell.openExternal(url);
                return true;
            }
            catch {
                return false;
            }
        };
        electron_1.ipcMain.handle('library-store:open-external', handleOpenExternal);
    }
    /**
     * Asserts that the IPC sender originates from the local trusted loopback server.
     */
    validateSender(event) {
        const url = event.senderFrame?.url || '';
        const allowedPort = this.serverManager.getPort();
        const isAllowed = url.startsWith(`http://127.0.0.1:${allowedPort}`) ||
            url.startsWith(`http://localhost:${allowedPort}`) ||
            url.startsWith('data:text/html');
        if (!isAllowed) {
            this.logger.error(`[SECURITY] Rejected unauthorized IPC request from: ${url}`);
            throw new Error('Unauthorized IPC invocation');
        }
    }
}
exports.IpcRouter = IpcRouter;
