const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// ==========================================
// 1. Patch src/components/library/screens/products.tsx
// ==========================================
const productsTsxPath = path.join(root, 'src/components/library/screens/products.tsx');
if (fs.existsSync(productsTsxPath)) {
  let code = fs.readFileSync(productsTsxPath, 'utf8');

  // Convert to uniform \n for processing
  const isCrlf = code.includes('\r\n');
  code = code.replace(/\r\n/g, '\n');

  // Add computeNextSku if not present
  if (!code.includes('function computeNextSku(')) {
    const helperCode = `function computeNextSku(existingProducts?: { sku?: string }[]): string {
  const existingSet = new Set<string>()
  const seqNums: number[] = []
  ;(existingProducts || []).forEach((p) => {
    if (p && p.sku) {
      const s = String(p.sku).trim()
      existingSet.add(s.toUpperCase())
      const m = s.match(/^SKU-(\\d+)$/i)
      if (m) {
        const val = parseInt(m[1], 10)
        if (val > 0 && val < 500000) seqNums.push(val)
      }
    }
  })
  let nextNum = 1
  if (seqNums.length > 0) {
    nextNum = Math.max(...seqNums) + 1
  }
  let candidate = \`SKU-\${String(nextNum).padStart(4, '0')}\`
  while (existingSet.has(candidate.toUpperCase())) {
    nextNum++
    candidate = \`SKU-\${String(nextNum).padStart(4, '0')}\`
  }
  return candidate
}
`;
    code = code.replace(
      'function ProductFormDialog({',
      `${helperCode}\nfunction ProductFormDialog({`
    );
  }

  // Replace handleAutoSku
  const oldHandleAutoSkuRegex = /const handleAutoSku = \(\) => \{[\s\S]*?toast\(\{[\s\S]*?description: candidate,[\s\S]*?\}\)[\s\S]*?catch \(err\) \{[\s\S]*?\}\n  \}/;
  const newHandleAutoSku = `const handleAutoSku = () => {
    try {
      const fallbackSku = computeNextSku(existingProducts)
      set('sku', fallbackSku)
      api<{ nextSku: string }>('/products/next-sku')
        .then((r) => {
          if (r?.nextSku) {
            set('sku', r.nextSku)
            toast({
              title: isAr ? 'تم توليد كود SKU تلقائياً' : 'SKU generated successfully',
              description: r.nextSku,
            })
          }
        })
        .catch(() => {
          toast({
            title: isAr ? 'تم توليد كود SKU تلقائياً' : 'SKU generated successfully',
            description: fallbackSku,
          })
        })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: isAr ? 'تعذر توليد كود SKU' : 'Failed to generate SKU',
        description: errMessage(err),
      })
    }
  }`;

  if (oldHandleAutoSkuRegex.test(code)) {
    code = code.replace(oldHandleAutoSkuRegex, newHandleAutoSku);
  }

  // Update useEffect on open
  const oldEffectRegex = /useEffect\(\(\) => \{\s*if \(open\) \{\s*setForm\(editing \? rowToForm\(editing\) : emptyForm\(\)\)\s*setFormError\(null\)\s*\}\s*\}, \[open, editing\]\)/;
  const newEffect = `useEffect(() => {
    if (open) {
      if (editing) {
        setForm(rowToForm(editing))
      } else {
        const initialSku = computeNextSku(existingProducts)
        setForm({ ...emptyForm(), sku: initialSku })
        api<{ nextSku: string }>('/products/next-sku')
          .then((r) => {
            if (r?.nextSku) {
              setForm((f) => (!f.sku || f.sku.startsWith('SKU-') ? { ...f, sku: r.nextSku } : f))
            }
          })
          .catch(() => {})
      }
      setFormError(null)
    }
  }, [open, editing])`;

  code = code.replace(oldEffectRegex, newEffect);
  code = code.replace('placeholder="SKU-001"', 'placeholder="SKU-0001"');

  if (isCrlf) {
    code = code.replace(/\n/g, '\r\n');
  }

  fs.writeFileSync(productsTsxPath, code, 'utf8');
  console.log('✓ Successfully patched src/components/library/screens/products.tsx');
}

// ==========================================
// 2. Patch compiled client chunks
// ==========================================
const chunkFiles = [
  path.join(root, 'out/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(root, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js')
];

for (const chunkPath of chunkFiles) {
  if (!fs.existsSync(chunkPath)) {
    console.log('Skipping missing chunk:', chunkPath);
    continue;
  }
  let js = fs.readFileSync(chunkPath, 'utf8');

  // Patch auto-SKU button
  const oldBtn = 'onClick:()=>{let n="SKU-"+String(Math.floor(1000+Math.random()*9000));x("sku",n)}';
  const newBtn = 'onClick:()=>{T("/products/next-sku").then(t=>{if(t&&t.nextSku){x("sku",t.nextSku);l({title:"تم توليد كود SKU تلقائياً",description:t.nextSku})}}).catch(()=>{let n="SKU-0001";x("sku",n);l({title:"تم توليد كود SKU تلقائياً",description:n})})}';

  if (js.includes(oldBtn)) {
    js = js.replace(oldBtn, newBtn);
    console.log('✓ Replaced random SKU generator with sequential API call in', chunkPath);
  } else {
    console.log('ℹ Random SKU button already patched in', chunkPath);
  }

  // Patch modal open useEffect
  const oldEffectChunk = '(0,k.useEffect)(()=>{e&&(u(r?{sku:r.sku,nameAr:r.nameAr,nameEn:r.nameEn??"",genericName:r.genericName??"",barcode:r.barcode??"",categoryId:r.categoryId??"none",manufacturer:r.manufacturer??"",unit:r.unit,packSize:String(r.packSize),isWeighable:!!r.isWeighable,purchasePrice:String(r.purchasePrice),sellingPrice:String(r.sellingPrice),minSellingPrice:null!=r.minSellingPrice?String(r.minSellingPrice):"",taxRate:String(r.taxRate),reorderLevel:String(r.reorderLevel),active:r.active,notes:""}:k_()),f(null))},[e,r])';
  const newEffectChunk = '(0,k.useEffect)(()=>{e&&(r?u({sku:r.sku,nameAr:r.nameAr,nameEn:r.nameEn??"",genericName:r.genericName??"",barcode:r.barcode??"",categoryId:r.categoryId??"none",manufacturer:r.manufacturer??"",unit:r.unit,packSize:String(r.packSize),isWeighable:!!r.isWeighable,purchasePrice:String(r.purchasePrice),sellingPrice:String(r.sellingPrice),minSellingPrice:null!=r.minSellingPrice?String(r.minSellingPrice):"",taxRate:String(r.taxRate),reorderLevel:String(r.reorderLevel),active:r.active,notes:""}):(u(k_()),T("/products/next-sku").then(t=>{t&&t.nextSku&&x("sku",t.nextSku)}).catch(()=>{x("sku","SKU-0001")})),f(null))},[e,r])';

  if (js.includes(oldEffectChunk)) {
    js = js.replace(oldEffectChunk, newEffectChunk);
    console.log('✓ Patched modal open useEffect in', chunkPath);
  } else {
    console.log('ℹ Modal open useEffect already patched in', chunkPath);
  }

  // Patch placeholder
  if (js.includes('placeholder:"SKU-001"')) {
    js = js.replace(/placeholder:"SKU-001"/g, 'placeholder:"SKU-0001"');
    console.log('✓ Updated placeholder to SKU-0001 in', chunkPath);
  }

  fs.writeFileSync(chunkPath, js, 'utf8');
}
