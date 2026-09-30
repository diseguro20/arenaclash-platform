const fs = require('fs');
const path = require('path');

// Let's read header of webp files to check dimensions
function getWebpDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  // RIFF header
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') {
    return null;
  }
  const format = buf.toString('ascii', 12, 16);
  if (format === 'VP8 ') {
    const width = buf.readUInt16LE(26) & 0x3fff;
    const height = buf.readUInt16LE(28) & 0x3fff;
    return { width, height, format };
  } else if (format === 'VP8L') {
    const b0 = buf[21];
    const b1 = buf[22];
    const b2 = buf[23];
    const b3 = buf[24];
    const width = 1 + (((b1 & 0x3F) << 8) | b0);
    const height = 1 + (((b3 & 0xF) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6));
    return { width, height, format };
  } else if (format === 'VP8X') {
    const width = 1 + buf.readUIntLE(24, 3);
    const height = 1 + buf.readUIntLE(27, 3);
    return { width, height, format };
  }
  return { format };
}

const dir = 'C:\\Users\\diseg\\Downloads\\CLONE_arenaclash_com_br_1790748955950\\imagens';
for (let i = 1; i <= 24; i++) {
  const pad = String(i).padStart(2, '0');
  const found = fs.readdirSync(dir).find(f => f.startsWith(`game-${pad}`));
  if (found) {
    const dims = getWebpDimensions(path.join(dir, found));
    console.log(`${found}:`, dims);
  }
}
