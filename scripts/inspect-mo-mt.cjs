const fs = require('fs');
const path = require('path');

const chunkPath = path.resolve(__dirname, '../out/_next/static/chunks/18yoqc7d05wnq.js');
const chunk = fs.readFileSync(chunkPath, 'utf8');

console.log('--- MT definition search ---');
let idx = chunk.indexOf('function MT(');
if (idx === -1) idx = chunk.indexOf('MT=function(');
if (idx === -1) idx = chunk.indexOf('function MO(');
console.log('MO/MT around:', idx);
console.log(chunk.slice(Math.max(0, 965000), Math.min(chunk.length, 975000)));
