const fs = require('fs');
const path = require('path');
const targetPath = path.resolve(__dirname, '../src/components/library/screens/products.tsx');
let code = fs.readFileSync(targetPath, 'utf8').replace(/\r\n/g, '\n');

const currentSig = `function ProductFormDialog({
  open,
  onOpenChange,
  editing,
  categories,
  units,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: ProductRow | null
  categories: CategoryItem[]
  units: string[]
  onSaved: () => void
}) {`;

const newSig = `function ProductFormDialog({
  open,
  onOpenChange,
  editing,
  categories,
  units,
  onSaved,
  existingProducts = [],
  onOpenProduct,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: ProductRow | null
  categories: CategoryItem[]
  units: string[]
  onSaved: () => void
  existingProducts?: { id: string; nameAr: string; sku: string; barcode: string | null }[]
  onOpenProduct?: (productId: string) => void
}) {`;

if (code.includes(currentSig)) {
  code = code.replace(currentSig, newSig);
  fs.writeFileSync(targetPath, code.replace(/\n/g, '\r\n'), 'utf8');
  console.log('✓ ProductFormDialog parameters updated');
} else {
  console.error('Signature not matched');
}
