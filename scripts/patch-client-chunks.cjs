const fs = require('fs');
const path = require('path');

const chunkPath = path.resolve(__dirname, '../out/_next/static/chunks/18yoqc7d05wnq.js');
let content = fs.readFileSync(chunkPath, 'utf8');

// 1. Batches tab productId fallback
const oldBatches = '`/inventory/batches?productId=${C.productId}&pageSize=100`';
const newBatches = '`/inventory/batches?productId=${C.productId||C.id}&pageSize=100`';
if (content.includes(oldBatches)) {
  content = content.replace(oldBatches, newBatches);
  console.log('✓ 18yoqc7d05wnq.js: C.productId || C.id fallback applied');
}

// 2. Suspended cart resume dialog array guard
const oldDialogCart = '[(e.cart??[]).length," صنف ·"," ",t(I((e.cart??[]).reduce(';
const newDialogCart = '[(Array.isArray(e.cart)?e.cart:[]).length," صنف ·"," ",t(I((Array.isArray(e.cart)?e.cart:[]).reduce(';
if (content.includes(oldDialogCart)) {
  content = content.replace(oldDialogCart, newDialogCart);
  console.log('✓ 18yoqc7d05wnq.js: suspended dialog Array.isArray guard applied');
}

// 3. restoreSuspended filter array guard
const oldRestoreFilter = 'async function tt(e){U((e.cart??[]).filter(';
const newRestoreFilter = 'async function tt(e){let _c=Array.isArray(e.cart)?e.cart:(typeof e.cart==="string"?JSON.parse(e.cart||"[]"):[]);U((Array.isArray(_c)?_c:[]).filter(';
if (content.includes(oldRestoreFilter)) {
  content = content.replace(oldRestoreFilter, newRestoreFilter);
  console.log('✓ 18yoqc7d05wnq.js: restoreSuspended safe unwrap applied');
}

fs.writeFileSync(chunkPath, content, 'utf8');
console.log('===> CLIENT CHUNK PATCHED SUCCESSFULLY!');
