'use strict';
/**
 * LIBRARY STORE — Windows 7 Edition
 * Express.js main server — replaces Next.js standalone server
 * Compatible with Node.js 16.x
 */

const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const cookieParser = require('cookie-parser');

const apiRouter = require('./api');

const PORT = parseInt(process.env.PORT || '3210', 10);
const HOST = process.env.HOSTNAME || '127.0.0.1';
const PRODUCT_ID = 'LIBRARY_STORE';

// ─── Static files directory ────────────────────────────────────────────────────
// In packaged app: resources/client/ (Next.js static export)
// In dev: ../.next/out/ or .next/out/
function findClientDir() {
  const candidates = [
    path.join(__dirname, '..', 'client'),
    path.join(__dirname, 'client'),
    path.join(__dirname, '..', 'out'),
    path.join(__dirname, 'out'),
    path.join(process.cwd(), 'client'),
    path.join(process.cwd(), '..', 'client'),
    path.join(process.cwd(), 'out'),
  ];
  // If running packaged (resourcesPath env set by Electron)
  if (process.env.ELECTRON_RESOURCES_PATH) {
    candidates.unshift(path.join(process.env.ELECTRON_RESOURCES_PATH, 'client'));
  }
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.existsSync(path.join(c, 'index.html'))) return c;
  }
  return null;
}

const app = express();

// ─── Security & Headers ────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src 'self' http://127.0.0.1:* http://localhost:*; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob: data:;"
  );
  next();
});

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── CORS for local development ────────────────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || origin === 'null') {
    res.set('Access-Control-Allow-Origin', origin || '*');
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,Cookie');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// ─── API routes ────────────────────────────────────────────────────────────────
app.use('/api/library', apiRouter);

// ─── Static Next.js export ────────────────────────────────────────────────────
const clientDir = findClientDir();
if (clientDir) {
  console.log('[BOOT] Serving static client from:', clientDir);
  app.use(express.static(clientDir, {
    index: false,  // handle manually for SPA fallback
    maxAge: '1d',
    immutable: true,
    // Next.js _next/static files are content-hashed and can be cached aggressively
  }));

  // SPA fallback: serve index.html for all non-API, non-static routes
  app.get('*', (req, res) => {
    // Try to find the page's specific HTML file (Next.js static export generates /page/index.html)
    const candidates = [
      path.join(clientDir, req.path, 'index.html'),
      path.join(clientDir, req.path.replace(/\/$/, '') + '.html'),
      path.join(clientDir, 'index.html'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return res.sendFile(candidate);
      }
    }
    // Final fallback to root index.html
    res.sendFile(path.join(clientDir, 'index.html'));
  });
} else {
  console.warn('[BOOT] No client directory found — API-only mode');
  app.get('/', (req, res) => {
    res.json({ ok: true, message: 'Library Store API Server', version: '1.0.0' });
  });
}

// ─── Start server ──────────────────────────────────────────────────────────────
// ─── Startup Session Invalidation ─────────────────────────────────────────────
try {
  const { getSettings, openDb } = require('./db');
  const settings = getSettings('default');
  if (settings.system?.requireLoginOnLaunch !== false) {
    const db = openDb();
    const res = db.prepare('DELETE FROM Session').run();
    console.log(`[BOOT] Invalidate prior sessions: purged ${res.changes} session(s) from database`);
  }
} catch (e) {
  console.warn('[BOOT] Error clearing prior sessions on boot:', e && e.message);
}

const server = http.createServer(app);
server.listen(PORT, HOST, () => {
  console.log(`[BOOT] Library Store server running at http://${HOST}:${PORT}`);
  console.log(`[BOOT] Product ID: ${PRODUCT_ID}`);
  console.log(`[BOOT] Node.js: ${process.version}`);
  console.log(`[BOOT] PID: ${process.pid}`);
});

server.on('error', (err) => {
  console.error('[BOOT] Server error:', err.message);
  process.exit(1);
});

// ─── Graceful shutdown ─────────────────────────────────────────────────────────
function gracefulShutdown(code = 0) {
  try {
    const { closeDb } = require('./db');
    closeDb();
  } catch (e) {
    console.warn('[BOOT] DB close error on shutdown:', e && e.message);
  }
  if (server) {
    server.close(() => process.exit(code));
    setTimeout(() => process.exit(code), 2000).unref();
  } else {
    process.exit(code);
  }
}

process.on('SIGTERM', () => gracefulShutdown(0));
process.on('SIGINT', () => gracefulShutdown(0));

module.exports = { server, app, gracefulShutdown };
