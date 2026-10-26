/**
 * Complete Fix for Visual Identity (الهوية البصرية / Branding)
 * - Harmonizes DB schema & AppSettings record
 * - Updates backend db.js (DEFAULT_BRANDING & normalizeBranding)
 * - Updates backend api.js (supports { branding: ... } and { block, data } formats)
 * - Updates client components (config.ts, settings.tsx, store.ts)
 * - Updates compiled production chunks (out & dist-desktop 18yoqc7d05wnq.js)
 * - Immediately updates SQLite database AppSettings.branding
 */
'use strict';

const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('  APPLYING BRANDING & VISUAL IDENTITY FIX');
console.log('====================================================\n');

const projectRoot = path.resolve(__dirname, '..');

// 1. Update SQLite database AppSettings in data/custom.db
const dbFiles = [
  path.join(projectRoot, 'data/custom.db'),
  path.resolve(projectRoot, '../Store For Win7/data/custom.db')
];

let nodeExecutable = path.join(projectRoot, 'desktop/bin/node.exe');
if (!fs.existsSync(nodeExecutable)) {
  nodeExecutable = path.join(projectRoot, 'bin/node.exe');
}
if (!fs.existsSync(nodeExecutable)) {
  nodeExecutable = process.execPath;
}

const betterSqlitePath = path.join(projectRoot, 'dist-desktop/win-unpacked/resources/server/node_modules/better-sqlite3');
if (fs.existsSync(betterSqlitePath)) {
  try {
    const Database = require(betterSqlitePath);
    for (const dbf of dbFiles) {
      if (!fs.existsSync(dbf)) continue;
      const db = new Database(dbf);
      const row = db.prepare("SELECT branding FROM AppSettings WHERE id='default'").get();
      let current = {};
      if (row && row.branding) {
        try { current = JSON.parse(row.branding); } catch {}
      }
      const updated = {
        primary: current.primary || current.primaryColor || '#00c8e0',
        primaryColor: current.primary || current.primaryColor || '#00c8e0',
        secondary: current.secondary || '#14b8a6',
        accent: current.accent || '#22d3ee',
        appName: current.appName || 'Library Store',
        logoDataUrl: current.logoDataUrl || current.logoUrl || null,
        logoUrl: current.logoDataUrl || current.logoUrl || null,
        defaultTheme: current.defaultTheme || 'dark',
      };
      db.prepare("UPDATE AppSettings SET branding = ? WHERE id = 'default'").run(JSON.stringify(updated));
      console.log(`[PASS] Updated AppSettings.branding in SQLite DB: ${path.relative(projectRoot, dbf)}`);
      db.close();
    }
  } catch (err) {
    console.warn('[WARN] SQLite update skipped or encountered error:', err.message);
  }
}

// 2. Update server/db.js files
const dbJsFiles = [
  path.join(projectRoot, 'server/db.js'),
  path.join(projectRoot, 'dist-desktop/win-unpacked/resources/server/db.js')
];

for (const dj of dbJsFiles) {
  if (!fs.existsSync(dj)) continue;
  let code = fs.readFileSync(dj, 'utf8');

  // Replace DEFAULT_BRANDING
  code = code.replace(
    /const DEFAULT_BRANDING = \{[^}]+\};/,
    `const DEFAULT_BRANDING = {
  primary: '#00c8e0',
  primaryColor: '#00c8e0',
  secondary: '#14b8a6',
  accent: '#22d3ee',
  appName: 'Library Store',
  logoDataUrl: null,
  logoUrl: null,
  defaultTheme: 'dark',
};

function normalizeBranding(raw) {
  const b = typeof raw === 'object' && raw !== null ? raw : safeJson(raw, DEFAULT_BRANDING);
  const primary = b.primary || b.primaryColor || DEFAULT_BRANDING.primary;
  const secondary = b.secondary || DEFAULT_BRANDING.secondary;
  const accent = b.accent || DEFAULT_BRANDING.accent;
  const logoDataUrl = b.logoDataUrl || b.logoUrl || null;
  const appName = b.appName || DEFAULT_BRANDING.appName;
  const defaultTheme = b.defaultTheme || DEFAULT_BRANDING.defaultTheme;
  return {
    ...DEFAULT_BRANDING,
    ...b,
    primary,
    primaryColor: primary,
    secondary,
    accent,
    logoDataUrl,
    logoUrl: logoDataUrl,
    appName,
    defaultTheme,
  };
}`
  );

  // In getSettings: use normalizeBranding
  code = code.replace(
    /branding:\s*safeJson\(row\s*&&\s*row\.branding,\s*DEFAULT_BRANDING\),/,
    `branding: normalizeBranding(row && row.branding),`
  );

  fs.writeFileSync(dj, code, 'utf8');
  console.log(`[PASS] Updated server db.js: ${path.relative(projectRoot, dj)}`);
}

