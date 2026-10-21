/**
 * Generates the Phase 1 Discovery Matrix for Expiry Removal
 */

const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync('scripts/expiry-discovery-raw.json', 'utf8'));

// Classification rule based on file path and content
function classify(file, text) {
  if (file.startsWith('src/components/ui/') || file.startsWith('src/components/library/screens/') || file.startsWith('src/components/library/parts/')) {
    if (text.includes('EXPIRY_WRITEOFF')) return { type: 'UI', action: 'HISTORICAL-DISPLAY-ONLY' };
    return { type: 'UI', action: 'REMOVE' };
  }
  if (file.startsWith('server/api.js')) {
    if (text.includes('FEFO') || text.includes('ORDER BY expiryDate')) return { type: 'API', action: 'SIMPLIFY' }; // replace with FIFO
    if (text.includes('sweep') || text.includes('statsExpired') || text.includes("filter === 'expired'")) return { type: 'API', action: 'REMOVE' };
    if (text.includes('EXPIRY_WRITEOFF')) return { type: 'API', action: 'HISTORICAL-DISPLAY-ONLY' };
    return { type: 'API', action: 'REMOVE' };
  }
  if (file.startsWith('server/db.js') || file.includes('db-schema.ts') || file.includes('schema.prisma')) {
    if (text.includes('CREATE TABLE') || text.includes('"expiryDate" DATETIME')) return { type: 'DB', action: 'KEEP-DEPRECATED' };
    if (text.includes('stockAvailableMap') || text.includes('expiryDate IS NULL')) return { type: 'DB', action: 'SIMPLIFY' };
    return { type: 'DB', action: 'KEEP-DEPRECATED' };
  }
  if (file.startsWith('src/lib/library/services/')) {
    if (text.includes('FEFO') || text.includes('orderBy: [{ expiryDate')) return { type: 'service', action: 'SIMPLIFY' };
    if (text.includes('sweep')) return { type: 'service', action: 'REMOVE' };
    if (text.includes('EXPIRY_WRITEOFF')) return { type: 'service', action: 'HISTORICAL-DISPLAY-ONLY' };
    return { type: 'service', action: 'REMOVE' };
  }
  if (file.includes('i18n.ts') || file.includes('labels.ts')) {
    if (text.includes('EXPIRY_WRITEOFF')) return { type: 'i18n', action: 'HISTORICAL-DISPLAY-ONLY' };
    if (text.includes('license') || text.includes('session') || text.includes('activation') || text.includes('صلاحية لتنفيذ')) return { type: 'i18n', action: 'KEEP-NON-PRODUCT' };
    return { type: 'i18n', action: 'REMOVE' };
  }
  if (file.startsWith('docs/') || file.endsWith('.md')) {
    return { type: 'docs', action: 'UPDATE-DOCS' };
  }
  if (file.startsWith('scripts/')) {
    return { type: 'test', action: 'UPDATE-TEST' };
  }
  return { type: 'other', action: 'REVIEW' };
}

let md = `# PHASE 1: DISCOVERY & AUDIT MATRIX — EXPIRY REMOVAL
**Role:** The Inquisitor · Security Architect & Code Forensic Analyst  
**Mission:** Total Removal of Expiry Concept; Conversion of FEFO to FIFO; Lot Identity Preservation  
**Standard:** Zero Trust Forensic Discovery  

---

## 1. Discovery Overview

Total occurrences identified: ${Object.values(raw).reduce((s, a) => s + a.length, 0)} lines across ${Object.keys(raw).length} files.

| File Category | Files Count | Lines Found | Core Remediation Strategy |
| :--- | :---: | :---: | :--- |
| **Backend API (\`server/api.js\`)** | 1 | 74 | Convert FEFO to FIFO; remove sweep endpoint; remove expiry metrics/filters; write NULL |
| **Database Layer (\`server/db.js\`, \`db-schema.ts\`)** | 2 | 9 | Keep \`expiryDate\` columns as DEPRECATED nullable; bump SCHEMA_VERSION to 2; recover EXPIRED batches |
| **Frontend Services (\`src/lib/library/services/*\`)** | 6 | 61 | Convert FEFO to FIFO in \`inventory.ts\`; remove sweep & expiry metrics from dashboard |
| **UI Screens (\`src/components/library/screens/*\`)** | 9 | 158 | Remove expiry columns, tabs, chips, warning badges, inputs across inventory, pos, purchases, reports |
| **i18n & Labels (\`i18n.ts\`, \`labels.ts\`)** | 2 | 31 | Delete dead product expiry strings; keep user permissions and license expiry strings intact |
| **Configuration & Types (\`config.ts\`, \`types.ts\`)** | 2 | 11 | Remove expiry config keys and EXPIRED from BatchStatus |
| **Documentation & Tests** | 4 | 5 | Update references from FEFO to FIFO; update tests |

---

## 2. Forensic Discovery Table

| File | Line | Type | Code Snippet | Planned Action |
| :--- | :---: | :---: | :--- | :---: |
`;

for (const [file, items] of Object.entries(raw)) {
  for (const item of items) {
    const { type, action } = classify(file, item.text);
    const snippet = item.text.replace(/\|/g, '\\|').slice(0, 70);
    md += `| \`${file}\` | ${item.line} | ${type} | \`${snippet}\` | **${action}** |\n`;
  }
}

fs.writeFileSync('docs/EXPIRY_REMOVAL_AUDIT.md', md, 'utf8');
console.log('Successfully wrote docs/EXPIRY_REMOVAL_AUDIT.md');
