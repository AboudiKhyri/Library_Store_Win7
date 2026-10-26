"use strict";
/**
 * LIBRARY_STORE ENGINE — Application Lifecycle & Single-Instance Lock
 * © 2026 Library Store Engine · Software Solutions Platform · All rights reserved
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppLifecycle = void 0;
const electron_1 = require("electron");
class AppLifecycle {
    logger;
    serverManager;
    windowManager;
    constructor(logger, serverManager, windowManager) {
        this.logger = logger;
        this.serverManager = serverManager;
        this.windowManager = windowManager;
    }
    /**
     * Enforces single-instance lock across the system.
     * Returns true if this process is the primary instance.
     */
    enforceSingleInstance() {
        const gotLock = electron_1.app.requestSingleInstanceLock();
        if (!gotLock) {
            this.logger.warn('[BOOT] Another instance is already running — focusing existing and exiting');
            electron_1.app.quit();
            return false;
        }
        electron_1.app.on('second-instance', () => {
            this.logger.info('[BOOT] Second launch detected — focusing primary window');
            const win = this.windowManager.getWindow();
            if (win) {
                if (win.isMinimized())
                    win.restore();
                win.focus();
            }
        });
        return true;
    }
    /**
     * Registers application shutdown and cleanup hooks.
     */
    registerShutdownHooks() {
        let isCleanedUp = false;
        const cleanup = () => {
            if (isCleanedUp)
                return;
            isCleanedUp = true;
            this.logger.info('[BOOT] Application shutdown triggered — terminating server process tree');
            try {
                const res = this.serverManager.stop();
                if (res && typeof res.catch === 'function') {
                    res.catch((err) => {
                        this.logger.error('[BOOT] Error stopping server:', err);
                    });
                }
            }
            catch (err) {
                this.logger.error('[BOOT] Exception during server stop:', err);
            }
        };
        electron_1.app.on('before-quit', cleanup);
        electron_1.app.on('will-quit', cleanup);
        electron_1.app.on('window-all-closed', () => {
            this.logger.info('[BOOT] All windows closed — exiting application');
            cleanup();
            electron_1.app.quit();
        });
        // Process-level uncaught exception handling
        process.on('uncaughtException', (err) => {
            this.logger.error('[BOOT] Uncaught exception in main process:', err);
        });
        process.on('unhandledRejection', (reason) => {
            this.logger.error('[BOOT] Unhandled rejection in main process:', reason);
        });
    }
}
exports.AppLifecycle = AppLifecycle;
