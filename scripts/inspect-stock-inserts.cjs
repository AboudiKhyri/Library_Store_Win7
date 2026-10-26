const fs = require('fs');
const code = fs.readFileSync('D:/Anti_Work/Store For Win7/Library Store For Windows 7/server/api.js', 'utf8');

['INSERT INTO "Batch"', 'INSERT INTO "StockMovement"'].forEach(target => {
  let pos = 0;
  while ((pos = code.indexOf(target, pos)) !== -1) {
    console.log('--- FOUND:', target, 'at', pos);
    console.log(code.substring(pos, pos + 350));
    pos += target.length;
  }
});
