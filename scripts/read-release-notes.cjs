const fs = require('fs');
const p = 'D:/ZIP/Library Store Release/RELEASE_NOTES.txt';
if (fs.existsSync(p)) {
  console.log(fs.readFileSync(p, 'utf8'));
}
