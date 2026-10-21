const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../desktop/engine/main/window-manager.js');
let code = fs.readFileSync(targetPath, 'utf8').replace(/\r\n/g, '\n');

const searchBlock = `        const port = this.serverManager.getPort();
        const targetUrl = \`http://127.0.0.1:\${port}/\`;
        this.logger.info(\`[WINDOW] Loading local application at \${targetUrl}\`);
        try {
            await this.mainWindow.loadURL(targetUrl);`;

const replaceBlock = `        const port = this.serverManager.getPort();
        const targetUrl = \`http://127.0.0.1:\${port}/\`;
        const allowedOrigin = \`http://127.0.0.1:\${port}\`;
        this.logger.info(\`[WINDOW] Loading local application at \${targetUrl}\`);
        try {
            // Invalidate prior sessions on launch: clear cookies and session storage for loopback origin
            try {
                await this.mainWindow.webContents.session.clearStorageData({
                    origin: allowedOrigin,
                    storages: ['cookies', 'localstorage', 'sessionstorage'],
                });
                this.logger.info(\`[AUTH] Cleared prior session storage data for \${allowedOrigin}\`);
            } catch (clearErr) {
                this.logger.warn(\`[AUTH] Failed to clear session data on launch: \${clearErr && clearErr.message}\`);
            }
            await this.mainWindow.loadURL(targetUrl);`;

if (code.includes(searchBlock)) {
  code = code.replace(searchBlock, replaceBlock);
  fs.writeFileSync(targetPath, code.replace(/\n/g, '\r\n'), 'utf8');
  console.log('✓ window-manager.js patched successfully');
} else {
  console.error('Search block not found in window-manager.js');
  process.exit(1);
}
