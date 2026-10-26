/**
 * scripts/test-keyboard-shortcuts-overlay.cjs
 * Automated test suite asserting that the keyboard shortcuts overlay
 * is properly wired to the header button and keyboard hotkey.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== TEST SUITE: KEYBOARD SHORTCUTS OVERLAY BINDINGS ===\n');

const root = path.resolve(__dirname, '..');
const helpTsxPath = path.join(root, 'src/components/library/parts/shortcuts-help.tsx');
const appTsxPath = path.join(root, 'src/components/library/app.tsx');
const chunkPath = path.join(root, 'out/_next/static/chunks/18yoqc7d05wnq.js');
const distChunkClient = path.join(root, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js');
const distChunkOut = path.join(root, 'dist-desktop/win-unpacked/resources/out/_next/static/chunks/18yoqc7d05wnq.js');

let total = 0;
let passed = 0;

function runTest(desc, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${desc}:`, err.message);
  }
}

// 1. Verify src/components/library/parts/shortcuts-help.tsx
const helpTsx = fs.readFileSync(helpTsxPath, 'utf8');

runTest('(a) shortcuts-help.tsx accepts controlled open and setOpen props', () => {
  assert(helpTsx.includes('ShortcutsHelpOverlayProps'), 'ShortcutsHelpOverlayProps interface missing');
  assert(helpTsx.includes('open: controlledOpen'), 'controlledOpen binding missing');
  assert(helpTsx.includes('setOpen: controlledSetOpen'), 'controlledSetOpen binding missing');
  assert(helpTsx.includes('const isControlled = typeof controlledOpen === \'boolean\''), 'controlled state logic missing');
});

// 2. Verify src/components/library/app.tsx
const appTsx = fs.readFileSync(appTsxPath, 'utf8');

runTest('(b) app.tsx has helpOpen state and passes it to ShortcutsHelpOverlay', () => {
  assert(appTsx.includes('const [helpOpen, setHelpOpen] = useState(false)'), 'helpOpen state missing in app.tsx');
  assert(appTsx.includes('onClick={() => setHelpOpen(true)}'), 'onClick trigger missing for keyboard button');
  assert(appTsx.includes('<ShortcutsHelpOverlay open={helpOpen} setOpen={setHelpOpen} />'), 'ShortcutsHelpOverlay props missing in app.tsx');
});

// 3. Verify compiled chunk out/_next/static/chunks/18yoqc7d05wnq.js
const chunkCode = fs.readFileSync(chunkPath, 'utf8');

runTest('(c) Compiled chunk of() component accepts open and setOpen props', () => {
  assert(chunkCode.includes('function of({open:_op,setOpen:_sop}'), 'of component missing open/setOpen parameters');
  assert(chunkCode.includes('let _o="boolean"==typeof _op?_op:r'), 'Controlled open resolution missing');
});

runTest('(d) Compiled chunk renders (0,N.jsx)(of,{open:x,setOpen:y})', () => {
  assert(chunkCode.includes('(0,N.jsx)(of,{open:x,setOpen:y})'), 'Invocation missing open:x, setOpen:y');
  assert(chunkCode.includes('onClick:()=>y(!0)'), 'Header button missing onClick:()=>y(!0)');
});

// 4. Verify dist-desktop targets
for (const p of [distChunkClient, distChunkOut]) {
  if (fs.existsSync(p)) {
    const c = fs.readFileSync(p, 'utf8');
    runTest(`(e) ${path.relative(root, p)} has wired shortcuts overlay`, () => {
      assert(c.includes('function of({open:_op,setOpen:_sop}'), `open/setOpen missing in ${p}`);
      assert(c.includes('(0,N.jsx)(of,{open:x,setOpen:y})'), `open:x, setOpen:y missing in ${p}`);
    });
  }
}

console.log(`\nRESULTS: ${passed} / ${total} checks passed.`);
if (passed === total) {
  console.log('[PASS] ALL KEYBOARD SHORTCUTS OVERLAY CHECKS PASSED CLEANLY!');
  process.exit(0);
} else {
  console.error('[FAIL] Some checks failed.');
  process.exit(1);
}