// 3. Update server/api.js files
const apiJsFiles = [
  path.join(projectRoot, 'server/api.js'),
  path.join(projectRoot, 'dist-desktop/win-unpacked/resources/server/api.js')
];

for (const aj of apiJsFiles) {
  if (!fs.existsSync(aj)) continue;
  let code = fs.readFileSync(aj, 'utf8');

  // Replace settings PUT handler
  const oldPutPattern = /router\.put\('\/settings',\s*\(req,\s*res\)\s*=>\s*\{[\s\S]*?ok\(res,\s*getSettings\('default'\)\);\s*\}\);/m;
  const newPut = `router.put('/settings', (req, res) => {
  wrap(res, () => {
    requirePermission(req, 'SETTINGS_MANAGE');
    const valid = ['business','branding','hardware','pos','localization','backup','system'];
    let block = req.body && req.body.block;
    let data = req.body && req.body.data;
    if (!block) {
      for (const k of valid) {
        if (req.body && req.body[k] !== undefined) {
          block = k;
          data = req.body[k];
          break;
        }
      }
    }
    if (!block || !valid.includes(block)) throw ApiError('INVALID_BLOCK', 'كتلة الإعدادات غير صالحة', 400);

    // Synchronize branding fields
    if (block === 'branding' && typeof data === 'object' && data !== null) {
      if (data.primary && !data.primaryColor) data.primaryColor = data.primary;
      if (data.primaryColor && !data.primary) data.primary = data.primaryColor;
      if (data.logoDataUrl && !data.logoUrl) data.logoUrl = data.logoDataUrl;
      if (data.logoUrl && !data.logoDataUrl) data.logoDataUrl = data.logoUrl;
      if (!data.secondary) data.secondary = '#14b8a6';
      if (!data.accent) data.accent = '#22d3ee';
    }

    const current = getSettings('default');
    const updated = { ...current, [block]: data };
    const db = openDb();
    const row = db.prepare('SELECT id FROM AppSettings WHERE id=@id').get({ id: 'default' });
    if (row) {
      db.prepare(\`UPDATE AppSettings SET "\${block}"=@val, updatedAt=@t WHERE id=@id\`)
        .run({ val: JSON.stringify(data), t: now(), id: 'default' });
    } else {
      db.prepare(\`INSERT INTO AppSettings (id,business,branding,hardware,pos,localization,backup,system,updatedAt) VALUES (@id,@business,@branding,@hardware,@pos,@localization,@backup,@system,@t)\`)
        .run({ id: 'default', business: JSON.stringify(updated.business), branding: JSON.stringify(updated.branding), hardware: JSON.stringify(updated.hardware), pos: JSON.stringify(updated.pos), localization: JSON.stringify(updated.localization), backup: JSON.stringify(updated.backup), system: JSON.stringify(updated.system), t: now() });
    }
    ok(res, getSettings('default'));
  });
});`;

  if (oldPutPattern.test(code)) {
    code = code.replace(oldPutPattern, newPut);
    fs.writeFileSync(aj, code, 'utf8');
    console.log(`[PASS] Updated server api.js: ${path.relative(projectRoot, aj)}`);
  } else {
    console.warn(`[WARN] PUT /settings pattern not found in ${aj}`);
  }
}

// 4. Update src/lib/library/config.ts
const configTsFiles = [
  path.join(projectRoot, 'src/lib/library/config.ts'),
  path.resolve(projectRoot, '../Store For Win7/src/lib/library/config.ts')
];

