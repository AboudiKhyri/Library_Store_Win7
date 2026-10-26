const fs = require('fs');
const path = require('path');
const Database = require('../server/node_modules/better-sqlite3');

console.log('=== PURGING DEPRECATED ROLES (KEEPING ONLY OWNER & CASHIER) ===\n');

// 1. Backup and update data/custom.db
const dbPath = path.resolve(__dirname, '../data/custom.db');
const backupPath = path.resolve(__dirname, '../data/custom.db.bak_roles');

if (fs.existsSync(dbPath)) {
  fs.copyFileSync(dbPath, backupPath);
  console.log('✓ Database backed up to:', backupPath);

  const db = new Database(dbPath);
  
  // Reassign any users if needed
  const userUpdate = db.prepare(`UPDATE User SET roleKey = 'cashier' WHERE roleKey IN ('manager', 'inventory_manager', 'accountant', 'viewer')`).run();
  console.log(`✓ Reassigned ${userUpdate.changes} user(s) to 'cashier'`);

  // Delete the 4 roles
  const roleDelete = db.prepare(`DELETE FROM Role WHERE key IN ('manager', 'inventory_manager', 'accountant', 'viewer')`).run();
  console.log(`✓ Deleted ${roleDelete.changes} deprecated role(s) from Role table`);

  // Verify remaining roles
  const remainingRoles = db.prepare('SELECT id, key, nameAr, nameEn FROM Role').all();
  console.log('\nRemaining roles in custom.db:');
  console.table(remainingRoles);
  db.close();
}

// 2. Update server/db.js in both Win7 server/ and dist-desktop/
const serverDbFiles = [
  path.resolve(__dirname, '../server/db.js'),
  path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/server/db.js')
];

const newDefaultRoles = `const DEFAULT_ROLES = [
  { id: 'role_owner', tenantId: 'default', key: 'owner', nameAr: 'المالك', nameEn: 'Owner',
    description: 'صلاحيات كاملة', permissions: JSON.stringify(DEFAULT_PERMISSIONS_OWNER), isSystem: 1 },
  { id: 'role_cashier', tenantId: 'default', key: 'cashier', nameAr: 'كاشير', nameEn: 'Cashier',
    description: 'عمليات نقطة البيع',
    permissions: JSON.stringify(['DASHBOARD_VIEW','PRODUCT_VIEW','SALES_VIEW','SALES_CREATE','SALES_RETURN','CUSTOMER_VIEW']),
    isSystem: 1 },
];`;

serverDbFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace DEFAULT_ROLES definition
  const startIdx = content.indexOf('const DEFAULT_ROLES = [');
  const endIdx = content.indexOf('const DEFAULT_BRANDING = {');
  if (startIdx !== -1 && endIdx !== -1) {
    content = content.slice(0, startIdx) + newDefaultRoles + '\n\n' + content.slice(endIdx);
  }

  // Ensure purge in ensureSystemData
  if (!content.includes(`DELETE FROM Role WHERE key IN ('manager'`)) {
    const seedPoint = "try { console.log('[server] [BOOT] Invalidate prior sessions:";
    const seedPointAlternative = "function ensureSystemData() {";
    if (content.includes(seedPointAlternative)) {
      content = content.replace(
        "function ensureSystemData() {",
        `function ensureSystemData() {
  // Enforce deprecated system roles purge
  try {
    const _db = openDb();
    _db.prepare("UPDATE User SET roleKey='cashier' WHERE roleKey IN ('manager', 'inventory_manager', 'accountant', 'viewer')").run();
    _db.prepare("DELETE FROM Role WHERE key IN ('manager', 'inventory_manager', 'accountant', 'viewer')").run();
  } catch (_e) {}`
      );
    }
  }

  fs.writeFileSync(file, content, 'utf8');
  console.log('✓ Updated DEFAULT_ROLES & purge in:', file);
});

// 3. Update permissions.ts in both workspaces
const permissionsFiles = [
  path.resolve(__dirname, '../src/lib/library/permissions.ts'),
  path.resolve(__dirname, '../../src/lib/library/permissions.ts')
];

