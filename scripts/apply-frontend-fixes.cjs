const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// 1. pos.tsx
const posPath = path.join(root, 'src/components/library/screens/pos.tsx');
let posSrc = fs.readFileSync(posPath, 'utf8').replace(/\r\n/g, '\n');

// 1.1 send cart: lines (array)
const oldPosSend = `      await api('/sales/suspended', {
        method: 'POST',
        body: { label, cart: JSON.stringify(lines) },
      })`;
const newPosSend = `      await api('/sales/suspended', {
        method: 'POST',
        body: { label, cart: lines },
      })`;
if (posSrc.includes(oldPosSend)) {
  posSrc = posSrc.replace(oldPosSend, newPosSend);
  console.log('✓ pos.tsx: cart: lines array passed directly');
}

// 1.2 restoreSuspended: safe array & DELETE /sales/suspended/:id
const oldRestore = `  async function restoreSuspended(row: SuspendedRow) {
    const restored: PosCartLine[] = (row.cart ?? [])
      .filter((l) => l && typeof l.productId === 'string' && Number(l.quantity) > 0)
      .map((l) => ({
        productId: l.productId,
        nameAr: l.nameAr ?? '',
        sku: l.sku ?? '',
        barcode: l.barcode ?? null,
        unitPrice: Number(l.unitPrice) || 0,
        quantity: Number(l.quantity),
        discount: Number(l.discount) || 0,
        stockAvailable: Number(l.stockAvailable) || 0,
        minSellingPrice: (l as PosCartLine).minSellingPrice ?? null,
        taxRate: (l as PosCartLine).taxRate ?? 0,
        isWeighable: !!(l as PosCartLine).isWeighable,
        unit: (l as PosCartLine).unit ?? null,
      }))
    setLines(restored)
    setResumeOpen(false)
    try {
      await api('/sales/suspended', { method: 'DELETE', body: { id: row.id } })
    } catch {
      // non-fatal — the stored copy can be discarded again later
    }
    toast({ title: 'تمت استعادة الفاتورة', description: row.label })
    requestAnimationFrame(() => searchRef.current?.focus())
  }`;

const newRestore = `  async function restoreSuspended(row: SuspendedRow) {
    const cartRaw = Array.isArray(row.cart) ? row.cart : (typeof row.cart === 'string' ? JSON.parse(row.cart || '[]') : []);
    const restored: PosCartLine[] = (Array.isArray(cartRaw) ? cartRaw : [])
      .filter((l) => l && typeof l.productId === 'string' && Number(l.quantity) > 0)
      .map((l) => ({
        productId: l.productId,
        nameAr: l.nameAr ?? '',
        sku: l.sku ?? '',
        barcode: l.barcode ?? null,
        unitPrice: Number(l.unitPrice) || 0,
        quantity: Number(l.quantity),
        discount: Number(l.discount) || 0,
        stockAvailable: Number(l.stockAvailable) || 0,
        minSellingPrice: (l as PosCartLine).minSellingPrice ?? null,
        taxRate: (l as PosCartLine).taxRate ?? 0,
        isWeighable: !!(l as PosCartLine).isWeighable,
        unit: (l as PosCartLine).unit ?? null,
      }))
    setLines(restored)
    setResumeOpen(false)
    try {
      await api(\`/sales/suspended/\${row.id}\`, { method: 'DELETE' })
    } catch {
      // non-fatal — the stored copy can be discarded again later
    }
    toast({ title: 'تمت استعادة الفاتورة', description: row.label })
    requestAnimationFrame(() => searchRef.current?.focus())
  }`;

if (posSrc.includes(oldRestore)) {
  posSrc = posSrc.replace(oldRestore, newRestore);
  console.log('✓ pos.tsx: restoreSuspended safe unwrap and DELETE /sales/suspended/:id updated');
}

// 1.3 Resume dialog cart array guard
const oldDialogCount = `<p className="text-[11px] text-muted-foreground">
                      {(row.cart ?? []).length} صنف ·{' '}
                      {money(
                        r2(
                          (row.cart ?? []).reduce((s, l) => s + (Number(l.unitPrice) || 0) * (Number(l.quantity) || 0) - (Number(l.discount) || 0), 0)
                        )
                      )}
                    </p>`;

const newDialogCount = `{(() => {
                      const cArr = Array.isArray(row.cart) ? row.cart : [];
                      return (
                        <p className="text-[11px] text-muted-foreground">
                          {cArr.length} صنف ·{' '}
                          {money(
                            r2(
                              cArr.reduce((s, l) => s + (Number(l.unitPrice) || 0) * (Number(l.quantity) || 0) - (Number(l.discount) || 0), 0)
                            )
                          )}
                        </p>
                      );
                    })()}`;