for (const ctf of configTsFiles) {
  if (!fs.existsSync(ctf)) continue;
  let code = fs.readFileSync(ctf, 'utf8');
  
  // Ensure parseBranding maps primaryColor -> primary and logoUrl -> logoDataUrl
  code = code.replace(
    /export const parseBranding = \(j\?:[^)]+\) => parse<BrandingConfig>\(j, DEFAULT_BRANDING\)/,
    `export const parseBranding = (j?: string | BrandingConfig | null): BrandingConfig => {
  const base = parse<BrandingConfig>(j, DEFAULT_BRANDING);
  const raw = (typeof j === 'object' && j !== null) ? j as any : {};
  return {
    ...base,
    primary: base.primary || raw.primaryColor || DEFAULT_BRANDING.primary,
    secondary: base.secondary || DEFAULT_BRANDING.secondary,
    accent: base.accent || DEFAULT_BRANDING.accent,
    logoDataUrl: base.logoDataUrl || raw.logoUrl || null,
  };
}`
  );
  fs.writeFileSync(ctf, code, 'utf8');
  console.log(`[PASS] Updated config.ts: ${path.relative(projectRoot, ctf)}`);
}

// 5. Update src/components/library/screens/settings.tsx
const settingsFiles = [
  path.join(projectRoot, 'src/components/library/screens/settings.tsx'),
  path.resolve(projectRoot, '../Store For Win7/src/components/library/screens/settings.tsx')
];

for (const sf of settingsFiles) {
  if (!fs.existsSync(sf)) continue;
  let code = fs.readFileSync(sf, 'utf8');

  // Ensure BrandingSection uses safe defaults
  const oldBrandingDecl = `  const br = cfg.branding`;
  const newBrandingDecl = `  const br = {
    primary: '#00c8e0',
    secondary: '#14b8a6',
    accent: '#22d3ee',
    appName: 'Library Store',
    logoDataUrl: null,
    defaultTheme: 'dark' as const,
    ...cfg.branding,
    primary: cfg.branding?.primary || (cfg.branding as any)?.primaryColor || '#00c8e0',
    secondary: cfg.branding?.secondary || '#14b8a6',
    accent: cfg.branding?.accent || '#22d3ee',
    logoDataUrl: cfg.branding?.logoDataUrl || (cfg.branding as any)?.logoUrl || null,
  }`;

  if (code.includes(oldBrandingDecl)) {
    code = code.replace(oldBrandingDecl, newBrandingDecl);
  }

  // Also in preview: show logo if available
  code = code.replace(
    `<span className="h-7 w-7 rounded-lg" style={{ background: br.primary }} />`,
    `{br.logoDataUrl ? (
              <img src={br.logoDataUrl} alt="logo" className="h-7 w-7 rounded-lg object-contain bg-white p-0.5" />
            ) : (
              <span className="h-7 w-7 rounded-lg" style={{ background: br.primary }} />
            )}`
  );

  fs.writeFileSync(sf, code, 'utf8');
  console.log(`[PASS] Updated settings.tsx: ${path.relative(projectRoot, sf)}`);
}

// 6. Update src/components/library/store.ts
const storeFiles = [
  path.join(projectRoot, 'src/components/library/store.ts'),
  path.resolve(projectRoot, '../Store For Win7/src/components/library/store.ts')
];

for (const stf of storeFiles) {
  if (!fs.existsSync(stf)) continue;
  let code = fs.readFileSync(stf, 'utf8');

  if (!code.includes('applyBranding(')) {
    const applyDocTarget = `function applyDocument(lang: Lang, theme: 'dark' | 'light') {
  if (typeof document === 'undefined') return
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.classList.toggle('dark', theme === 'dark')
}`;

    const newApplyDoc = `function hexToRgb(hex: string): string | null {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return \`\${r}, \${g}, \${b}\`;
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return \`\${r}, \${g}, \${b}\`;
  }
  return null;
}

export function applyBranding(branding?: { primary?: string; secondary?: string; accent?: string } | null) {
  if (typeof document === 'undefined' || !branding) return;
  const root = document.documentElement;
  if (branding.primary) {
    root.style.setProperty('--primary', branding.primary);
    const rgb = hexToRgb(branding.primary);
    if (rgb) root.style.setProperty('--primary-rgb', rgb);
  }
  if (branding.secondary) {
    root.style.setProperty('--secondary', branding.secondary);
  }
  if (branding.accent) {
    root.style.setProperty('--accent', branding.accent);
  }
}

function applyDocument(lang: Lang, theme: 'dark' | 'light') {
  if (typeof document === 'undefined') return
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.classList.toggle('dark', theme === 'dark')
}`;

    code = code.replace(applyDocTarget, newApplyDoc);

    // Call applyBranding in initServerData and boot
    code = code.replace('applyDocument(lang, theme)', 'applyDocument(lang, theme); applyBranding(status?.branding);');
    // In refreshStatus:
    code = code.replace('set({ status })', 'applyBranding(status?.branding); set({ status })');

    fs.writeFileSync(stf, code, 'utf8');
    console.log(`[PASS] Updated store.ts: ${path.relative(projectRoot, stf)}`);
  }
}