const newSystemRoles = `export const SYSTEM_ROLES: RoleDef[] = [
  {
    key: 'owner',
    nameAr: 'المالك',
    nameEn: 'Owner',
    description: 'صلاحيات كاملة بدون قيود',
    permissions: [...ALL_PERMISSIONS],
  },
  {
    key: 'cashier',
    nameAr: 'كاشير',
    nameEn: 'Cashier',
    description: 'عمليات نقطة البيع والتحصيل',
    permissions: [
      'DASHBOARD_VIEW',
      'PRODUCT_VIEW',
      'SALES_VIEW',
      'SALES_CREATE',
      'SALES_RETURN',
      'CUSTOMER_VIEW',
    ],
  },
]`;

permissionsFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  const startIdx = content.indexOf('export const SYSTEM_ROLES: RoleDef[] = [');
  const endIdx = content.indexOf('export function getSystemRole(key: string)');
  if (startIdx !== -1 && endIdx !== -1) {
    content = content.slice(0, startIdx) + newSystemRoles + '\n\n' + content.slice(endIdx);
    fs.writeFileSync(file, content, 'utf8');
    console.log('✓ Updated SYSTEM_ROLES in:', file);
  }
});

// 4. Update system.ts in main workspace
const systemTs = path.resolve(__dirname, '../../src/lib/library/system.ts');
if (fs.existsSync(systemTs)) {
  let content = fs.readFileSync(systemTs, 'utf8');
  // Replace defaultRoles
  const oldDefaultRolesPattern = /const defaultRoles = \[[\s\S]*?id: 'role_cashier'[\s\S]*?\}\s*\]/;
  const newDefaultRolesTs = `const defaultRoles = [
          {
            id: 'role_owner',
            tenantId: 'default',
            key: 'owner',
            nameAr: 'المالك',
            nameEn: 'Owner',
            description: 'صلاحيات كاملة وغير مقيدة',
            permissions: JSON.stringify([
              'DASHBOARD_VIEW', 'PRODUCT_VIEW', 'PRODUCT_CREATE', 'PRODUCT_EDIT', 'PRODUCT_DELETE',
              'CATEGORY_VIEW', 'CATEGORY_MANAGE', 'INVENTORY_VIEW', 'INVENTORY_ADJUST', 'STOCKTAKE_CREATE',
              'SALES_VIEW', 'SALES_CREATE', 'SALES_CANCEL', 'SALES_RETURN',
              'PURCHASE_VIEW', 'PURCHASE_CREATE', 'PURCHASE_RECEIVE',
              'SUPPLIER_VIEW', 'SUPPLIER_MANAGE', 'CUSTOMER_VIEW', 'CUSTOMER_MANAGE',
              'REPORT_VIEW', 'REPORT_EXPORT', 'USER_VIEW', 'USER_MANAGE',
              'ROLE_VIEW', 'ROLE_MANAGE', 'SETTINGS_VIEW', 'SETTINGS_MANAGE',
              'HARDWARE_MANAGE', 'BACKUP_MANAGE', 'AUDIT_VIEW'
            ]),
            isSystem: true,
          },
          {
            id: 'role_cashier',
            tenantId: 'default',
            key: 'cashier',
            nameAr: 'كاشير',
            nameEn: 'Cashier',
            description: 'عمليات نقطة البيع والتحصيل والمرتجعات البسيطة',
            permissions: JSON.stringify([
              'DASHBOARD_VIEW', 'PRODUCT_VIEW', 'SALES_VIEW', 'SALES_CREATE', 'SALES_RETURN', 'CUSTOMER_VIEW'
            ]),
            isSystem: true,
          }
        ]`;
  if (oldDefaultRolesPattern.test(content)) {
    content = content.replace(oldDefaultRolesPattern, newDefaultRolesTs);
  }
  // Add purge in ensureBootstrap if not already there
  if (!content.includes(`roleKey: { in: ['manager'`)) {
    content = content.replace(
      "await db.role.create({ data: r }).catch(() => undefined)",
      `await db.role.create({ data: r }).catch(() => undefined)
        }
        await db.user.updateMany({
          where: { roleKey: { in: ['manager', 'inventory_manager', 'accountant', 'viewer'] } },
          data: { roleKey: 'cashier' }
        }).catch(() => undefined)
        await db.role.deleteMany({
          where: { key: { in: ['manager', 'inventory_manager', 'accountant', 'viewer'] } }
        }).catch(() => undefined`
    );
  }
  fs.writeFileSync(systemTs, content, 'utf8');
  console.log('✓ Updated system.ts in main edition');
}

console.log('\n=== ROLES PURGE SUCCESSFULLY APPLIED ===');
