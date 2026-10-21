"use strict";
/**
 * LIBRARY_STORE ENGINE — Desktop Engine Path Resolution & Hardening
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeWindowsPath = normalizeWindowsPath;
exports.resolvePaths = resolvePaths;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
let electronApp = null;
try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const electron = require('electron');
    if (electron && typeof electron === 'object' && electron.app) {
        electronApp = electron.app;
    }
}
catch { }
/**
 * Normalizes Windows filesystem paths for subprocesses (Node.js, Prisma SQLite, etc.):
 * 1. Strips the Windows verbatim/extended-length namespace prefix (`\\?\` or `\\?\UNC\`)
 *    which causes Node.js CJS loader (`lstat 'E:'` EISDIR) and Prisma SQLite (`index out of bounds`) to crash.
 * 2. Converts `\\?\C:\path` -> `C:\path`
 * 3. Converts `\\?\UNC\server\share` -> `\\server\share`
 * 4. Preserves forward/backward slashes appropriately.
 * 5. Handles paths with spaces, parentheses, and Unicode characters safely.
 */
function normalizeWindowsPath(rawPath) {
    if (!rawPath)
        return '';
    let normalized = rawPath.trim();
    // Handle extended-length UNC path: \\?\UNC\server\share -> \\server\share
    if (normalized.startsWith('\\\\?\\UNC\\')) {
        normalized = '\\\\' + normalized.slice(8);
    }
    // Handle extended-length local path: \\?\C:\path -> C:\path
    else if (normalized.startsWith('\\\\?\\')) {
        normalized = normalized.slice(4);
    }
    // Normalize separators according to the platform
    return path.normalize(normalized);
}
function resolvePaths(config) {
    const isPackaged = electronApp ? Boolean(electronApp.isPackaged) : false;
    // 1. Resolve mutable user data directory (check project local data dir first)
    const localProjectData = normalizeWindowsPath(path.join(process.cwd(), 'data'));
    let dataDir = localProjectData;
    if (!fs.existsSync(localProjectData)) {
        const home = process.env.USERPROFILE || process.env.HOME || '';
        const localAppData = process.env.LOCALAPPDATA || (home ? path.join(home, 'AppData', 'Local') : process.cwd());
        dataDir = normalizeWindowsPath(path.join(localAppData, config.appId));
    }
    const logsDir = normalizeWindowsPath(path.join(dataDir, 'logs'));
    const logFile = normalizeWindowsPath(path.join(logsDir, 'library-desktop.log'));
    const databasePath = normalizeWindowsPath(path.join(dataDir, 'custom.db'));
    const deviceSecretPath = normalizeWindowsPath(path.join(dataDir, 'device.secret'));
    const backupsDir = normalizeWindowsPath(path.join(dataDir, 'backups'));
    // Ensure mutable directories exist
    try {
        fs.mkdirSync(dataDir, { recursive: true });
        fs.mkdirSync(logsDir, { recursive: true });
        fs.mkdirSync(backupsDir, { recursive: true });
    }
    catch (err) {
        console.error('[paths] Failed to create data directories:', err);
    }
    // 2. Resolve installation and server directories
    let installDir;
    let serverDir;
    let nodeExecutable;
    if (isPackaged) {
        // In packaged electron application:
        // process.resourcesPath points to <InstallDir>\resources
        installDir = normalizeWindowsPath(path.dirname(process.resourcesPath));
        // Check possible locations for the standalone server:
        // 1. <resourcesPath>/server
        // 2. <resourcesPath>/app/server
        // 3. <resourcesPath>/app.asar.unpacked/server
        const candidateServer1 = normalizeWindowsPath(path.join(process.resourcesPath, 'server'));
        const candidateServer2 = normalizeWindowsPath(path.join(process.resourcesPath, 'app', 'server'));
        const candidateServer3 = normalizeWindowsPath(path.join(process.resourcesPath, 'app.asar.unpacked', 'server'));
        if (fs.existsSync(path.join(candidateServer1, 'server.js'))) {
            serverDir = candidateServer1;
        }
        else if (fs.existsSync(path.join(candidateServer2, 'server.js'))) {
            serverDir = candidateServer2;
        }
        else if (fs.existsSync(path.join(candidateServer3, 'server.js'))) {
            serverDir = candidateServer3;
        }
        else {
            serverDir = candidateServer1;
        }
        // Bundled Node.js binary location in packaged app:
        // e.g. <resourcesPath>/bin/node.exe or <resourcesPath>/node.exe
        const bundledNode1 = normalizeWindowsPath(path.join(process.resourcesPath, 'bin', 'node.exe'));
        const bundledNode2 = normalizeWindowsPath(path.join(process.resourcesPath, 'node.exe'));
        const bundledNode3 = normalizeWindowsPath(path.join(installDir, 'node.exe'));
        if (fs.existsSync(bundledNode1)) {
            nodeExecutable = bundledNode1;
        }
        else if (fs.existsSync(bundledNode2)) {
            nodeExecutable = bundledNode2;
        }
        else if (fs.existsSync(bundledNode3)) {
            nodeExecutable = bundledNode3;
        }
        else {
            // Fallback: use system node or electron binary with ELECTRON_RUN_AS_NODE
            nodeExecutable = process.execPath;
        }
    }
    else {
        // In development mode:
        // Resolve relative to the current working directory / project root
        installDir = normalizeWindowsPath(process.cwd());
        if (fs.existsSync(path.join(installDir, 'server', 'server.js'))) {
            serverDir = normalizeWindowsPath(path.join(installDir, 'server'));
        }
        else if (fs.existsSync(path.join(installDir, 'server.js'))) {
            serverDir = installDir;
        }
        else {
            serverDir = installDir;
        }
        // In dev, use bundled desktop/bin/node.exe or bin/node.exe if available, otherwise process.execPath
        const localNodeDesktop = normalizeWindowsPath(path.join(installDir, 'desktop', 'bin', 'node.exe'));
        const localNodeRoot = normalizeWindowsPath(path.join(installDir, 'bin', 'node.exe'));
        if (fs.existsSync(localNodeDesktop)) {
            nodeExecutable = localNodeDesktop;
        } else if (fs.existsSync(localNodeRoot)) {
            nodeExecutable = localNodeRoot;
        } else {
            nodeExecutable = process.execPath;
        }
    }
    const serverScript = normalizeWindowsPath(path.join(serverDir, 'server.js'));
    return {
        installDir,
        serverDir,
        serverScript,
        nodeExecutable,
        dataDir,
        logsDir,
        logFile,
        databasePath,
        deviceSecretPath,
        backupsDir,
    };
}
