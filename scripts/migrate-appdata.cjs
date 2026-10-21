const fs = require('fs');
const path = require('path');
const p = process.env.LOCALAPPDATA + '\\com.library.supermarket\\custom.db';

if (fs.existsSync(p)) {
  process.env.DATABASE_URL = 'file:' + p;
  const serverDb = require('../server/db');
  serverDb.ensureBootstrap();
  const db = serverDb.openDb();
  const v = db.pragma('user_version', { simple: true });
  console.log('✓ AppData custom.db migrated via DATABASE_URL to user_version:', v);
  db.close();
} else {
  console.log('AppData custom.db not found');
}
