// LIBRARY_STORE — cross-platform standalone copy (Windows CI safe)
// Copies .next/static into .next/standalone/.next/ and public/ into
// .next/standalone/ after `next build` (equivalent of the old
// `cp -r` which is not portable across bun shells on Windows runners).
//
// v1.2.1 — SYMLINK DEREFERENCE (production-blocking defect fix):
// Next.js 16 (Turbopack) references external server packages through
// hash-suffixed aliases (e.g. `.next/node_modules/@prisma/client-<hash>`)
// that are delivered as RELATIVE SYMLINKS inside `.next/standalone`.
// The Tauri resource packager silently DROPS those symlinks, so the
// installed Windows product crashed at boot with:
//   "Failed to load external module @prisma/client-<hash>"
// This pass replaces every symlink in the standalone tree with a REAL
// copy of its target, making the packaged tree self-contained.
import { cpSync, existsSync, lstatSync, mkdirSync, readlinkSync, readdirSync, realpathSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, join, resolve } from 'node:path'

const root = process.cwd()
const standalone = join(root, '.next', 'standalone')

if (!existsSync(standalone)) {
  console.error('[copy-standalone] .next/standalone missing — did `next build` run?')
  process.exit(1)
}

// static chunks → .next/standalone/.next/static
mkdirSync(join(standalone, '.next'), { recursive: true })
cpSync(join(root, '.next', 'static'), join(standalone, '.next', 'static'), { recursive: true })
console.log('[copy-standalone] copied .next/static → .next/standalone/.next/static')

// public assets → .next/standalone/public
if (existsSync(join(root, 'public'))) {
  cpSync(join(root, 'public'), join(standalone, 'public'), { recursive: true })
  console.log('[copy-standalone] copied public → .next/standalone/public')
}


// ---------------------------------------------------------------------------
// Packaging-artifact pruning — the standalone sweep mirrors project files
// that Next's tracer touches; build tooling must NEVER ship inside the
// installer (a Rust target/ cache once ballooned it to 1.4 GB uncompressed).
// ---------------------------------------------------------------------------
const RUNTIME_PRUNED_DIRS = ['packaging', 'dist-desktop', 'dist', 'bin', 'desktop']

for (const dir of RUNTIME_PRUNED_DIRS) {
  const target = join(standalone, dir)
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true })
    console.log(`[copy-standalone] pruned non-runtime directory: ${dir}/`)
  }
}

// ---------------------------------------------------------------------------
// Symlink dereference pass — run AFTER the copies above so nothing new is
// introduced afterwards. Walks the whole standalone tree, and for every
// symlink: resolve its target and replace the link with a real copy.
// ---------------------------------------------------------------------------
function collectSymlinks(dir, found) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    // withFileTypes on some platforms loses the symlink flag when the link
    // target is missing — re-check with lstat for reliability.
    const st = lstatSync(full)
    if (st.isSymbolicLink()) {
      found.push(full)
    } else if (st.isDirectory()) {
      collectSymlinks(full, found)
    }
  }
}

function resolveFallback(aliasName) {
  // A dangling alias (target not materialized in standalone) can still be
  // recovered: Turbopack alias names are `<package>-<16 hex chars>`. Strip
  // the suffix and resolve the real package directory from the standalone
  // root, the same way the runtime would.
  const base = aliasName.replace(/-[0-9a-f]{16}$/, '')
  if (base === aliasName) return null
  try {
    const req = createRequire(join(standalone, 'server.js'))
    return dirname(req.resolve(`${base}/package.json`))
  } catch {
    return null
  }
}

const symlinks = []
collectSymlinks(standalone, symlinks)

if (symlinks.length === 0) {
  console.log('[copy-standalone] no symlinks found in standalone tree (ok)')
} else {
  for (const link of symlinks) {
    const target = readlinkSync(link)
    let resolved = isAbsolute(target) ? target : resolve(dirname(link), target)
    if (!existsSync(resolved)) {
      const aliasName = link.split(/[\\/]/).pop() ?? ''
      const fallback = resolveFallback(aliasName)
      if (fallback && existsSync(fallback)) {
        resolved = fallback
      } else {
        console.error(
          `[copy-standalone] FATAL: symlink ${link} → ${target} has no resolvable target — the packaged app would crash at boot.`
        )
        process.exit(1)
      }
    }
    const st = lstatSync(resolved)
    rmSync(link)
    if (st.isDirectory()) {
      cpSync(resolved, link, { recursive: true, dereference: true })
    } else {
      cpSync(resolved, link, { dereference: true })
    }
    console.log(`[copy-standalone] dereferenced ${link} → ${resolved}`)
  }
  // Final safety gate: the tree must be symlink-free before packaging.
  const remaining = []
  collectSymlinks(standalone, remaining)
  if (remaining.length > 0) {
    console.error(`[copy-standalone] FATAL: ${remaining.length} symlink(s) still present after dereference pass`)
    process.exit(1)
  }
  console.log('[copy-standalone] standalone tree is symlink-free (packaging safe)')
}