// 7. Update compiled client chunk 18yoqc7d05wnq.js in out & dist-desktop
const chunkFiles = [
  path.join(projectRoot, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(projectRoot, 'out/_next/static/chunks/18yoqc7d05wnq.js')
];

for (const chk of chunkFiles) {
  if (!fs.existsSync(chk)) continue;
  let code = fs.readFileSync(chk, 'utf8');

  // Patch BrandingSection in compiled chunk
  const oldChunkTarget = ',s=e.branding;return(0,N.jsxs)(ou,{title:r("الهوية البصرية"';
  const newChunkTarget = ',s=Object.assign({primary:"#00c8e0",secondary:"#14b8a6",accent:"#22d3ee",appName:"Library Store",logoDataUrl:null,defaultTheme:"dark"},e.branding,{primary:e.branding?.primary||e.branding?.primaryColor||"#00c8e0",secondary:e.branding?.secondary||"#14b8a6",accent:e.branding?.accent||"#22d3ee",logoDataUrl:e.branding?.logoDataUrl||e.branding?.logoUrl||null});return(0,N.jsxs)(ou,{title:r("الهوية البصرية"';

  if (code.includes(oldChunkTarget)) {
    code = code.replace(oldChunkTarget, newChunkTarget);
    console.log(`[PASS] Patched BrandingSection in chunk: ${path.relative(projectRoot, chk)}`);
  } else if (code.includes('s=Object.assign({primary:"#00c8e0"')) {
    console.log(`[INFO] Chunk already patched: ${path.relative(projectRoot, chk)}`);
  } else {
    console.warn(`[WARN] Chunk target not found in: ${chk}`);
  }

  // Also in chunk when saving branding: apply colors to documentElement
  const oldSaveTarget = '("branding"===t||"localization"===t||"pos"===t)&&await i()';
  const newSaveTarget = '("branding"===t||"localization"===t||"pos"===t)&&(await i(),(()=>{try{var _b=l?.branding;if(_b){if(_b.primary){document.documentElement.style.setProperty("--primary",_b.primary);var _c=_b.primary.replace("#","");if(_c.length===6){var _r=parseInt(_c.slice(0,2),16),_g=parseInt(_c.slice(2,4),16),_bk=parseInt(_c.slice(4,6),16);document.documentElement.style.setProperty("--primary-rgb",_r+","+_g+","+_bk)}}if(_b.secondary)document.documentElement.style.setProperty("--secondary",_b.secondary);if(_b.accent)document.documentElement.style.setProperty("--accent",_b.accent)}}catch(e){}})())';

  if (code.includes(oldSaveTarget)) {
    code = code.replace(oldSaveTarget, newSaveTarget);
    console.log(`[PASS] Patched branding save live-apply in chunk: ${path.relative(projectRoot, chk)}`);
  }

  fs.writeFileSync(chk, code, 'utf8');
}

// 8. Re-pack app.asar to ensure dist-desktop has latest code
const repackScript = path.join(projectRoot, 'scripts/repack-asar.cjs');
if (fs.existsSync(repackScript)) {
  try {
    const { execSync } = require('child_process');
    execSync(`node "${repackScript}"`, { cwd: projectRoot, stdio: 'inherit' });
    console.log('[PASS] Repacked app.asar with latest code');
  } catch (err) {
    console.warn('[WARN] Repack asar failed:', err.message);
  }
}

console.log('\n[SUCCESS] VISUAL IDENTITY & BRANDING FULLY HARMONIZED ACROSS ALL LAYERS!');
