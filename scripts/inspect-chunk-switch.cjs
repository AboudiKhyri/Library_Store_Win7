const fs = require('fs');
const path = require('path');

const chunk = fs.readFileSync(path.resolve(__dirname, '../out/_next/static/chunks/18yoqc7d05wnq.js'), 'utf8');
console.log(chunk.slice(589700, 590050));
