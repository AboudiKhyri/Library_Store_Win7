/**
 * scripts/patch-add-settings-reset-button.cjs
 * Adds "إعادة التعيين" (Reset) button next to "حفظ التغييرات" across Settings screen tabs
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
console.log('=== ADDING RESET BUTTON TO SETTINGS SCREEN ===');

// 1. Patch src/components/library/screens/settings.tsx
const settingsTsxPath = path.join(root, 'src/components/library/screens/settings.tsx');
let settingsTsx = fs.readFileSync(settingsTsxPath, 'utf8');

// 1.1 Add RotateCcw import if not present
if (!settingsTsx.includes('RotateCcw,')) {
  settingsTsx = settingsTsx.replace(
    "import {\n  Building2,",
    "import {\n  RotateCcw,\n  Building2,"
  );
  if (!settingsTsx.includes('RotateCcw,')) {
    settingsTsx = settingsTsx.replace(
      "import {\r\n  Building2,",
      "import {\r\n  RotateCcw,\r\n  Building2,"
    );
  }
  console.log('✓ Added RotateCcw import in settings.tsx');
}

// 1.2 Add DEFAULT_SETTINGS and resetSection if not present
const defaultSettingsCode = `
const DEFAULT_SETTINGS: Record<SectionKey, any> = {
  business: {
    businessName: 'Library Store',
    displayName: 'Library Store',
    owner: '',
    address: '',
    phone: '',
    phone2: '',
    email: '',
    taxId: '',
    receiptHeader: '',
    receiptFooter: '',
    notes: '',
  },
  branding: {
    primary: '#00c8e0',
    primaryColor: '#00c8e0',
    secondary: '#14b8a6',
    accent: '#22d3ee',
    appName: 'Library Store',
    logoDataUrl: null,
    defaultTheme: 'light',
  },
  pos: {
    currency: 'EGP',
    currencySymbol: 'ج.م',
    allowDiscount: true,
    maxDiscountPercent: 20,
    lowStockThreshold: 5,
    receiptCopies: 1,
    defaultPaymentMethod: 'cash',
    paymentMethods: ['cash', 'card', 'wallet'],
    units: ['piece', 'kg', 'box', 'liter', 'pack', 'dozen'],
    weightQtyDecimals: 3,
    loyalty: {
      enabled: false,
      earnRatePer100: 5,
      pointValueEgp: 1,
      maxRedeemShare: 50,
      minRedeemPoints: 10,
    },
  },
  hardware: {
    printerEnabled: false,
    printerName: '',
    paperWidth: 80,
    scannerEnabled: true,
    scannerSuffix: 'Enter',
    scannerMinIntervalMs: 50,
    cashDrawerEnabled: false,
  },
  backup: {
    autoBackupEnabled: false,
    intervalHours: 24,
    retentionCount: 7,
  },
  localization: {
    language: 'ar',
    timezone: 'Africa/Cairo',
    numberFormat: 'latn',
  },
}
`;

if (!settingsTsx.includes('const DEFAULT_SETTINGS')) {
  const insertTarget = 'function snapshot(s: SettingsPayload)';
  settingsTsx = settingsTsx.replace(insertTarget, defaultSettingsCode + '\n' + insertTarget);
  console.log('✓ Added DEFAULT_SETTINGS object in settings.tsx');
}

// 1.3 Add resetSection in SettingsScreen
const resetFnCode = `  const resetSection = (key: SectionKey) => {
    if (!DEFAULT_SETTINGS[key]) return
    setCfg((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        [key]: JSON.parse(JSON.stringify(DEFAULT_SETTINGS[key])),
      }
    })
    toast({
      title: L('تمت استعادة الإعدادات الافتراضية', 'Default settings restored'),
      description: L('تمت استعادة القيم الافتراضية لهذا القسم. اضغط "حفظ التغييرات" لتطبيقها.', 'Default values restored. Click "Save changes" to apply.'),
    })
  }
`;

if (!settingsTsx.includes('const resetSection =')) {
  const noPermTarget = "const noPermHint = L('لا تملك صلاحية تعديل الإعدادات', 'No settings permission')";
  settingsTsx = settingsTsx.replace(noPermTarget, resetFnCode + '\n  ' + noPermTarget);
  console.log('✓ Added resetSection() handler in settings.tsx');
}

// 1.4 Update SaveRow component definition
const oldSaveRow = `function SaveRow({
  disabled,
  saving,
  onSave,
  hint,
  L,
}: {
  disabled: boolean
  saving: boolean
  onSave: () => void
  hint?: string
  L: LFn
}) {
  return (
    <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
      {hint && <p className="text-xs text-muted-foreground sm:me-auto">{hint}</p>}
      <Button onClick={onSave} disabled={disabled || saving} className="min-h-11 sm:min-h-9">
        {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
        {L('حفظ التغييرات', 'Save changes')}
      </Button>
    </div>
  )
}`;

const newSaveRow = `function SaveRow({
  disabled,
  saving,
  onSave,
  onReset,
  hint,
  L,
}: {
  disabled: boolean
  saving: boolean
  onSave: () => void
  onReset?: () => void
  hint?: string
  L: LFn
}) {
  return (
    <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
      {hint && <p className="text-xs text-muted-foreground sm:me-auto">{hint}</p>}
      {onReset && (
        <Button
          type="button"
          variant="outline"
          onClick={onReset}
          disabled={saving}
          className="min-h-11 sm:min-h-9 border-muted-foreground/30 hover:bg-muted"
        >
          <RotateCcw className="me-2 h-4 w-4" />
          {L('إعادة التعيين', 'Reset')}
        </Button>
      )}
      <Button onClick={onSave} disabled={disabled || saving} className="min-h-11 sm:min-h-9">
        {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
        {L('حفظ التغييرات', 'Save changes')}
      </Button>
    </div>
  )
}`;

const normSettings = settingsTsx.replace(/\r\n/g, '\n');
const normOldSaveRow = oldSaveRow.replace(/\r\n/g, '\n');
if (normSettings.includes(normOldSaveRow)) {
  const isCrlf = settingsTsx.includes('\r\n');
  const rep = newSaveRow.replace(/\r\n/g, '\n');
  const replaced = normSettings.replace(normOldSaveRow, rep);
  settingsTsx = isCrlf ? replaced.replace(/\n/g, '\r\n') : replaced;
  console.log('✓ Updated SaveRow component in settings.tsx with onReset button');
}

// 1.5 Add onReset to SaveRow usages in settings.tsx
const tabs = ['business', 'branding', 'pos', 'hardware', 'backup', 'localization'];
for (const tab of tabs) {
  const oldCall = `saving={saving === '${tab}'}\n            onSave=`;
  const oldCallCrlf = `saving={saving === '${tab}'}\r\n            onSave=`;
  const newCall = `saving={saving === '${tab}'}\n            onReset={() => resetSection('${tab}')}\n            onSave=`;
  const newCallCrlf = `saving={saving === '${tab}'}\r\n            onReset={() => resetSection('${tab}')}\r\n            onSave=`;

  if (settingsTsx.includes(oldCallCrlf)) {
    settingsTsx = settingsTsx.replace(oldCallCrlf, newCallCrlf);
  } else if (settingsTsx.includes(oldCall)) {
    settingsTsx = settingsTsx.replace(oldCall, newCall);
  }
}

fs.writeFileSync(settingsTsxPath, settingsTsx, 'utf8');
console.log('✓ Successfully wrote updated ' + settingsTsxPath);

// 2. Patch out/_next/static/chunks/18yoqc7d05wnq.js
const outChunkPath = path.join(root, 'out/_next/static/chunks/18yoqc7d05wnq.js');
let chunkContent = fs.readFileSync(outChunkPath, 'utf8');

// 2.1 Update DS (SaveRow) definition in chunk
const oldDs = 'function DS({disabled:e,saving:t,onSave:r,hint:n,L:a}){return(0,N.jsxs)("div",{className:"mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end",children:[n&&(0,N.jsx)("p",{className:"text-xs text-muted-foreground sm:me-auto",children:n}),(0,N.jsxs)(F.Button,{onClick:r,disabled:e||t,className:"min-h-11 sm:min-h-9",children:[t?(0,N.jsx)(kS,{className:"me-2 h-4 w-4 animate-spin"}):(0,N.jsx)(Dg,{className:"me-2 h-4 w-4"}),a("حفظ التغييرات","Save changes")]})]})}';

const newDs = 'function DS({disabled:e,saving:t,onSave:r,onReset:_rst,hint:n,L:a}){return(0,N.jsxs)("div",{className:"mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end",children:[n&&(0,N.jsx)("p",{className:"text-xs text-muted-foreground sm:me-auto",children:n}),_rst&&(0,N.jsxs)(F.Button,{type:"button",variant:"outline",onClick:_rst,disabled:t,className:"min-h-11 sm:min-h-9 border-muted-foreground/30 hover:bg-muted",children:[(0,N.jsx)(om,{className:"me-2 h-4 w-4"}),a("إعادة التعيين","Reset")]}),(0,N.jsxs)(F.Button,{onClick:r,disabled:e||t,className:"min-h-11 sm:min-h-9",children:[t?(0,N.jsx)(kS,{className:"me-2 h-4 w-4 animate-spin"}):(0,N.jsx)(Dg,{className:"me-2 h-4 w-4"}),a("حفظ التغييرات","Save changes")]})]})}';

if (chunkContent.includes(oldDs)) {
  chunkContent = chunkContent.replace(oldDs, newDs);
  console.log('✓ Patched DS (SaveRow) definition in chunk');
} else if (chunkContent.includes('onReset:_rst')) {
  console.log('ℹ DS definition already patched in chunk');
} else {
  throw new Error('oldDs not found in ' + outChunkPath);
}

// 2.2 Declare _rst helper in SettingsScreen in chunk
const targetBeforeDsCalls = 'let j=(0,k.useMemo)(()=>{if(!l||!u)return{};let e=DN(l);return Dk.reduce((t,r)=>(t[r]=e[r]!==u[r],t),{})},[l,u]);';

const rstCode = `let _rst=k=>()=>{let D={business:{businessName:"Library Store",displayName:"Library Store",owner:"",address:"",phone:"",phone2:"",email:"",taxId:"",receiptHeader:"",receiptFooter:"",notes:""},branding:{primary:"#00c8e0",primaryColor:"#00c8e0",secondary:"#14b8a6",accent:"#22d3ee",appName:"Library Store",logoDataUrl:null,defaultTheme:"light"},pos:{currency:"EGP",currencySymbol:"ج.م",allowDiscount:!0,maxDiscountPercent:20,lowStockThreshold:5,receiptCopies:1,defaultPaymentMethod:"cash",paymentMethods:["cash","card","wallet"],units:["piece","kg","box","liter","pack","dozen"],weightQtyDecimals:3,loyalty:{enabled:!1,earnRatePer100:5,pointValueEgp:1,maxRedeemShare:50,minRedeemPoints:10}},hardware:{printerEnabled:!1,printerName:"",paperWidth:80,scannerEnabled:!0,scannerSuffix:"Enter",scannerMinIntervalMs:50,cashDrawerEnabled:!1},backup:{autoBackupEnabled:!1,intervalHours:24,retentionCount:7},localization:{language:"ar",timezone:"Africa/Cairo",numberFormat:"latn"}};if(D[k])c(e=>e?{...e,[k]:JSON.parse(JSON.stringify(D[k]))}:e),s({title:o("تمت استعادة الإعدادات الافتراضية","Default settings restored"),description:o("تمت استعادة القيم الافتراضية لهذا القسم. اضغط حفظ التغييرات لتطبيقها.","Default values restored. Click save changes to apply.")});};`;

if (!chunkContent.includes('let _rst=')) {
  chunkContent = chunkContent.replace(targetBeforeDsCalls, targetBeforeDsCalls + rstCode);
  console.log('✓ Injected _rst helper into SettingsScreen in chunk');
}

// 2.3 Pass onReset to all 6 DS invocations in chunk
for (const tab of tabs) {
  const oldCall = `saving:"${tab}"===f,onSave:`;
  const newCall = `saving:"${tab}"===f,onReset:_rst("${tab}"),onSave:`;
  if (chunkContent.includes(oldCall)) {
    chunkContent = chunkContent.replace(oldCall, newCall);
    console.log(`✓ Added onReset:_rst("${tab}") to DS invocation in chunk`);
  }
}

fs.writeFileSync(outChunkPath, chunkContent, 'utf8');
console.log('✓ Successfully wrote updated ' + outChunkPath);

// 3. Verify syntax
execSync(`"${process.execPath}" -c "${outChunkPath}"`, { stdio: 'inherit' });
console.log('✓ Verified chunk syntax with node -c');

// 4. Mirror to dist-desktop
const targets = [
  path.join(root, 'dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js'),
  path.join(root, 'dist-desktop/win-unpacked/resources/out/_next/static/chunks/18yoqc7d05wnq.js')
];

for (const dest of targets) {
  if (fs.existsSync(path.dirname(dest))) {
    fs.copyFileSync(outChunkPath, dest);
    console.log(`✓ Copied patched chunk to ${dest}`);
  }
}

console.log('=== SETTINGS RESET BUTTON PATCH COMPLETE ===');
