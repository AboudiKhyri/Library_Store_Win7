const fs = require('fs');
const path = require('path');

const wmPath = path.resolve(__dirname, '../desktop/engine/main/window-manager.js');
let wm = fs.readFileSync(wmPath, 'utf8');

const oldMsg = "this.mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {\r\n            this.logger.info(`[RENDERER] [lvl ${level}] ${message} (${sourceId}:${line})`);\r\n        });";
const oldMsgLF = "this.mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {\n            this.logger.info(`[RENDERER] [lvl ${level}] ${message} (${sourceId}:${line})`);\n        });";

const newMsg = `this.mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
            if (level >= 3 || message.includes('FRONTEND-ERROR') || message.includes('GLOBAL-ERROR')) {
                this.logger.error(\`[RENDERER] \${message} (\${sourceId}:\${line})\`);
            } else if (level === 2) {
                this.logger.warn(\`[RENDERER] \${message} (\${sourceId}:\${line})\`);
            } else {
                this.logger.info(\`[RENDERER] [lvl \${level}] \${message} (\${sourceId}:\${line})\`);
            }
        });`;

if (wm.includes(oldMsg)) {
  wm = wm.replace(oldMsg, newMsg.replace(/\n/g, '\r\n'));
  fs.writeFileSync(wmPath, wm, 'utf8');
  console.log('[PASS] window-manager console logging updated (CRLF).');
} else if (wm.includes(oldMsgLF)) {
  wm = wm.replace(oldMsgLF, newMsg);
  fs.writeFileSync(wmPath, wm, 'utf8');
  console.log('[PASS] window-manager console logging updated (LF).');
} else {
  console.log('[WARN] Target console-message block not found.');
}
