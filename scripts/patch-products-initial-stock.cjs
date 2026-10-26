const fs = require('fs');
const path = require('path');

const targets = [
  path.resolve(__dirname, '../src/components/library/screens/products.tsx'),
  path.resolve(__dirname, '../../src/components/library/screens/products.tsx'),
];

targets.forEach((filePath) => {
  if (!fs.existsSync(filePath)) {
    console.warn('File not found, skipping:', filePath);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  const isCRLF = content.includes('\r\n');
  let code = content.replace(/\r\n/g, '\n');

  // 1. Update ProductFormValues
  if (!code.includes('initialStock: string')) {
    code = code.replace(
      '  isWeighable: boolean\n  purchasePrice: string',
      '  isWeighable: boolean\n  initialStock: string\n  purchasePrice: string'
    );
  }

  // 2. Update emptyForm
  if (!code.includes("initialStock: '',")) {
    code = code.replace(
      "    isWeighable: false,\n    purchasePrice: '0',",
      "    isWeighable: false,\n    initialStock: '',\n    purchasePrice: '0',"
    );
  }

  // 3. Update rowToForm
  if (!code.includes("initialStock: '',\n    purchasePrice: String(row.purchasePrice),")) {
    code = code.replace(
      '    isWeighable: !!row.isWeighable,\n    purchasePrice: String(row.purchasePrice),',
      "    isWeighable: !!row.isWeighable,\n    initialStock: '',\n    purchasePrice: String(row.purchasePrice),"
    );
  }

  // 4. Update submit function
  const submitTarget = `    const reorder = parseNumber(form.reorderLevel, 'حد إعادة الطلب', { min: 0, max: 1_000_000, int: true })
    if (typeof reorder === 'string') return setFormError(reorder)
    const tax = parseNumber(form.taxRate, 'نسبة الضريبة', { min: 0, max: 100 })
    if (typeof tax === 'string') return setFormError(tax)`;

  const submitReplacement = `    const reorder = parseNumber(form.reorderLevel, 'حد إعادة الطلب', { min: 0, max: 1_000_000, int: true })
    if (typeof reorder === 'string') return setFormError(reorder)
    const tax = parseNumber(form.taxRate, 'نسبة الضريبة', { min: 0, max: 100 })
    if (typeof tax === 'string') return setFormError(tax)

    let initialQty = 0
    if (!editing && form.initialStock.trim() !== '') {
      const parsed = parseNumber(form.initialStock, 'العدد المبدئي الموجود في المخزن', {
        min: 0,
        max: 10_000_000,
        int: !form.isWeighable,
      })
      if (typeof parsed === 'string') return setFormError(parsed)
      initialQty = parsed
    }`;

  if (code.includes(submitTarget) && !code.includes('العدد المبدئي الموجود في المخزن')) {
    code = code.replace(submitTarget, submitReplacement);
  }

  // 5. Add initialStock to body payload
  const bodyTarget = `      reorderLevel: reorder,
      active: form.active,
      notes: form.notes.trim() || null,
    }`;

  const bodyReplacement = `      reorderLevel: reorder,
      initialStock: !editing && initialQty > 0 ? initialQty : 0,
      active: form.active,
      notes: form.notes.trim() || null,
    }`;

  if (code.includes(bodyTarget) && !code.includes('initialStock: !editing')) {
    code = code.replace(bodyTarget, bodyReplacement);
  }

  // 6. Add initialStock field JSX right after pf-reorder
  const jsxTarget = `          <div className="space-y-1.5">
            <Label htmlFor="pf-reorder">{t('products.reorderLevel')}</Label>
            <Input
              id="pf-reorder"
              value={form.reorderLevel}
              onChange={(e) => set('reorderLevel', e.target.value)}
              className={numInputCls}
              inputMode="numeric"
            />
          </div>`;

  const jsxReplacement = `          <div className="space-y-1.5">
            <Label htmlFor="pf-reorder">{t('products.reorderLevel')}</Label>
            <Input
              id="pf-reorder"
              value={form.reorderLevel}
              onChange={(e) => set('reorderLevel', e.target.value)}
              className={numInputCls}
              inputMode="numeric"
            />
          </div>
          {!editing && (
            <div className="space-y-1.5">
              <Label htmlFor="pf-initialStock">
                {isAr ? 'العدد المبدئي الموجود في المخزن' : 'Initial Stock Quantity'}{' '}
                <span className="text-muted-foreground">({t('app.optional')})</span>
              </Label>
              <Input
                id="pf-initialStock"
                value={form.initialStock}
                onChange={(e) => set('initialStock', e.target.value)}
                placeholder="0"
                className={numInputCls}
                inputMode={form.isWeighable ? 'decimal' : 'numeric'}
                disabled={!canMutate}
              />
            </div>
          )}`;

  if (code.includes(jsxTarget) && !code.includes('pf-initialStock')) {
    code = code.replace(jsxTarget, jsxReplacement);
  }

  const finalContent = isCRLF ? code.replace(/\n/g, '\r\n') : code;
  fs.writeFileSync(filePath, finalContent, 'utf8');
  console.log('✓ Successfully patched:', filePath);
});
