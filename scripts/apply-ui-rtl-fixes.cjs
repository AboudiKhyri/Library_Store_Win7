/**
 * Automated Precision Patch for UI RTL & Token Contrast Compliance
 */

const fs = require('fs');
const path = require('path');

function patchFile(relPath, replacements) {
  const fullPath = path.resolve(relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${relPath}`);
    return false;
  }
  let content = fs.readFileSync(fullPath, 'utf8');
  let count = 0;
  for (const [target, replacement] of replacements) {
    if (content.includes(target)) {
      content = content.replace(target, replacement);
      count++;
    } else {
      console.warn(`[WARN] Target not found in ${relPath}: ${target.slice(0, 40)}...`);
    }
  }
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`[PATCHED] ${relPath} (${count} replacements)`);
  return true;
}

// 1. select.tsx
patchFile('src/components/ui/select.tsx', [
  ['py-1.5 pr-8 pl-2', 'py-1.5 pe-8 ps-2'],
  ['className="absolute right-2 flex size-3.5', 'className="absolute end-2 flex size-3.5'],
]);

// 2. dropdown-menu.tsx
patchFile('src/components/ui/dropdown-menu.tsx', [
  ['py-1.5 pr-2 pl-8', 'py-1.5 pe-2 ps-8'],
  ['className="pointer-events-none absolute left-2', 'className="pointer-events-none absolute start-2'],
  ['data-[inset]:pl-8', 'data-[inset]:ps-8'],
]);

// 3. alert-dialog.tsx
patchFile('src/components/ui/alert-dialog.tsx', [
  ['sm:text-left', 'sm:text-start'],
]);

// 4. table.tsx
patchFile('src/components/ui/table.tsx', [
  ['text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0', 'text-start align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pe-0'],
  ['whitespace-nowrap [&:has([role=checkbox])]:pr-0', 'whitespace-nowrap [&:has([role=checkbox])]:pe-0'],
]);

// 5. sheet.tsx
patchFile('src/components/ui/sheet.tsx', [
  ['absolute top-4 right-4 rounded-xs', 'absolute top-4 end-4 rounded-xs'],
]);

// 6. dialog.tsx
patchFile('src/components/ui/dialog.tsx', [
  ['top-4 rtl:left-4 rtl:right-auto ltr:right-4 ltr:left-auto', 'top-4 end-4'],
]);

// 7. toast.tsx
patchFile('src/components/ui/toast.tsx', [
  ['sm:bottom-0 sm:right-0 sm:top-auto', 'sm:bottom-0 sm:end-0 sm:top-auto'],
  ['space-x-2 overflow-hidden rounded-md border p-4 pr-6', 'gap-2 overflow-hidden rounded-md border p-4 pe-6'],
  ['absolute right-1 top-1 rounded-md', 'absolute end-1 top-1 rounded-md'],
]);

// 8. button.tsx
patchFile('src/components/ui/button.tsx', [
  ['destructive:\n          "bg-destructive text-white', 'destructive:\n          "bg-destructive text-destructive-foreground'],
  ['destructive:\r\n          "bg-destructive text-white', 'destructive:\r\n          "bg-destructive text-destructive-foreground'],
]);

// 9. badge.tsx
patchFile('src/components/ui/badge.tsx', [
  ['destructive:\n          "border-transparent bg-destructive text-white', 'destructive:\n          "border-transparent bg-destructive text-destructive-foreground'],
  ['destructive:\r\n          "border-transparent bg-destructive text-white', 'destructive:\r\n          "border-transparent bg-destructive text-destructive-foreground'],
]);

// 10. permanent-delete-dialog.tsx
patchFile('src/components/library/parts/permanent-delete-dialog.tsx', [
  ['bg-[#0e141c] border-t border-[#223041]', 'bg-muted/50 border-t border-border'],
  ['className="border-gray-700 bg-transparent text-gray-300 hover:bg-gray-800 hover:text-white"', 'variant="outline"'],
  ['className="bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md shadow-red-600/30"', 'variant="destructive"'],
]);

// 11. purchases.tsx
patchFile('src/components/library/screens/purchases.tsx', [
  ['className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"', 'className="w-full gap-1.5 bg-success hover:bg-success/90 text-success-foreground"'],
  ['className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"', 'className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground"'],
]);

// 12. reports.tsx
patchFile('src/components/library/screens/reports.tsx', [
  ['<span className="text-gray-600">', '<span className="text-muted-foreground">'],
]);

// 13. layout.tsx
patchFile('src/app/layout.tsx', [
  ['className={cairo.variable}', 'className={`${cairo.variable} dark`}'],
]);

console.log('\nAll surgical UI/RTL patches executed.');
