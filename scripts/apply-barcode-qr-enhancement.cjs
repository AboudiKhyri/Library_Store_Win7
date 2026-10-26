const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

console.log('=== APPLYING BARCODE / QR SQUARE BUTTONS & NAME+PRICE GENERATION ===');

// ==========================================
// 1. Update CSS in globals.css, out, and dist-desktop
// ==========================================
const cssRule = `
/* Square Barcode & QR Action Buttons with Border Radius */
.btn-barcode-generate,
.btn-barcode-scan {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 44px !important;
  min-width: 44px !important;
  max-width: 44px !important;
  height: 44px !important;
  min-height: 44px !important;
  max-height: 44px !important;
  border-radius: 12px !important;
  flex-shrink: 0 !important;
  box-sizing: border-box !important;
  aspect-ratio: 1 / 1 !important;
  cursor: pointer !important;
}

.btn-barcode-generate svg,
.btn-barcode-scan svg {
  width: 22px !important;
  height: 22px !important;
  flex-shrink: 0 !important;
}
`;

const cssFiles = [
  path.join(root, 'src/app/globals.css'),
  path.join(root, 'out/_next/static/chunks/3oa5e4nmj08il.css'),
  path.join(root, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/3oa5e4nmj08il.css')
];

for (const fp of cssFiles) {
  if (!fs.existsSync(fp)) continue;
  let css = fs.readFileSync(fp, 'utf8');

  // Replace or inject square sizing
  if (!css.includes('Square Barcode & QR Action Buttons')) {
    css += '\n' + cssRule;
  }
  fs.writeFileSync(fp, css, 'utf8');
  console.log('✓ Injected square button sizing & radius in', path.basename(fp));
}

// ==========================================
// 2. Update src/lib/library/barcode-gen.ts
// ==========================================
const barcodeGenTs = path.join(root, 'src/lib/library/barcode-gen.ts');
if (fs.existsSync(barcodeGenTs)) {
  let ts = fs.readFileSync(barcodeGenTs, 'utf8');
  if (!ts.includes('function generateBarcodeFromNameAndPrice(')) {
    const helpers = `
/**
 * Generates an in-store EAN-13 barcode deterministically derived from product name and price.
 * - Digits 1-2: 20 (standard in-store retail prefix)
 * - Digits 3-7: 5-digit deterministic hash from nameAr
 * - Digits 8-12: 5-digit price in integer currency units
 * - Digit 13: GS1 EAN-13 check digit
 */
export function generateBarcodeFromNameAndPrice(
  nameAr: string,
  price: unknown,
  existingBarcodes: Set<string> | string[] = new Set()
): string {
  const set = existingBarcodes instanceof Set ? existingBarcodes : new Set(existingBarcodes || []);
  const nameStr = (nameAr || '').trim();
  let hash = 5381;
  for (let i = 0; i < nameStr.length; i++) {
    hash = ((hash << 5) + hash) + nameStr.charCodeAt(i);
    hash = hash & hash;
  }
  const nameNum = Math.abs(hash) % 90000 + 10000;
  const p = Math.max(0, Math.min(99999, Math.round(parseFloat(String(price || 0)) || 0)));
  const priceDigits = String(p).padStart(5, '0');

  let attempt = 0;
  while (attempt < 100) {
    const nameDigits = String((nameNum + attempt) % 90000 + 10000).padStart(5, '0');
    const payload12 = '20' + nameDigits + priceDigits;
    const checkDigit = calculateEan13CheckDigit(payload12);
    const candidate = payload12 + checkDigit.toString();
    if (!set.has(candidate)) {
      return candidate;
    }
    attempt++;
  }
  return '20' + String(Date.now()).slice(-10) + '0';
}

/**
 * Generates a structured QR code identifier derived from product name, price, and SKU.
 */
export function generateQrFromNameAndPrice(
  nameAr: string,
  price: unknown,
  sku?: string
): string {
  const nameStr = (nameAr || '').trim();
  let hash = 5381;
  for (let i = 0; i < nameStr.length; i++) {
    hash = ((hash << 5) + hash) + nameStr.charCodeAt(i);
    hash = hash & hash;
  }
  const nameCode = String(Math.abs(hash) % 9000 + 1000);
  const p = Math.max(0, Math.min(99999, Math.round(parseFloat(String(price || 0)) || 0)));
  const skuTag = (sku || 'SKU').replace(/[^a-zA-Z0-9]/g, '');
  return \`QR-\${skuTag}-\${nameCode}-P\${p}\`;
}
`;
    ts += helpers;
    fs.writeFileSync(barcodeGenTs, ts, 'utf8');
    console.log('✓ Added name & price barcode/QR generators to barcode-gen.ts');
  }
}

// ==========================================
// 3. Update src/components/library/screens/products.tsx
// ==========================================
const productsTsx = path.join(root, 'src/components/library/screens/products.tsx');
if (fs.existsSync(productsTsx)) {
  let tsx = fs.readFileSync(productsTsx, 'utf8');
  const isCrlf = tsx.includes('\r\n');
  tsx = tsx.replace(/\r\n/g, '\n');

  // Ensure imports
  if (!tsx.includes('generateBarcodeFromNameAndPrice')) {
    tsx = tsx.replace(
      "import { generateUniqueBarcode } from '@/lib/library/barcode-gen'",
      "import { generateUniqueBarcode, generateBarcodeFromNameAndPrice, generateQrFromNameAndPrice } from '@/lib/library/barcode-gen'"
    );
  }

  // Update handleGenerateBarcode
  const oldGenBarcodeRegex = /const executeBarcodeGeneration = \(\) => \{[\s\S]*?const handleGenerateBarcode = \(\) => \{[\s\S]*?executeBarcodeGeneration\(\)\s*\}/;

  const newBarcodeHandlers = `const handleGenerateBarcode = () => {
    if (!form.nameAr.trim()) {
      toast({
        variant: 'destructive',
        title: isAr ? 'يرجى إدخال اسم الصنف أولاً' : 'Please enter product name first',
        description: isAr ? 'يتم إنشاء الباركود بناءً على اسم الصنف وسعر البيع' : 'Barcode is generated based on product name and price',
      })
      const el = document.getElementById('pf-nameAr')
      if (el) el.focus()
      return
    }
    try {
      const knownBarcodes = new Set<string>()
      existingProducts.forEach((p) => {
        if (p.barcode) knownBarcodes.add(p.barcode)
      })
      const generated = generateBarcodeFromNameAndPrice(form.nameAr, form.sellingPrice, knownBarcodes)
      set('barcode', generated)
      toast({
        title: isAr ? 'تم إنشاء كود الباركود بنجاح' : 'Barcode generated successfully',
        description: \`\${form.nameAr} (\${form.sellingPrice ? form.sellingPrice + ' ج.م' : 'بدون سعر'}) → \${generated}\`,
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: isAr ? 'تعذر توليد الباركود' : 'Failed to generate barcode',
        description: errMessage(err),
      })
    }
  }

  const handleGenerateQr = () => {
    if (!form.nameAr.trim()) {
      toast({
        variant: 'destructive',
        title: isAr ? 'يرجى إدخال اسم الصنف أولاً' : 'Please enter product name first',
        description: isAr ? 'يتم إنشاء رمز QR بناءً على اسم الصنف وسعر البيع' : 'QR code is generated based on product name and price',
      })
      const el = document.getElementById('pf-nameAr')
      if (el) el.focus()
      return
    }
    try {
      const generated = generateQrFromNameAndPrice(form.nameAr, form.sellingPrice, form.sku)
      set('barcode', generated)
      toast({
        title: isAr ? 'تم إنشاء كود QR بنجاح' : 'QR code generated successfully',
        description: \`\${form.nameAr} (\${form.sellingPrice ? form.sellingPrice + ' ج.م' : 'بدون سعر'}) → \${generated}\`,
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: isAr ? 'تعذر توليد كود QR' : 'Failed to generate QR',
        description: errMessage(err),
      })
    }
  }`;

  if (oldGenBarcodeRegex.test(tsx)) {
    tsx = tsx.replace(oldGenBarcodeRegex, newBarcodeHandlers);
  }

  // Update QR button beside barcode to call handleGenerateQr
  const oldQrBtnRegex = /<button\s+type="button"\s+onClick=\{\(\) => setScannerOpen\(true\)\}\s+disabled=\{!canMutate\}\s+aria-label=\{isAr \? 'مسح باركود \/ QR' : 'Scan Barcode \/ QR'\}[\s\S]*?<\/button>/;

  const newQrBtn = `<button
                type="button"
                onClick={handleGenerateQr}
                disabled={!canMutate}
                aria-label={isAr ? 'إنشاء كود QR مبني على اسم الصنف والسعر' : 'Generate QR Code based on Name & Price'}
                title={isAr ? 'إنشاء كود QR مبني على اسم الصنف والسعر' : 'Generate QR Code based on Name & Price'}
                className="btn-barcode-scan h-11 w-11 rounded-xl shrink-0 cursor-pointer"
              >
                <QrCode className="h-5 w-5" />
              </button>`;

  if (oldQrBtnRegex.test(tsx)) {
    tsx = tsx.replace(oldQrBtnRegex, newQrBtn);
  }

  if (isCrlf) tsx = tsx.replace(/\n/g, '\r\n');
  fs.writeFileSync(productsTsx, tsx, 'utf8');
  console.log('✓ Patched products.tsx with Barcode & QR handlers based on name + price');
}

// ==========================================
// 4. Update compiled client chunks: out and dist-desktop
// ==========================================
const chunkFiles = [
  path.join(root, 'out/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(root, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js')
];

for (const cp of chunkFiles) {
  if (!fs.existsSync(cp)) continue;
  let js = fs.readFileSync(cp, 'utf8');

  // Replace random barcode generator with name & price barcode generator
  const oldBarcodeGen = 'onClick:()=>{let d="200";for(let i=0;i<9;i++)d+=Math.floor(Math.random()*10);let m=0;for(let i=0;i<12;i++)m+=parseInt(d[i],10)*(i%2===0?1:3);x("barcode",d+((10-(m%10))%10))}';

  const newBarcodeGen = 'onClick:()=>{if(!c.nameAr||!c.nameAr.trim()){l({variant:"destructive",title:"يرجى كتابة اسم الصنف أولاً",description:"يتم إنشاء الكود بناءً على اسم الصنف وسعر البيع"});return}let h=5381,str=c.nameAr.trim();for(let i=0;i<str.length;i++)h=((h<<5)+h)+str.charCodeAt(i);let nameCode=String(Math.abs(h)%90000+10000);let priceVal=Math.min(99999,Math.max(0,Math.round(parseFloat(c.sellingPrice)||0)));let priceCode=String(priceVal).padStart(5,"0");let d="20"+nameCode+priceCode;let sum=0;for(let i=0;i<12;i++)sum+=parseInt(d[i],10)*(i%2===0?1:3);let rem=sum%10;let cd=rem===0?0:10-rem;let finalBarcode=d+String(cd);x("barcode",finalBarcode);l({title:"تم إنشاء كود الباركود بنجاح",description:`${c.nameAr} (${c.sellingPrice||0} ج.م) → ${finalBarcode}`})}';

  if (js.includes(oldBarcodeGen)) {
    js = js.replace(oldBarcodeGen, newBarcodeGen);
    console.log('✓ Replaced random barcode generator with name+price generator in', path.basename(cp));
  } else {
    console.log('ℹ Random barcode generator already updated or not found in', path.basename(cp));
  }

  // Replace prompt barcode scan with name & price QR generator
  const oldScanPrompt = 'onClick:()=>{let s=window.prompt("مسح أو إدخال باركود / Scan or enter barcode:");if(s&&s.trim())x("barcode",s.trim())}';

  const newQrGen = 'onClick:()=>{if(!c.nameAr||!c.nameAr.trim()){l({variant:"destructive",title:"يرجى كتابة اسم الصنف أولاً",description:"يتم إنشاء رمز QR بناءً على اسم الصنف وسعر البيع"});return}let h=5381,str=c.nameAr.trim();for(let i=0;i<str.length;i++)h=((h<<5)+h)+str.charCodeAt(i);let nameCode=String(Math.abs(h)%9000+1000);let priceVal=Math.min(99999,Math.max(0,Math.round(parseFloat(c.sellingPrice)||0)));let skuTag=(c.sku||"SKU").replace(/[^a-zA-Z0-9]/g,"");let qrCode="QR-"+skuTag+"-"+nameCode+"-P"+priceVal;x("barcode",qrCode);l({title:"تم إنشاء كود QR بنجاح",description:`${c.nameAr} (${c.sellingPrice||0} ج.م) → ${qrCode}`})}';

  if (js.includes(oldScanPrompt)) {
    js = js.replace(oldScanPrompt, newQrGen);
    console.log('✓ Replaced scan prompt with name+price QR generator in', path.basename(cp));
  } else {
    console.log('ℹ Scan prompt already updated or not found in', path.basename(cp));
  }

  // Update button titles
  js = js.replace(/title:"توليد كود عشوائي"/g, 'title:"إنشاء باركود مبني على اسم الصنف والسعر"');
  js = js.replace(/aria-label:"توليد كود عشوائي"/g, 'aria-label:"إنشاء باركود مبني على اسم الصنف والسعر"');
  js = js.replace(/title:"مسح باركود \/ QR"/g, 'title:"إنشاء كود QR مبني على اسم الصنف والسعر"');
  js = js.replace(/aria-label:"مسح باركود \/ QR"/g, 'aria-label:"إنشاء كود QR مبني على اسم الصنف والسعر"');

  fs.writeFileSync(cp, js, 'utf8');
}

console.log('=== BARCODE / QR ENHANCEMENT COMPLETE ===');
