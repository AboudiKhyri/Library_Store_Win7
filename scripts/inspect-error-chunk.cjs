const fs = require('fs');
const path = require('path');

const chunkPath = path.resolve(__dirname, '../dist-desktop/win-unpacked/resources/client/_next/static/chunks/0yfs-ujhus7x4.js');
console.log(fs.readFileSync(chunkPath, 'utf8'));
