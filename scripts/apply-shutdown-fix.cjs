const fs = require('fs');
const path = require('path');

const p = path.resolve(__dirname, '../server/index.js');
let c = fs.readFileSync(p, 'utf8');

const hook = "process.on('SIGTERM', () => gracefulShutdown(0));";
const codeToAdd = `app.post('/api/library/system/shutdown', (req, res) => {
  res.json({ ok: true, message: 'Server shutting down cleanly' });
  setTimeout(() => gracefulShutdown(0), 100);
});

process.on('message', (msg) => {
  if (msg === 'shutdown' || (msg && msg.type === 'shutdown')) {
    gracefulShutdown(0);
  }
});

process.on('SIGTERM', () => gracefulShutdown(0));`;

if (c.includes(hook)) {
  c = c.replace(hook, codeToAdd);
  fs.writeFileSync(p, c, 'utf8');
  console.log('[PASS] Added shutdown triggers to server/index.js');
} else {
  console.log('[WARN] Hook already replaced or not found');
}
