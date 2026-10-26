const fs = require('fs');
const path = require('path');

const root = 'D:/$RECYCLE.BIN';
console.log('Exists:', fs.existsSync(root));
if (fs.existsSync(root)) {
  const subs = fs.readdirSync(root);
  console.log('Subs:', subs);
  for (const s of subs) {
    const sp = path.join(root, s);
    try {
      const items = fs.readdirSync(sp);
      for (const it of items) {
        console.log(s, it);
        const full = path.join(sp, it);
        if (it === '$RZDGCR6') {
          console.log('RZDGCR6 contents:', fs.readdirSync(full));
          const pc = path.join(full, 'PROJECT_CONTEXT.md');
          if (fs.existsSync(pc)) {
            console.log('Found PROJECT_CONTEXT.md! Size:', fs.statSync(pc).size);
          }
        }
      }
    } catch (e) {
      console.log('Error reading', sp, e.message);
    }
  }
}
