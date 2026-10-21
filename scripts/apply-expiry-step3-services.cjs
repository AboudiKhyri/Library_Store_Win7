/**
 * Forensic script to update frontend services:
 * 1. src/lib/library/services/inventory.ts
 * 2. src/lib/library/services/sales.ts
 * 3. src/lib/library/services/purchases.ts
 * 4. src/lib/library/services/dashboard.ts
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const servDir = path.join(root, 'src', 'lib', 'library', 'services');

// 1. inventory.ts
const invPath = path.join(servDir, 'inventory.ts');
let invCode = fs.readFileSync(invPath, 'utf8').replace(/\r\n/g, '\n');

invCode = invCode.replace(
  '// FEFO allocation, batch-safe stock mutations, adjustments, stocktake.',
  '// FIFO allocation, batch-safe stock mutations, adjustments, stocktake.'
);

const oldFefoFn = `/**
 * FEFO — First Expiry, First Out.
 * Deterministic batch allocation for an outbound quantity. Batches with no
 * expiry date are consumed last (safest commercial interpretation).
 * Expired batches are NEVER allocated (unless explicitly allowed at the caller).
 */
export async function allocateFefo(
  tx: Tx,
  productId: string,
  quantity: number,
  opts: { includeExpired?: boolean; tenantId?: string } = {}
): Promise<BatchAllocation[]> {
  if (quantity <= 0) throw new ApiError('QTY_INVALID', 'الكمية يجب أن تكون أكبر من صفر', 400)

  const batches = await tx.batch.findMany({
    where: {
      productId,
      ...(opts.tenantId ? { tenantId: opts.tenantId } : {}),
      quantity: { gt: 0 },
      status: 'ACTIVE',
    },
    orderBy: [{ expiryDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
  })

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const eligible = opts.includeExpired
    ? batches
    : batches.filter((b) => !b.expiryDate || b.expiryDate >= today)

  const allocations: BatchAllocation[] = []
  let remaining = quantity
  for (const batch of eligible) {
    if (remaining <= 1e-9) break
    const take = r3(Math.min(batch.quantity, remaining))
    if (take <= 0) continue
    allocations.push({
      batchId: batch.id,
      batchNo: batch.batchNo,
      expiryDate: batch.expiryDate,
      qty: take,
      costPrice: batch.costPrice,
    })
    remaining = r3(remaining - take)
  }

  if (remaining > 1e-9) {
    const available = r3(eligible.reduce((s, b) => s + b.quantity, 0))
    throw new ApiError(
      'INSUFFICIENT_STOCK',
      \`الكمية المطلوبة غير متاحة — المتاح حالياً \${available} وحدة\`,
      409
    )
  }
  return allocations
}`;

const newFifoFn = `/**
 * FIFO — First In, First Out.
 * Stationery products do not expire. Batches are allocated by oldest arrival date
 * (createdAt ASC, id ASC) to maintain cost flow consistency.
 */
export async function allocateFifo(
  tx: Tx,
  productId: string,
  quantity: number,
  opts: { includeExpired?: boolean; tenantId?: string } = {}
): Promise<BatchAllocation[]> {
  if (quantity <= 0) throw new ApiError('QTY_INVALID', 'الكمية يجب أن تكون أكبر من صفر', 400)

  const batches = await tx.batch.findMany({
    where: {
      productId,
      ...(opts.tenantId ? { tenantId: opts.tenantId } : {}),
      quantity: { gt: 0 },
      status: 'ACTIVE',
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })

  const allocations: BatchAllocation[] = []
  let remaining = quantity
  for (const batch of batches) {
    if (remaining <= 1e-9) break
    const take = r3(Math.min(batch.quantity, remaining))
    if (take <= 0) continue
    allocations.push({
      batchId: batch.id,
      batchNo: batch.batchNo,
      expiryDate: null,
      qty: take,
      costPrice: batch.costPrice,
    })
    remaining = r3(remaining - take)
  }

  if (remaining > 1e-9) {
    const available = r3(batches.reduce((s, b) => s + b.quantity, 0))
    throw new ApiError(
      'INSUFFICIENT_STOCK',
      \`الكمية المطلوبة غير متاحة — المتاح حالياً \${available} وحدة\`,
      409
    )
  }
  return allocations
}

export const allocateFefo = allocateFifo;`;

if (!invCode.includes(oldFefoFn)) {
  console.error('Error: oldFefoFn not found in inventory.ts');
  process.exit(1);
}
invCode = invCode.replace(oldFefoFn, newFifoFn);

// availableStock
const oldAvailStock = `export async function availableStock(
  tx: PrismaClient | Tx,
  productId: string,
  tenantId?: string
): Promise<number> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const batches = await tx.batch.findMany({
    where: {
      productId,
      ...(tenantId ? { tenantId } : {}),
      status: 'ACTIVE',
      quantity: { gt: 0 },
      OR: [{ expiryDate: null }, { expiryDate: { gte: today } }],
    },
    select: { quantity: true },
  })
  return r3(batches.reduce((s, b) => s + b.quantity, 0))
}`;

const newAvailStock = `export async function availableStock(
  tx: PrismaClient | Tx,
  productId: string,
  tenantId?: string
): Promise<number> {
  const batches = await tx.batch.findMany({
    where: {
      productId,
      ...(tenantId ? { tenantId } : {}),
      status: 'ACTIVE',
      quantity: { gt: 0 },
    },
    select: { quantity: true },
  })
  return r3(batches.reduce((s, b) => s + b.quantity, 0))
}`;

if (!invCode.includes(oldAvailStock)) {
  console.error('Error: oldAvailStock not found in inventory.ts');
  process.exit(1);
}
invCode = invCode.replace(oldAvailStock, newAvailStock);

// In adjustStock: remove status = EXPIRED
invCode = invCode.replace(
  `        const newStatus =\n          countedQty === 0 && input.type === 'EXPIRY_WRITEOFF'\n            ? 'EXPIRED'\n            : countedQty === 0\n            ? 'DEPLETED'\n            : batch.status === 'DEPLETED'\n            ? 'ACTIVE'\n            : batch.status`,
  `        const newStatus =\n          countedQty === 0\n            ? 'DEPLETED'\n            : batch.status === 'DEPLETED'\n            ? 'ACTIVE'\n            : batch.status`
);

// In stocktake batch mapping:
invCode = invCode.replace(
  `include: { batches: { where: { quantity: { gt: 0 } }, orderBy: [{ expiryDate: { sort: 'asc', nulls: 'last' } }] } },`,
  `include: { batches: { where: { quantity: { gt: 0 } }, orderBy: [{ createdAt: 'asc' }] } },`
);
invCode = invCode.replace(
  `where: { productId: line.productId, tenantId, quantity: { gt: 0 }, status: { in: ['ACTIVE', 'DEPLETED', 'EXPIRED'] } },\n          orderBy: [{ expiryDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],`,
  `where: { productId: line.productId, tenantId, quantity: { gt: 0 }, status: { in: ['ACTIVE', 'DEPLETED'] } },\n          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],`
);
invCode = invCode.replace('// deficit: consume batches FEFO', '// deficit: consume batches FIFO');

// inventoryValue
invCode = invCode.replace(
  `where: { tenantId, quantity: { gt: 0 }, status: { in: ['ACTIVE', 'EXPIRED'] } },`,
  `where: { tenantId, quantity: { gt: 0 }, status: 'ACTIVE' },`
);

// sweepExpiredBatchesForTenant safe no-op
const oldSweepPattern = /\/\*\*[\s\S]*?export async function sweepExpiredBatchesForTenant\(\): Promise<number> \{[\s\S]*?return res\.count\n\}/;
const newSweep = `/**
 * Safe no-op: stationery store products do not expire.
 */
export async function sweepExpiredBatchesForTenant(): Promise<number> {
  return 0
}`;

if (!oldSweepPattern.test(invCode)) {
  console.error('Error: oldSweepPattern not matched in inventory.ts');
  process.exit(1);
}
invCode = invCode.replace(oldSweepPattern, newSweep);

invCode = invCode.replace(/\n/g, '\r\n');
fs.writeFileSync(invPath, invCode, 'utf8');
console.log('✓ src/lib/library/services/inventory.ts updated');

// 2. sales.ts
const salesPath = path.join(servDir, 'sales.ts');
let salesCode = fs.readFileSync(salesPath, 'utf8').replace(/\r\n/g, '\n');

salesCode = salesCode.replace(
  '// Atomic sale creation with FEFO allocation, cancellation with restock.',
  '// Atomic sale creation with FIFO allocation, cancellation with restock.'
);
salesCode = salesCode.replace(
  `      // FEFO allocation — expired batches are hard-blocked unless policy allows
      const allocations = await allocateFefo(tx, item.productId, item.quantity, {
        includeExpired: pos.allowSellingExpired,
      })`,
  `      // FIFO allocation — oldest active batches consumed first
      const allocations = await allocateFifo(tx, item.productId, item.quantity)`
);
salesCode = salesCode.replace(
  '// FEFO: one SaleItem per batch allocation for full traceability',
  '// FIFO: one SaleItem per batch allocation for full traceability'
);
salesCode = salesCode.replace(
  'expiryDate: alloc.expiryDate,',
  'expiryDate: null,'
);
salesCode = salesCode.replace(
  'expiry: item.expiryDate ? item.expiryDate.toISOString() : null,',
  'expiry: null,'
);

salesCode = salesCode.replace(/\n/g, '\r\n');
fs.writeFileSync(salesPath, salesCode, 'utf8');
console.log('✓ src/lib/library/services/sales.ts updated');

// 3. purchases.ts
const purPath = path.join(servDir, 'purchases.ts');
let purCode = fs.readFileSync(purPath, 'utf8').replace(/\r\n/g, '\n');

purCode = purCode.replace(
  'expiryDate: v.item.expiryDate ? new Date(v.item.expiryDate) : null,',
  'expiryDate: null,'
);
purCode = purCode.replace(
  'expiryDate: item.expiryDate,',
  'expiryDate: null,'
);

purCode = purCode.replace(/\n/g, '\r\n');
fs.writeFileSync(purPath, purCode, 'utf8');
console.log('✓ src/lib/library/services/purchases.ts updated');

// 4. dashboard.ts
const dashPath = path.join(servDir, 'dashboard.ts');
let dashCode = fs.readFileSync(dashPath, 'utf8').replace(/\r\n/g, '\n');

dashCode = dashCode.replace(
  'const warningDays = pos.expiryWarningDays',
  '// expiry removed for stationery store'
);
dashCode = dashCode.replace(
  `      where: { tenantId, quantity: { gt: 0 }, status: { in: ['ACTIVE', 'EXPIRED'] } },\n      select: { productId: true, quantity: true, costPrice: true, expiryDate: true },`,
  `      where: { tenantId, quantity: { gt: 0 }, status: 'ACTIVE' },\n      select: { productId: true, quantity: true, costPrice: true },`
);

const oldDashLoop = `    let nearExpiryCount = 0
    let expiredCount = 0
    const perProduct = new Map<string, number>()

    for (const b of batches) {
      stockValue += b.quantity * b.costPrice
      if (b.expiryDate) {
        const exp = new Date(b.expiryDate.getFullYear(), b.expiryDate.getMonth(), b.expiryDate.getDate())
        if (exp < today) expiredCount++
        else if (exp <= warningLimit) nearExpiryCount++
      }
      perProduct.set(b.productId, (perProduct.get(b.productId) || 0) + b.quantity)
    }`;

const newDashLoop = `    let nearExpiryCount = 0
    let expiredCount = 0
    const perProduct = new Map<string, number>()

    for (const b of batches) {
      stockValue += b.quantity * b.costPrice
      perProduct.set(b.productId, (perProduct.get(b.productId) || 0) + b.quantity)
    }`;

if (!dashCode.includes(oldDashLoop)) {
  console.error('Error: oldDashLoop not found in dashboard.ts');
  process.exit(1);
}
dashCode = dashCode.replace(oldDashLoop, newDashLoop);

dashCode = dashCode.replace(/\n/g, '\r\n');
fs.writeFileSync(dashPath, dashCode, 'utf8');
console.log('✓ src/lib/library/services/dashboard.ts updated');
