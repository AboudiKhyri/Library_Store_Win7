const fs = require('fs');
const path = require('path');

const chunkPath = path.resolve(__dirname, '../out/_next/static/chunks/18yoqc7d05wnq.js');
const content = fs.readFileSync(chunkPath, 'utf8');

console.log(content.slice(99200, 99800));
