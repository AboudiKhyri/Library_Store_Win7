"use strict";
/**
 * LIBRARY_STORE — Desktop Preload Bridge
 * © 2026 Library_Store · All rights reserved
 */
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");

const desktopApi = {
    getAppInfo: () => electron_1.ipcRenderer.invoke('library-store:get-app-info'),
    getDiagnostics: () => electron_1.ipcRenderer.invoke('library-store:get-diagnostics'),
    restartServer: () => electron_1.ipcRenderer.invoke('library-store:restart-service'),
    openExternal: (url) => electron_1.ipcRenderer.invoke('library-store:open-external', url),
};

try {
    electron_1.contextBridge.exposeInMainWorld('libraryStore', desktopApi);
}
catch (e) {
    window.libraryStore = desktopApi;
}

window.addEventListener('error', (e) => {
    console.error('[WINDOW-ERROR]', e.message, e.filename, e.lineno, e.error ? e.error.stack : '');
});
window.addEventListener('unhandledrejection', (e) => {
    console.error('[UNHANDLED-REJECTION]', e.reason ? (e.reason.stack || e.reason.message || e.reason) : e);
});
