/**
 * scripts/sync-theme.cjs
 * Reads current AppSettings from data/custom.db and writes data/theme.json
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dbPath = path.join(root, 'data/custom.db');

const Database = require(path.join(root, 'server/node_modules/better-sqlite3'));
const db = new Database(dbPath, { readonly: true });
const row = db.prepare("SELECT business, branding FROM AppSettings WHERE id='default'").get();
db.close();

if (!row) {
  console.error('[FATAL] AppSettings row not found in custom.db');
  process.exit(1);
}

const business = JSON.parse(row.business || '{}');
const branding = JSON.parse(row.branding || '{}');

const themeData = {
  theme: branding.defaultTheme === 'light' ? 'light' : 'dark',
  primary: branding.primary || branding.primaryColor || '#00c8e0',
  appName: branding.appName || 'Library Store',
  displayName: business.displayName || business.businessName || 'Library Store',
  businessName: business.businessName || '',
  updatedAt: new Date().toISOString()
};

// Write to data/theme.json
const localDataDir = path.join(root, 'data');
if (!fs.existsSync(localDataDir)) fs.mkdirSync(localDataDir, { recursive: true });
fs.writeFileSync(path.join(localDataDir, 'theme.json'), JSON.stringify(themeData, null, 2), 'utf8');
console.log('✓ Wrote data/theme.json:', themeData);

// Also sync to LOCALAPPDATA if exists
const localAppData = process.env.LOCALAPPDATA;
if (localAppData) {
  const appDataDir = path.join(localAppData, 'com.library.supermarket');
  if (fs.existsSync(appDataDir)) {
    fs.writeFileSync(path.join(appDataDir, 'theme.json'), JSON.stringify(themeData, null, 2), 'utf8');
    console.log('✓ Wrote LOCALAPPDATA theme.json');
  }
}
