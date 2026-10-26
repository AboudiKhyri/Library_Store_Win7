const fs = require('fs');
const path = require('path');

const chunkPath = path.resolve(__dirname, '../out/_next/static/chunks/18yoqc7d05wnq.js');
const chunk = fs.readFileSync(chunkPath, 'utf8');

let pos = 0;
while (true) {
  const idx = chunk.indexOf('inv.subtitle', pos);
  if (idx === -1) break;
  console.log('--- Found at', idx, '---');
  console.log(chunk.slice(Math.max(0, idx - 100), Math.min(chunk.length, idx + 300)));
  pos = idx + 10;
}
