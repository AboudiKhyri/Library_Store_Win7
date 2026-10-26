const fs = require('fs');
const path = require('path');

const routePath = path.resolve(__dirname, '../../src/app/api/library/products/route.ts');
let content = fs.readFileSync(routePath, 'utf8');
const isCRLF = content.includes('\r\n');
let code = content.replace(/\r\n/g, '\n');

// 1. Add initialStock to schema
const targetSchema = `  reorderLevel: z
    .number({ message: 'حد إعادة الطلب يجب أن يكون رقماً' })
    .int('حد إعادة الطلب يجب أن يكون رقماً صحيحاً')
    .min(0, 'حد إعادة الطلب لا يمكن أن يكون سالباً')
    .max(1_000_000, 'حد إعادة الطلب كبير جداً')
    .default(10),
  active: z.boolean({ message: 'حالة النشاط غير صالحة' }).default(true),`;

const replacementSchema = `  reorderLevel: z
    .number({ message: 'حد إعادة الطلب يجب أن يكون رقماً' })
    .int('حد إعادة الطلب يجب أن يكون رقماً صحيحاً')
    .min(0, 'حد إعادة الطلب لا يمكن أن يكون سالباً')
    .max(1_000_000, 'حد إعادة الطلب كبير جداً')
    .default(10),
  initialStock: z
    .number({ message: 'العدد المبدئي يجب أن يكون رقماً' })
    .min(0, 'العدد المبدئي لا يمكن أن يكون سالباً')
    .max(10_000_000, 'العدد المبدئي كبير جداً')
    .default(0),
  active: z.boolean({ message: 'حالة النشاط غير صالحة' }).default(true),`;

if (!code.includes(targetSchema)) {
  console.error('Target schema not found');
  process.exit(1);
}
code = code.replace(targetSchema, replacementSchema);

// 2. Add transaction creation for initialStock
const targetCreate = `    try {
      const product = await db.product.create({
        data: {
          tenantId,
          sku: body.sku,
          nameAr: body.nameAr,
          nameEn: body.nameEn,
          genericName: body.genericName,
          barcode: body.barcode,
          categoryId: body.categoryId,
          manufacturer: body.manufacturer,
          unit: body.unit,
          packSize: body.packSize,
          isWeighable: body.isWeighable,
          purchasePrice: body.purchasePrice,
          sellingPrice: body.sellingPrice,
          minSellingPrice: body.minSellingPrice ?? null,
          taxRate: body.taxRate,
          reorderLevel: body.reorderLevel,
          active: body.active,
          notes: body.notes,
        },
        include: { category: { select: { id: true, nameAr: true } } },
      })

      await audit(
        { userId: user.id, username: user.username },
        'PRODUCT_CREATE',
        {
          entity: 'product',
          entityId: product.id,
          metadata: { sku: product.sku, nameAr: product.nameAr, isWeighable: product.isWeighable },
        },
      )`;

const replacementCreate = `    try {
      const product = await db.$transaction(async (tx) => {
        const p = await tx.product.create({
          data: {
            tenantId,
            sku: body.sku,
            nameAr: body.nameAr,
            nameEn: body.nameEn,
            genericName: body.genericName,
            barcode: body.barcode,
            categoryId: body.categoryId,
            manufacturer: body.manufacturer,
            unit: body.unit,
            packSize: body.packSize,
            isWeighable: body.isWeighable,
            purchasePrice: body.purchasePrice,
            sellingPrice: body.sellingPrice,
            minSellingPrice: body.minSellingPrice ?? null,
            taxRate: body.taxRate,
            reorderLevel: body.reorderLevel,
            active: body.active,
            notes: body.notes,
          },
          include: { category: { select: { id: true, nameAr: true } } },
        })

        if (body.initialStock && body.initialStock > 0) {
          const batchNo = \`INIT-\${Date.now().toString().slice(-6)}\`
          const batch = await tx.batch.create({
            data: {
              tenantId,
              productId: p.id,
              batchNo,
              quantity: body.initialStock,
              costPrice: body.purchasePrice || 0,
              sellPrice: body.sellingPrice,
              status: 'ACTIVE',
            },
          })

          await tx.stockMovement.create({
            data: {
              tenantId,
              productId: p.id,
              batchId: batch.id,
              type: 'INITIAL',
              quantity: body.initialStock,
              unitCost: body.purchasePrice || 0,
              refType: 'product',
              refId: p.id,
              note: 'رصيد افتتاحي عند إضافة الصنف',
              userId: user.id,
            },
          })
        }

        return p
      })

      await audit(
        { userId: user.id, username: user.username },
        'PRODUCT_CREATE',
        {
          entity: 'product',
          entityId: product.id,
          metadata: { sku: product.sku, nameAr: product.nameAr, isWeighable: product.isWeighable, initialStock: body.initialStock },
        },
      )`;

if (!code.includes(targetCreate)) {
  console.error('Target create not found');
  process.exit(1);
}
code = code.replace(targetCreate, replacementCreate);

const finalContent = isCRLF ? code.replace(/\n/g, '\r\n') : code;
fs.writeFileSync(routePath, finalContent, 'utf8');
console.log('✓ Successfully patched src/app/api/library/products/route.ts');
