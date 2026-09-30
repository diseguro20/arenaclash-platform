const fs = require('fs');
const path = require('path');

const dir = 'C:\\Users\\diseg\\Downloads\\CLONE_arenaclash_com_br_1790748955950\\imagens';
const files = fs.readdirSync(dir);

files.forEach(f => {
  const stat = fs.statSync(path.join(dir, f));
  console.log(`${f.padEnd(35)}: ${stat.size} bytes`);
});
