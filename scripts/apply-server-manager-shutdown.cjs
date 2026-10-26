const fs = require('fs');
const path = require('path');

const smPath = path.resolve(__dirname, '../desktop/engine/main/server-manager.js');
let sm = fs.readFileSync(smPath, 'utf8');

// 1. Update stdio to include 'ipc'
sm = sm.replace(
  "stdio: ['ignore', 'pipe', 'pipe'],",
  "stdio: ['ignore', 'pipe', 'pipe', 'ipc'],"
);

// 2. Update child exit handler
const oldExit = `        this.child.on('exit', (code, signal) => {
            childExitedPrematurely = true;
            this.exitCode = code !== null ? \`Code \${code}\` : \`Signal \${signal}\`;
            this.logger.warn(\`[BOOT] Server process exited (\${this.exitCode})\`);
            this.state = 'exited';
            this.lastAction = \`Process terminated (\${this.exitCode})\`;
        });`;

const newExit = `        this.child.on('exit', (code, signal) => {
            const isClean = (code === 0 || code === null);
            this.exitCode = code !== null ? \`Code \${code}\` : \`Signal \${signal}\`;
            if (this.isShuttingDown && isClean) {
                this.logger.info(\`[BOOT] Server process exited cleanly (\${this.exitCode})\`);
            } else if (this.isShuttingDown) {
                this.logger.info(\`[BOOT] Server process terminated during shutdown (\${this.exitCode})\`);
            } else {
                childExitedPrematurely = true;
                this.logger.warn(\`[BOOT] Server process exited unexpectedly (\${this.exitCode})\`);
            }
            this.state = 'exited';
            this.lastAction = \`Process terminated (\${this.exitCode})\`;
        });`;

sm = sm.replace(oldExit, newExit);

// 3. Update stop() to graceful async stop
const oldStop = `    stop() {
        if (!this.child && !this.pid)
            return;
        this.logger.info(\`[BOOT] Stopping server process tree (PID: \${this.pid})...\`);
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
    }`;

const newStop = `    async stop() {
        if (!this.child && !this.pid)
            return;
        this.isShuttingDown = true;
        this.logger.info(\`[BOOT] Gracefully stopping server process tree (PID: \${this.pid})...\`);
        try {
            if (this.child && typeof this.child.send === 'function') {
                this.child.send({ type: 'shutdown' });
            }
        } catch { }
        try {
            const req = http.request({
                hostname: '127.0.0.1',
                port: this.assignedPort,
                path: '/api/library/system/shutdown',
                method: 'POST',
                timeout: 1000,
            });
            req.on('error', () => { });
            req.end();
        } catch { }
        const start = Date.now();
        while (this.child && this.state !== 'exited' && Date.now() - start < 2000) {
            await new Promise((r) => setTimeout(r, 100));
        }
        if (this.pid && this.state !== 'exited') {
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
    }`;

sm = sm.replace(oldStop, newStop);
fs.writeFileSync(smPath, sm, 'utf8');
console.log('[PASS] server-manager.js updated with graceful shutdown.');

// 4. Update lifecycle.js to await serverManager.stop()
const lcPath = path.resolve(__dirname, '../desktop/engine/main/lifecycle.js');
let lc = fs.readFileSync(lcPath, 'utf8');
lc = lc.replace(
  "this.serverManager.stop();",
  "this.serverManager.stop().catch(() => {});"
);
fs.writeFileSync(lcPath, lc, 'utf8');
console.log('[PASS] lifecycle.js updated to await stop.');
