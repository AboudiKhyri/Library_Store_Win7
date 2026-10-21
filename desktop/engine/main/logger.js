"use strict";
/**
 * LIBRARY_STORE ENGINE — Desktop Engine Logger
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
exports.DesktopLogger = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const MAX_LOG_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB rotation threshold
class DesktopLogger {
    logPath = null;
    stderrTail = [];
    maxTailLength = 20;
    constructor(logPath) {
        if (logPath) {
            this.init(logPath);
        }
    }
    init(logPath) {
        this.logPath = logPath;
        try {
            const dir = path.dirname(logPath);
            fs.mkdirSync(dir, { recursive: true });
            // Check for rotation
            if (fs.existsSync(logPath)) {
                const stats = fs.statSync(logPath);
                if (stats.size > MAX_LOG_SIZE_BYTES) {
                    const backupPath = `${logPath}.old`;
                    try {
                        if (fs.existsSync(backupPath))
                            fs.unlinkSync(backupPath);
                        fs.renameSync(logPath, backupPath);
                    }
                    catch { }
                }
            }
            this.info('────────────────────────────────────────────────────────');
            this.info(`[BOOT] Library Store Desktop Logger initialized at ${logPath}`);
        }
        catch (err) {
            console.error('[logger] Failed to initialize log file:', err);
        }
    }
    getLogPath() {
        return this.logPath || '';
    }
    getStderrTail() {
        return [...this.stderrTail];
    }
    pushStderr(line) {
        const sanitized = this.scrubSecrets(line.trim());
        if (!sanitized)
            return;
        this.stderrTail.push(sanitized);
        if (this.stderrTail.length > this.maxTailLength) {
            this.stderrTail.shift();
        }
        this.log('ERROR', `[server:err] ${sanitized}`);
    }
    info(message) {
        this.log('INFO', message);
    }
    warn(message) {
        this.log('WARN', message);
    }
    error(message, error) {
        let text = message;
        if (error instanceof Error) {
            text += ` — ${error.message}\n${error.stack}`;
        }
        else if (error) {
            text += ` — ${String(error)}`;
        }
        this.log('ERROR', text);
    }
    log(level, message) {
        const timestamp = new Date().toISOString();
        const scrubbed = this.scrubSecrets(message);
        const line = `${timestamp} [library-store] [${level}] ${scrubbed}\n`;
        // Output to console / terminal
        if (level === 'ERROR') {
            console.error(line.trimEnd());
        }
        else {
            console.log(line.trimEnd());
        }
        // Append to disk
        if (this.logPath) {
            try {
                fs.appendFileSync(this.logPath, line, 'utf8');
            }
            catch (e) {
                console.error('[logger] Could not write to log file:', e);
            }
        }
    }
    /**
     * Strictly sanitizes sensitive credentials before logging.
     */
    scrubSecrets(text) {
        if (!text)
            return '';
        return text
            // Redact GitHub PAT
            .replace(/github_pat_[a-zA-Z0-9_]{20,}/gi, '[REDACTED_GITHUB_PAT]')
            .replace(/ghp_[a-zA-Z0-9]{20,}/gi, '[REDACTED_GH_TOKEN]')
            // Redact JWT tokens
            .replace(/eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, '[REDACTED_JWT]')
            // Redact Authorization headers
            .replace(/Bearer\s+[a-zA-Z0-9._~+/-]+=*/gi, 'Bearer [REDACTED_TOKEN]')
            // Redact private keys
            .replace(/-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]')
            // Redact password parameters
            .replace(/("password"|"adminKey"|"secret")\s*:\s*"[^"]+"/gi, '$1:"[REDACTED]"');
    }
}
exports.DesktopLogger = DesktopLogger;
