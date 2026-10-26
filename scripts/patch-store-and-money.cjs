const fs = require('fs');
const path = require('path');

function patch(file, search, replace) {
  let content = fs.readFileSync(file, 'utf8');
  const normalizedSearch = search.replace(/\r\n/g, '\n');
  const isCrlf = content.includes('\r\n');
  const normalizedContent = content.replace(/\r\n/g, '\n');
  if (!normalizedContent.includes(normalizedSearch)) {
    console.error('FAILED TO FIND SEARCH IN', file);
    return false;
  }
  let newContent = normalizedContent.replace(normalizedSearch, replace.replace(/\r\n/g, '\n'));
  if (isCrlf) {
    newContent = newContent.replace(/\n/g, '\r\n');
  }
  fs.writeFileSync(file, newContent, 'utf8');
  console.log('SUCCESSFULLY PATCHED', file);
  return true;
}

const root1 = path.resolve(__dirname, '../..'); // d:\Anti_Work\Store For Win7
const root2 = path.resolve(__dirname, '..');   // d:\Anti_Work\Store For Win7\Library Store For Windows 7

// Main dashboard.tsx
patch(path.join(root1, 'src/components/library/screens/dashboard.tsx'),
`  const weekLabels = data.weeklySales.map((d) => {
    const date = new Date(d.date + 'T00:00:00')
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'short', day: 'numeric' }).format(date)
  })`,
`  const weekLabels = (data.weeklySales ?? []).map((d) => {
    try {
      const date = new Date(d.date + 'T00:00:00')
      if (isNaN(date.getTime())) return d.date || '—'
      return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'short', day: 'numeric' }).format(date)
    } catch {
      return d.date || '—'
    }
  })`
);

// Main reports.tsx
patch(path.join(root1, 'src/components/library/screens/reports.tsx'),
`        name: new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' }).format(new Date((r.date as string) + 'T00:00:00')),`,
`        name: (() => {
          try {
            const d = new Date(String(r.date) + 'T00:00:00')
            return !isNaN(d.getTime()) ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' }).format(d) : String(r.date ?? '—')
          } catch {
            return String(r.date ?? '—')
          }
        })(),`
);
