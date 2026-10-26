const fs = require('fs');
const path = require('path');

const logPath = path.resolve(__dirname, '../data/logs/library-desktop.log');
const text = fs.readFileSync(logPath, 'utf8');
const lines = text.split('\n');

console.log('Total log lines:', lines.length);
const recent = lines.slice(-80);
recent.forEach(l => console.log(l));