if (posSrc.includes(oldDialogCount)) {
  posSrc = posSrc.replace(oldDialogCount, newDialogCount);
  console.log('✓ pos.tsx: resume dialog cart guard updated');
}

fs.writeFileSync(posPath, posSrc.replace(/\n/g, '\r\n'), 'utf8');

// 2. inventory.tsx
const invPath = path.join(root, 'src/components/library/screens/inventory.tsx');
let invSrc = fs.readFileSync(invPath, 'utf8').replace(/\r\n/g, '\n');

const oldInvScreen = `export function InventoryScreen() {
  const t = useLibraryStore((s) => s.t)
  const status = useLibraryStore((s) => s.status)

  // shared adjust dialog (used by batches tab + product batches dialog)
  const [adjustBatch, setAdjustBatch] = useState<BatchRow | null>(null)`;

const newInvScreen = `export function InventoryScreen() {
  const t = useLibraryStore((s) => s.t)
  const status = useLibraryStore((s) => s.status)
  const warningDays = Number(status?.inventory?.expiryWarningDays) || 30

  // shared adjust dialog (used by batches tab + product batches dialog)
  const [adjustBatch, setAdjustBatch] = useState<BatchRow | null>(null)`;

if (invSrc.includes(oldInvScreen)) {
  invSrc = invSrc.replace(oldInvScreen, newInvScreen);
  console.log('✓ inventory.tsx: warningDays declared in InventoryScreen');
}

const oldBatchFetch = `const res = await api<Paged<BatchRow>>(\`/inventory/batches?productId=\${batchesTarget.productId}&pageSize=100\`)`;
const newBatchFetch = `const res = await api<Paged<BatchRow>>(\`/inventory/batches?productId=\${batchesTarget.productId || (batchesTarget as any).id}&pageSize=100\`)`;

if (invSrc.includes(oldBatchFetch)) {
  invSrc = invSrc.replace(oldBatchFetch, newBatchFetch);
  console.log('✓ inventory.tsx: batchesTarget.productId || batchesTarget.id updated');
}

fs.writeFileSync(invPath, invSrc.replace(/\n/g, '\r\n'), 'utf8');

// 3. products.tsx
const prodPath = path.join(root, 'src/components/library/screens/products.tsx');
let prodSrc = fs.readFileSync(prodPath, 'utf8').replace(/\r\n/g, '\n');

const oldProdScreen = `export function ProductsScreen() {
  const t = useLibraryStore((s) => s.t)
  const money = useLibraryStore((s) => s.money)
  const has = useLibraryStore((s) => s.has)
  const status = useLibraryStore((s) => s.status)
  const { toast } = useToast()`;

const newProdScreen = `export function ProductsScreen() {
  const t = useLibraryStore((s) => s.t)
  const money = useLibraryStore((s) => s.money)
  const has = useLibraryStore((s) => s.has)
  const status = useLibraryStore((s) => s.status)
  const warningDays = Number(status?.inventory?.expiryWarningDays) || 30
  const { toast } = useToast()`;

if (prodSrc.includes(oldProdScreen)) {
  prodSrc = prodSrc.replace(oldProdScreen, newProdScreen);
  console.log('✓ products.tsx: warningDays declared in ProductsScreen');
}

fs.writeFileSync(prodPath, prodSrc.replace(/\n/g, '\r\n'), 'utf8');

// 4. diagnostics.tsx
const diagPath = path.join(root, 'src/components/library/screens/diagnostics.tsx');
let diagSrc = fs.readFileSync(diagPath, 'utf8').replace(/\r\n/g, '\n');

const oldDiagSet = `      const res = await api<DiagnosticsPayload>('/diagnostics')
      setData(res)
      useLibraryStore.setState({ status: res.status })`;

const newDiagSet = `      const res = await api<DiagnosticsPayload>('/diagnostics')
      setData(res)
      useLibraryStore.setState((s) => ({
        status: {
          ...s.status,
          ...res.status,
          hardwareCaps: { ...s.status?.hardwareCaps, ...res.status?.hardwareCaps },
          modules: { ...s.status?.modules, ...res.status?.modules },
        },
      }))`;

if (diagSrc.includes(oldDiagSet)) {
  diagSrc = diagSrc.replace(oldDiagSet, newDiagSet);
  console.log('✓ diagnostics.tsx: status hardwareCaps and modules shallow merge preserved');
}

fs.writeFileSync(diagPath, diagSrc.replace(/\n/g, '\r\n'), 'utf8');

console.log('===> ALL FRONTEND SOURCE FIXES APPLIED SUCCESSFULLY!');
