/**
 * scripts/patch-fix-keyboard-shortcuts.cjs
 * Fixes the keyboard shortcuts button by wiring open and setOpen state
 * to ShortcutsHelpOverlay in src/, out/, and dist-desktop/.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
console.log('=== FIXING KEYBOARD SHORTCUTS OVERLAY BINDING ===');

// 1. Update src/components/library/parts/shortcuts-help.tsx
const helpTsxPath = path.join(root, 'src/components/library/parts/shortcuts-help.tsx');
let helpTsx = fs.readFileSync(helpTsxPath, 'utf8');

const oldDef = `export function ShortcutsHelpOverlay() {
  const view = useLibraryStore((s) => s.view)
  const lang = useLibraryStore((s) => s.lang)
  const [open, setOpen] = useState(false)

  const toggle = useCallback(() => setOpen((v) => !v), [])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // "?" is Shift+/ on most layouts; also support direct "?" key
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        const target = e.target as HTMLElement | null
        const tag = target?.tagName?.toLowerCase()
        const typing = tag === 'input' || tag === 'textarea' || target?.isContentEditable
        if (typing) {
          // allow the shortcut when a text field is EMPTY (e.g. autofocused POS
          // search); block only while the user is actually typing content
          const value = (target as HTMLInputElement | HTMLTextAreaElement).value ?? ''
          if (value.length > 0) return
        }
        e.preventDefault()
        setOpen(true)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])`;

const newDef = `interface ShortcutsHelpOverlayProps {
  open?: boolean
  setOpen?: (open: boolean) => void
  onClose?: () => void
}

export function ShortcutsHelpOverlay({
  open: controlledOpen,
  setOpen: controlledSetOpen,
  onClose,
}: ShortcutsHelpOverlayProps = {}) {
  const view = useLibraryStore((s) => s.view)
  const lang = useLibraryStore((s) => s.lang)
  const [internalOpen, setInternalOpen] = useState(false)

  const isControlled = typeof controlledOpen === 'boolean'
  const open = isControlled ? controlledOpen : internalOpen

  const setOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const nextValue = typeof value === 'function' ? value(open) : value
      if (!nextValue && onClose) {
        onClose()
      }
      if (controlledSetOpen) {
        controlledSetOpen(nextValue)
      } else {
        setInternalOpen(nextValue)
      }
    },
    [open, controlledSetOpen, onClose]
  )

  const toggle = useCallback(() => setOpen((v) => !v), [setOpen])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // "?" is Shift+/ on most layouts; also support direct "?" key
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        const target = e.target as HTMLElement | null
        const tag = target?.tagName?.toLowerCase()
        const typing = tag === 'input' || tag === 'textarea' || target?.isContentEditable
        if (typing) {
          // allow the shortcut when a text field is EMPTY (e.g. autofocused POS
          // search); block only while the user is actually typing content
          const value = (target as HTMLInputElement | HTMLTextAreaElement).value ?? ''
          if (value.length > 0) return
        }
        e.preventDefault()
        setOpen(true)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, setOpen])`;

const helpNorm = helpTsx.replace(/\r\n/g, '\n');
const oldDefNorm = oldDef.replace(/\r\n/g, '\n');

if (helpNorm.includes(oldDefNorm)) {
  const isCrlf = helpTsx.includes('\r\n');
  const rep = newDef.replace(/\r\n/g, '\n');
  const replaced = helpNorm.replace(oldDefNorm, rep);
  helpTsx = isCrlf ? replaced.replace(/\n/g, '\r\n') : replaced;
  fs.writeFileSync(helpTsxPath, helpTsx, 'utf8');
  console.log('✓ Updated ShortcutsHelpOverlay to accept controlled open & setOpen props in shortcuts-help.tsx');
} else if (helpTsx.includes('ShortcutsHelpOverlayProps')) {
  console.log('ℹ ShortcutsHelpOverlay already updated in shortcuts-help.tsx');
} else {
  throw new Error('Could not find ShortcutsHelpOverlay definition in ' + helpTsxPath);
}

// 2. Update src/components/library/app.tsx
const appTsxPath = path.join(root, 'src/components/library/app.tsx');
let appTsx = fs.readFileSync(appTsxPath, 'utf8');

if (appTsx.includes('<ShortcutsHelpOverlay />')) {
  appTsx = appTsx.replace('<ShortcutsHelpOverlay />', '<ShortcutsHelpOverlay open={helpOpen} setOpen={setHelpOpen} />');
  fs.writeFileSync(appTsxPath, appTsx, 'utf8');
  console.log('✓ Passed open={helpOpen} setOpen={setHelpOpen} into ShortcutsHelpOverlay in app.tsx');
} else if (appTsx.includes('<ShortcutsHelpOverlay open={helpOpen} setOpen={setHelpOpen} />')) {
  console.log('ℹ ShortcutsHelpOverlay already has open={helpOpen} in app.tsx');
} else {
  throw new Error('Could not find <ShortcutsHelpOverlay /> in ' + appTsxPath);
}

// 3. Patch out/_next/static/chunks/18yoqc7d05wnq.js
const outChunkPath = path.join(root, 'out/_next/static/chunks/18yoqc7d05wnq.js');
let chunkContent = fs.readFileSync(outChunkPath, 'utf8');

// 3.1 Function definition of of
const targetFnStart = 'function of(){let e=L(e=>e.view),t=L(e=>e.lang),[r,n]=(0,k.useState)(!1);(0,k.useCallback)(()=>n(e=>!e),[]),(0,k.useEffect)(()=>{function e(e){if("?"===e.key||e.shiftKey&&"/"===e.key){let t=e.target,r=t?.tagName?.toLowerCase();("input"===r||"textarea"===r||t?.isContentEditable)&&(t.value??"").length>0||(e.preventDefault(),n(!0))}else"Escape"===e.key&&r&&n(!1)}return window.addEventListener("keydown",e),()=>window.removeEventListener("keydown",e)},[r]);let a="pos"===e,i=[{scope:"global",items:op.filter(e=>"global"===e.scope)},...a?[{scope:"pos",items:op.filter(e=>"pos"===e.scope)}]:[]].filter(e=>e.items.length>0);return(0,N.jsx)(iV,{open:r,onOpenChange:n,';

const repFnStart = 'function of({open:_op,setOpen:_sop}={}){let e=L(e=>e.view),t=L(e=>e.lang),[r,n]=(0,k.useState)(!1);let _o="boolean"==typeof _op?_op:r;let _so=t=>{"function"==typeof _sop?_sop(t):n(t)};(0,k.useEffect)(()=>{function e(e){if("?"===e.key||e.shiftKey&&"/"===e.key){let t=e.target,r=t?.tagName?.toLowerCase();("input"===r||"textarea"===r||t?.isContentEditable)&&(t.value??"").length>0||(e.preventDefault(),_so(!0))}else"Escape"===e.key&&_o&&_so(!1)}return window.addEventListener("keydown",e),()=>window.removeEventListener("keydown",e)},[_o]);let a="pos"===e,i=[{scope:"global",items:op.filter(e=>"global"===e.scope)},...a?[{scope:"pos",items:op.filter(e=>"pos"===e.scope)}]:[]].filter(e=>e.items.length>0);return(0,N.jsx)(iV,{open:_o,onOpenChange:_so,';

if (chunkContent.includes(targetFnStart)) {
  chunkContent = chunkContent.replace(targetFnStart, repFnStart);
  console.log('✓ Patched function of definition in chunk');
} else if (chunkContent.includes('function of({open:_op')) {
  console.log('ℹ function of definition already patched in chunk');
} else {
  throw new Error('targetFnStart not found in ' + outChunkPath);
}

// 3.2 Invocation of of in D3
const targetInvocation = '(0,N.jsx)(of,{})';
const repInvocation = '(0,N.jsx)(of,{open:x,setOpen:y})';

if (chunkContent.includes(targetInvocation)) {
  chunkContent = chunkContent.replace(targetInvocation, repInvocation);
  console.log('✓ Patched (0,N.jsx)(of,{open:x,setOpen:y}) invocation in chunk');
} else if (chunkContent.includes(repInvocation)) {
  console.log('ℹ (0,N.jsx)(of,{open:x,setOpen:y}) already patched in chunk');
} else {
  throw new Error('targetInvocation not found in ' + outChunkPath);
}

fs.writeFileSync(outChunkPath, chunkContent, 'utf8');
console.log('✓ Successfully wrote ' + outChunkPath);

// 4. Verify syntax of patched chunk
execSync(`"${process.execPath}" -c "${outChunkPath}"`, { stdio: 'inherit' });
console.log('✓ Verified syntax of ' + outChunkPath);

// 5. Mirror to dist-desktop
const targets = [
  path.join(root, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(root, 'dist-desktop/win-unpacked/resources/out/_next/static/chunks/18yoqc7d05wnq.js')
];

for (const dest of targets) {
  if (fs.existsSync(path.dirname(dest))) {
    fs.copyFileSync(outChunkPath, dest);
    console.log(`✓ Copied patched chunk to ${dest}`);
  }
}

console.log('=== KEYBOARD SHORTCUTS PATCH COMPLETE ===');
