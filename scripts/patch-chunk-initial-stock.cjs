const fs = require('fs');
const path = require('path');

const chunkPaths = [
  path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/client/_next/static/chunks/18yoqc7d05wnq.js'),
  path.resolve(__dirname, '../out/_next/static/chunks/18yoqc7d05wnq.js'),
];

chunkPaths.forEach((chunkPath) => {
  if (!fs.existsSync(chunkPath)) {
    console.warn('Chunk not found, skipping:', chunkPath);
    return;
  }
  let content = fs.readFileSync(chunkPath, 'utf8');

  // 1. In k_()
  const emptyTarget = 'reorderLevel:"10",active:!0,notes:""';
  const emptyReplacement = 'reorderLevel:"10",initialStock:"",active:!0,notes:""';
  if (content.includes(emptyTarget) && !content.includes('initialStock:""')) {
    content = content.replace(emptyTarget, emptyReplacement);
  }

  // 2. In submit body payload
  const bodyTarget = 'reorderLevel:a,active:c.active,notes:c.notes.trim()||null};p(!0)';
  const bodyReplacement = 'reorderLevel:a,initialStock:!r&&c.initialStock?parseFloat(c.initialStock)||0:0,active:c.active,notes:c.notes.trim()||null};p(!0)';
  if (content.includes(bodyTarget) && !content.includes('initialStock:!r')) {
    content = content.replace(bodyTarget, bodyReplacement);
  }

  // 3. In JSX after pf-reorder
  const reorderBlock = '(0,N.jsxs)("div",{className:"space-y-1.5",children:[(0,N.jsx)(w9,{htmlFor:"pf-reorder",children:s("products.reorderLevel")}),(0,N.jsx)(w6,{id:"pf-reorder",value:c.reorderLevel,onChange:e=>x("reorderLevel",e.target.value),className:v,inputMode:"numeric"})]}),';
  const initialStockBlock = reorderBlock + '!r&&(0,N.jsxs)("div",{className:"space-y-1.5",children:[(0,N.jsxs)(w9,{htmlFor:"pf-initialStock",children:[o==="ar"?"العدد المبدئي الموجود في المخزن":"Initial Stock Quantity"," ",(0,N.jsxs)("span",{className:"text-muted-foreground",children:["(",s("app.optional"),")"]})]}),(0,N.jsx)(w6,{id:"pf-initialStock",value:c.initialStock||"",onChange:e=>x("initialStock",e.target.value),placeholder:"0",className:v,inputMode:c.isWeighable?"decimal":"numeric",dir:"ltr"})]}),';

  if (content.includes(reorderBlock) && !content.includes('pf-initialStock')) {
    content = content.replace(reorderBlock, initialStockBlock);
  }

  fs.writeFileSync(chunkPath, content, 'utf8');
  console.log('✓ Successfully patched chunk:', chunkPath);
});
