const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const p = path.join(root, 'src', 'components', 'library', 'parts', 'labels.ts');
let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

c = c.replace(
  "EXPIRY_WRITEOFF: ['إعدام صلاحية', 'Expiry write-off'],",
  "EXPIRY_WRITEOFF: ['إعدام/تسوية مخزنية', 'Write-off adjustment'],"
);

const oldExpiryState = `export function expiryState(expiry: string | Date | null, warningDays: number): 'EXPIRED' | 'NEAR' | 'VALID' {
  if (!expiry) return 'VALID'
  const d = typeof expiry === 'string' ? new Date(expiry) : expiry
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const exp = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (exp < today) return 'EXPIRED'
  if ((exp.getTime() - today.getTime()) / 86400000 <= warningDays) return 'NEAR'
  return 'VALID'
}`;

const newExpiryState = `export function expiryState(_expiry: string | Date | null, _warningDays: number): 'VALID' {
  return 'VALID'
}`;

if (!c.includes(oldExpiryState)) {
  console.error('Error: oldExpiryState not found');
  process.exit(1);
}
c = c.replace(oldExpiryState, newExpiryState);

c = c.replace(/\n/g, '\r\n');
fs.writeFileSync(p, c, 'utf8');
console.log('✓ labels.ts updated');
