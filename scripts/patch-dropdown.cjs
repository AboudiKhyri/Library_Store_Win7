const fs = require('fs');
const path = require('path');

const file = path.resolve('src/components/ui/dropdown-menu.tsx');
let content = fs.readFileSync(file, 'utf8');

// Replace all remaining data-[inset]:pl-8 with data-[inset]:ps-8
content = content.replace(/data-\[inset\]:pl-8/g, 'data-[inset]:ps-8');

// Replace py-1.5 pr-2 pl-8 with py-1.5 pe-2 ps-8
content = content.replace(/py-1\.5 pr-2 pl-8/g, 'py-1.5 pe-2 ps-8');

// Replace pointer-events-none absolute left-2 with pointer-events-none absolute start-2
content = content.replace(/pointer-events-none absolute left-2/g, 'pointer-events-none absolute start-2');

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated all directional classes in dropdown-menu.tsx');
