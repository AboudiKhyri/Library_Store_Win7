const fs = require('fs');
const path = require('path');

const fontPath = path.resolve(__dirname, '../../LBC.otf');
const buf = fs.readFileSync(fontPath);

console.log('File size:', buf.length);
const signature = buf.slice(0, 4).toString('ascii');
console.log('Signature:', signature);

// Parse OTF table directory
const numTables = buf.readUInt16BE(4);
console.log('Number of tables:', numTables);

let nameTableOffset = 0;
let nameTableLength = 0;

for (let i = 0; i < numTables; i++) {
  const tag = buf.slice(12 + i * 16, 12 + i * 16 + 4).toString('ascii');
  const offset = buf.readUInt32BE(12 + i * 16 + 8);
  const length = buf.readUInt32BE(12 + i * 16 + 12);
  if (tag === 'name') {
    nameTableOffset = offset;
    nameTableLength = length;
    break;
  }
}

console.log('Name table offset:', nameTableOffset, 'length:', nameTableLength);

if (nameTableOffset > 0) {
  const count = buf.readUInt16BE(nameTableOffset + 2);
  const stringOffset = nameTableOffset + buf.readUInt16BE(nameTableOffset + 4);
  console.log('Number of name records:', count);

  for (let i = 0; i < count; i++) {
    const recOffset = nameTableOffset + 6 + i * 12;
    const platformId = buf.readUInt16BE(recOffset);
    const encodingId = buf.readUInt16BE(recOffset + 2);
    const languageId = buf.readUInt16BE(recOffset + 4);
    const nameId = buf.readUInt16BE(recOffset + 6);
    const length = buf.readUInt16BE(recOffset + 8);
    const offset = stringOffset + buf.readUInt16BE(recOffset + 10);

    const strBuf = buf.slice(offset, offset + length);
    // Decode UTF-16BE or ASCII
    let val = '';
    if (platformId === 0 || platformId === 3) {
      val = strBuf.swap16().toString('utf16le');
    } else {
      val = strBuf.toString('ascii');
    }

    if ([1, 2, 4, 6].includes(nameId)) {
      const nameLabels = { 1: 'Family', 2: 'Subfamily', 4: 'Full name', 6: 'PostScript name' };
      console.log(`[${nameLabels[nameId] || nameId}] (plat:${platformId}, lang:${languageId}): "${val}"`);
    }
  }
}
