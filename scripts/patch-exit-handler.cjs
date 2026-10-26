const fs = require('fs');
const path = require('path');

const smPath = path.resolve(__dirname, '../desktop/engine/main/server-manager.js');
let sm = fs.readFileSync(smPath, 'utf8');

const targetStr = `        this.child.on('exit', (code, signal) => {
            childExitedPrematurely = true;
            this.exitCode = code !== null ? \`Code \${code}\` : \`Signal \${signal}\`;
            this.logger.warn(\`[BOOT] Server process exited (\${this.exitCode})\`);
            this.state = 'exited';
            this.lastAction = \`Process terminated (\${this.exitCode})\`;
        });`;

const replacementStr = `        this.child.on('exit', (code, signal) => {
            const isClean = (code === 0 || code === null);
            this.exitCode = code !== null ? \`Code \${code}\` : \`Signal \${signal}\`;
            if (isClean || this.isShuttingDown) {
                this.logger.info(\`[BOOT] Server process exited cleanly (\${this.exitCode})\`);
            } else {
                childExitedPrematurely = true;
                this.logger.warn(\`[BOOT] Server process exited unexpectedly (\${this.exitCode})\`);
            }
            this.state = 'exited';
            this.lastAction = \`Process terminated (\${this.exitCode})\`;
        });`;

if (sm.includes(targetStr)) {
  sm = sm.replace(targetStr, replacementStr);
  fs.writeFileSync(smPath, sm, 'utf8');
  console.log('[PASS] Replaced child.on exit handler (LF).');
} else if (sm.includes(targetStr.replace(/\n/g, '\r\n'))) {
  sm = sm.replace(targetStr.replace(/\n/g, '\r\n'), replacementStr.replace(/\n/g, '\r\n'));
  fs.writeFileSync(smPath, sm, 'utf8');
  console.log('[PASS] Replaced child.on exit handler (CRLF).');
} else {
  console.log('[WARN] Could not find targetStr');
}
