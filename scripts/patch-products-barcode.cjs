/**
 * Precision patch script for products.tsx to integrate inline Barcode Generate and Scan buttons.
 */
const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../src/components/library/screens/products.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// Normalize line endings for replacement and restore
const isCRLF = content.includes('\r\n');
let code = content.replace(/\r\n/g, '\n');

// 1. Add imports if not present
if (!code.includes("BarcodeScannerDialog")) {
  code = code.replace(
    "  Barcode,\n  Printer,\n} from 'lucide-react'",
    "  Barcode,\n  QrCode,\n  Printer,\n} from 'lucide-react'\nimport { BarcodeSvg } from '../parts/barcode'\nimport { generateUniqueBarcode } from '@/lib/library/barcode-gen'\nimport { BarcodeScannerDialog } from '../parts/barcode-scanner-dialog'"
  );
}

// 2. Check if Dialogs are attached to ProductFormDialog
if (!code.includes('<BarcodeScannerDialog')) {
  const targetPattern = /<DialogFooter className="gap-2">[\s\S]*?<\/DialogFooter>\s*<\/DialogContent>\s*<\/Dialog>/;
  const match = code.match(targetPattern);
  if (match) {
    const replacement = `        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('app.cancel')}
          </Button>
          <Button onClick={() => void submit()} disabled={saving || !canMutate}>
            {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t('app.save')}
          </Button>
        </DialogFooter>
      </DialogContent>

      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={(scanned) => {
          set('barcode', scanned)
          setScannerOpen(false)
          toast({
            title: isAr ? 'تم مسح الباركود بنجاح' : 'Barcode scanned successfully',
            description: scanned,
          })
        }}
        currentProductId={editing?.id}
        existingProducts={existingProducts}
        onOpenExistingProduct={(dupId) => {
          setScannerOpen(false)
          if (onOpenProduct) onOpenProduct(dupId)
        }}
      />

      <ConfirmDialog
        open={overwriteConfirmOpen}
        onOpenChange={setOverwriteConfirmOpen}
        title={isAr ? 'استبدال الباركود الحالي؟' : 'Replace current barcode?'}
        description={
          isAr
            ? \`الحقل يحتوي حالياً على الباركود "\${form.barcode}". هل تريد استبداله بكود عشوائي جديد؟\`
            : \`The barcode field currently contains "\${form.barcode}". Do you want to replace it with a newly generated code?\`
        }
        confirmLabel={isAr ? 'استبدال وتوليد كود جديد' : 'Replace & Generate'}
        cancelLabel={isAr ? 'إلغاء' : 'Cancel'}
        destructive={false}
        onConfirm={() => {
          setOverwriteConfirmOpen(false)
          executeBarcodeGeneration()
        }}
      />
    </Dialog>`;
    code = code.replace(match[0], replacement);
    console.log('✓ BarcodeScannerDialog & ConfirmDialog attached to ProductFormDialog');
  } else {
    console.error('Target pattern for DialogFooter not found');
  }
}

const finalOutput = isCRLF ? code.replace(/\n/g, '\r\n') : code;
fs.writeFileSync(targetPath, finalOutput, 'utf8');
console.log('✓ products.tsx update complete');
