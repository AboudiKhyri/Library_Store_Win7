const cp = require('child_process');
const path = require('path');
const fs = require('fs');

const cwd = path.resolve(__dirname, '..');
const localNode = path.join(cwd, 'desktop/bin/node.exe');
const node = fs.existsSync(localNode) ? localNode : process.execPath;

const tests = [
  'scripts/audit-ui-contrast.cjs',
  'scripts/verify-client-assets.cjs',
  'scripts/test-login-gate.cjs',
  'scripts/test-barcode-integration.cjs',
  'scripts/test-expiry-removal-fifo.cjs',
  'scripts/test-dashboard-endpoint.cjs',
  'scripts/test-lifecycle-fixes.cjs',
  'scripts/test-initial-stock.cjs',
  'scripts/test-switch-rtl-integrity.cjs',
  'scripts/test-datetime-crash-resilience.cjs',
  'scripts/test-roles-integrity.cjs',
  'scripts/test-theme-switch-and-contrast.cjs',
  'scripts/test-lbc-font.cjs',
  'scripts/test-fefo-expiry-purge.cjs',
  'scripts/test-opacity-and-loyalty-contrast.cjs',
  'scripts/test-branding-integration.cjs',
  'scripts/test-sku-sequential.cjs',
  'scripts/test-weighable-layout.cjs',
  'scripts/test-barcode-qr-enhancement.cjs',
  'scripts/test-initial-stock-and-preview-containment.cjs',
  'scripts/test-theme-persistence-on-reboot.cjs',
  'scripts/test-permanent-delete-cascade.cjs',
  'scripts/test-purchases-searchbar.cjs',
  'scripts/test-user-creation-admin-auth.cjs',
  'scripts/test-settings-inventory-tab-removed.cjs',
  'scripts/test-cashier-role-editable.cjs',
  'scripts/test-custom-spinner.cjs',
  'scripts/test-dynamic-workflows.cjs',
  'scripts/test-forensic-fixes.cjs',
  'scripts/test-sidebar-date.cjs',
  'scripts/test-owner-license-access.cjs',
  'scripts/test-purchases-filter-layout.cjs',
  'scripts/test-sidebar-header-branding.cjs',
  'scripts/test-product-dialog-fields.cjs',
  'scripts/test-splash-theme-sync.cjs',
  'scripts/test-no-duplicate-header-branding.cjs',
  'scripts/test-keyboard-shortcuts-overlay.cjs',
  'scripts/test-settings-reset-button.cjs',
  'scripts/test-release-artifact.cjs'
];

let totalFailed = 0;

for (const t of tests) {
  process.stdout.write(`>>> [RUN] ${t} ... `);
  try {
    const out = cp.execSync(`"${node}" ${t}`, { cwd, encoding: 'utf8' });
    const summary = out.split('\n').filter(l => l.includes('PASS') || l.includes('SUMMARY') || l.includes('RESULT') || l.includes('SUCCESS')).slice(-1)[0] || 'OK';
    console.log(`[PASS] (${summary.trim()})`);
  } catch (err) {
    console.log(`[FAIL]`);
    console.error(err.stdout || err.message);
    totalFailed++;
  }
}

if (totalFailed > 0) {
  console.error(`\nFAILED: ${totalFailed} test suite(s) failed.`);
  process.exit(1);
} else {
  console.log(`\nSUCCESS: ALL ${tests.length} TEST SUITES PASSED CLEANLY.`);
}
