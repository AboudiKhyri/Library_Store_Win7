/**
 * LIBRARY_STORE — Prepare Electron Desktop Build (Windows 7 Edition)
 * © 2026 Library_Store · All rights reserved
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'

const productDir = process.cwd()
const targetEngine = join(productDir, 'desktop', 'engine')
const targetBin = join(productDir, 'desktop', 'bin')
const targetIcons = join(productDir, 'desktop', 'icons')

console.log('==> [prepare-electron] Staging Library Store Desktop Engine (Win7 Edition)...')

// 1. Verify desktop-engine
if (existsSync(join(targetEngine, 'main', 'index.js'))) {
  console.log('==> [prepare-electron] Local desktop/engine present and verified.')
} else {
  console.error('[prepare-electron] desktop engine is missing at desktop/engine.')
  process.exit(1)
}

// 2. Verify Node.js runtime for Win7
// In offline Win7 builds: if desktop/bin/node.exe is present (Node 16.20.2), it is used.
// If not present, Electron 22 acts as the Node.js runtime via ELECTRON_RUN_AS_NODE=1 (Node 16.17.1).
// NO external network requests are made (100% offline guarantee).
const nodeExe = join(targetBin, 'node.exe')
if (existsSync(nodeExe)) {
  console.log('==> [prepare-electron] Bundled Node.js runtime present:', nodeExe)
} else {
  console.log('==> [prepare-electron] Notice: desktop/bin/node.exe not provided; runtime will use Electron 22 fallback (ELECTRON_RUN_AS_NODE).')
}

// 3. Verify static export client output (out/)
const outIndex = join(productDir, 'out', 'index.html')
if (!existsSync(outIndex)) {
  console.warn('[prepare-electron] WARNING: out/index.html is missing. Run `npm run build` before packaging.')
} else {
  console.log('==> [prepare-electron] Static client export present:', outIndex)
}

// 4. Verify server/server.js
const serverJs = join(productDir, 'server', 'server.js')
if (!existsSync(serverJs)) {
  console.error('[prepare-electron] server/server.js is missing.')
  process.exit(1)
}
console.log('==> [prepare-electron] Express backend entry point present:', serverJs)

// 5. Verify icons
const iconIco = join(targetIcons, 'icon.ico')
if (!existsSync(iconIco)) {
  console.error('[prepare-electron] icon.ico is missing at desktop/icons/icon.ico')
  process.exit(1)
}
console.log('==> [prepare-electron] Application icon present:', iconIco)

console.log('==> [prepare-electron] Desktop build staging COMPLETE!')
