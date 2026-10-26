const fs = require('fs');
const path = require('path');

const chunkPath = path.resolve(__dirname, '../out/_next/static/chunks/18yoqc7d05wnq.js');
const chunk = fs.readFileSync(chunkPath, 'utf8');

console.log(chunk.slice(975000, 978000));
