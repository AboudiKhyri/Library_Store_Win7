import { existsSync, cpSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const outDir = join(root, 'out');

if (!existsSync(outDir)) {
  console.error('[copy-static] out/ directory missing — did `next build` succeed?');
  process.exit(1);
}

// Ensure public files exist in out/
const publicDir = join(root, 'public');
if (existsSync(publicDir)) {
  cpSync(publicDir, outDir, { recursive: true, force: false });
  console.log('[copy-static] verified public assets in out/');
}

console.log('[copy-static] Static client export is ready in out/');
