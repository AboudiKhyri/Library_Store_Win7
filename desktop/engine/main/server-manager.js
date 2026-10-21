"use strict";
/**
 * LIBRARY_STORE ENGINE — Local Server Supervisor & Process-Tree Manager
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
exports.ServerManager = void 0;
const child_process_1 = require("child_process");
const http = __importStar(require("http"));
const net = __importStar(require("net"));
class ServerManager {
    config;
    paths;
    logger;
    child = null;
    state = 'not_started';
    assignedPort;
    pid = null;
    exitCode = null;
    isShuttingDown = false;
    lastAction = 'Initialized';
    startTime = null;
    constructor(config, paths, logger) {
        this.config = config;
        this.paths = paths;
        this.logger = logger;
        this.assignedPort = config.defaultPort;
    }
    getState() {
        return this.state;
    }
    getPid() {
        return this.pid;
    }
    getPort() {
        return this.assignedPort;
    }
    getExitCode() {
        return this.exitCode;
    }
    getLastAction() {
        return this.lastAction;
    }
    getUptime() {
        if (!this.startTime || this.state !== 'running')
            return 0;
        return Math.floor((Date.now() - this.startTime) / 1000);
    }
    /**
     * Pre-flights the target port: terminates verified stale same-product servers.
     */
    async preflightPort() {
        this.lastAction = `Pre-flighting port ${this.assignedPort}`;
        this.logger.info(`[BOOT] Pre-flighting port ${this.assignedPort}...`);
        const isBusy = await this.isPortInUse(this.assignedPort);
        if (!isBusy) {
            this.logger.info(`[BOOT] Port ${this.assignedPort} is free.`);
            return;
        }
        this.logger.warn(`[BOOT] Port ${this.assignedPort} is occupied. Probing identity...`);
        const probe = await this.probeStatus(this.assignedPort, 2000);
        if (probe && probe.ok && probe.data) {
            if (probe.data.productId === this.config.productId && probe.data.pid) {
                this.logger.warn(`[BOOT] Port held by verified stale ${this.config.productId} server (pid ${probe.data.pid}) — terminating...`);
                this.terminatePid(probe.data.pid);
                await this.waitForPortFree(this.assignedPort, 5000);
                return;
            }
            if (probe.data.productId && probe.data.productId !== this.config.productId) {
                this.logger.error(`[BOOT] Port ${this.assignedPort} is occupied by another product (${probe.data.productId})!`);
                // Adjust to alternate safe port to allow simultaneous execution
                this.assignedPort = this.assignedPort + 10;
                this.logger.info(`[BOOT] Shifting ${this.config.productId} to alternate port ${this.assignedPort}`);
                return;
            }
        }
        this.logger.warn(`[BOOT] Port ${this.assignedPort} occupied by foreign or non-responsive process. Waiting briefly...`);
    }
    /**
     * Spawns the local Next.js standalone server and waits for health verification.
     */
    async start() {
        await this.preflightPort();
        this.state = 'starting';
        this.lastAction = `Spawning server on port ${this.assignedPort}`;
        this.logger.info(`[BOOT] Spawning local server: ${this.paths.serverScript}`);
        this.logger.info(`[BOOT] Node executable: ${this.paths.nodeExecutable}`);
        this.logger.info(`[BOOT] Server working directory: ${this.paths.serverDir}`);
        this.logger.info(`[BOOT] Database path: ${this.paths.databasePath}`);
        const env = {
            ...process.env,
            PORT: String(this.assignedPort),
            HOSTNAME: '127.0.0.1',
            NODE_ENV: 'production',
            DATABASE_URL: `file:${this.paths.databasePath}`,
            ELECTRON_RUN_AS_NODE: '1',
            NODE_SKIP_PLATFORM_CHECK: '1',
        };
        let childExitedPrematurely = false;
        try {
            this.child = (0, child_process_1.spawn)(this.paths.nodeExecutable, [this.paths.serverScript], {
                cwd: this.paths.serverDir,
                env,
                stdio: ['ignore', 'pipe', 'pipe'],
                windowsHide: true,
            });
        }
        catch (err) {
            this.state = 'error';
            this.lastAction = `Failed to spawn: ${String(err)}`;
            this.logger.error(`[BOOT] Failed to spawn child process:`, err);
            return false;
        }
        this.pid = this.child.pid ?? null;
        this.logger.info(`[BOOT] Server spawned with PID ${this.pid}`);
        this.child.stdout?.on('data', (chunk) => {
            const line = chunk.toString('utf8').trim();
            if (line)
                this.logger.info(`[server] ${line}`);
        });
        this.child.stderr?.on('data', (chunk) => {
            const line = chunk.toString('utf8').trim();
            if (line)
                this.logger.pushStderr(line);
        });
        this.child.on('error', (err) => {
            this.logger.error(`[BOOT] Child process error:`, err);
            this.state = 'error';
            this.lastAction = `Process error: ${err.message}`;
        });
        this.child.on('exit', (code, signal) => {
            childExitedPrematurely = true;
            this.exitCode = code !== null ? `Code ${code}` : `Signal ${signal}`;
            this.logger.warn(`[BOOT] Server process exited (${this.exitCode})`);
            this.state = 'exited';
            this.lastAction = `Process terminated (${this.exitCode})`;
        });
        // Poll health endpoint with fail-fast check
        const isReady = await this.pollHealth(() => childExitedPrematurely);
        if (isReady) {
            this.state = 'running';
            this.startTime = Date.now();
            this.lastAction = `Server running and verified healthy on port ${this.assignedPort}`;
            this.logger.info(`[BOOT] ✓ ${this.lastAction}`);
            return true;
        }
        this.state = 'error';
        this.lastAction = `Server failed readiness gate on port ${this.assignedPort}`;
        this.logger.error(`[BOOT] ✗ ${this.lastAction}`);
        this.stop();
        return false;
    }
    /**
     * Health polling against /api/library/system/status.
     * Fails fast if the child process dies during boot.
     * Uses a resilient 120s readiness gate for clean cold starts (antivirus scan safe).
     */
    async pollHealth(hasExited, timeoutMs = 120000) {
        const startTime = Date.now();
        const url = `http://127.0.0.1:${this.assignedPort}/api/library/system/status`;
        this.logger.info(`[BOOT] Polling health check at ${url}...`);
        while (Date.now() - startTime < timeoutMs) {
            if (hasExited()) {
                this.logger.error('[BOOT] Child process exited before becoming ready — failing fast');
                return false;
            }
            const res = await this.probeStatus(this.assignedPort, 1500);
            if (res && res.ok && res.data) {
                if (res.data.productId === this.config.productId) {
                    return true;
                }
                else {
                    this.logger.warn(`[BOOT] Health answered 200 but productId mismatch: expected ${this.config.productId}, got ${res.data.productId}`);
                }
            }
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
        return false;
    }
    /**
     * Sends a lightweight HTTP GET probe to the status endpoint.
     */
    probeStatus(port, timeoutMs) {
        return new Promise((resolve) => {
            const req = http.get({
                hostname: '127.0.0.1',
                port,
                path: '/api/library/system/status',
                timeout: timeoutMs,
            }, (res) => {
                let data = '';
                res.setEncoding('utf8');
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            resolve(JSON.parse(data));
                        }
                        catch {
                            resolve(null);
                        }
                    }
                    else {
                        resolve(null);
                    }
                });
            });
            req.on('timeout', () => {
                req.destroy();
                resolve(null);
            });
            req.on('error', () => {
                resolve(null);
            });
        });
    }
    isPortInUse(port) {
        return new Promise((resolve) => {
            const tester = net
                .createServer()
                .once('error', (err) => {
                if (err.code === 'EADDRINUSE')
                    resolve(true);
                else
                    resolve(false);
            })
                .once('listening', () => {
                tester.once('close', () => resolve(false)).close();
            })
                .listen(port, '127.0.0.1');
        });
    }
    async waitForPortFree(port, timeoutMs) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            if (!(await this.isPortInUse(port)))
                return true;
            await new Promise((r) => setTimeout(r, 200));
        }
        return false;
    }
    /**
     * Terminates a single PID forcefully.
     */
    terminatePid(pid) {
        try {
            if (process.platform === 'win32') {
                (0, child_process_1.execSync)(`taskkill /F /PID ${pid} /T`, { stdio: 'ignore' });
            }
            else {
                process.kill(pid, 'SIGKILL');
            }
        }
        catch { }
    }
    /**
     * Stops the server child process and kills the entire process tree.
     */
    stop() {
        if (!this.child && !this.pid)
            return;
        this.logger.info(`[BOOT] Stopping server process tree (PID: ${this.pid})...`);
        if (this.pid) {
            this.terminatePid(this.pid);
        }
        if (this.child) {
            try {
                this.child.kill('SIGTERM');
            }
            catch { }
            this.child = null;
        }
        this.pid = null;
        this.state = 'not_started';
    }
}
exports.ServerManager = ServerManager;
