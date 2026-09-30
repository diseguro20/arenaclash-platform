const fs = require('fs');
const html = fs.readFileSync('C:\\Users\\diseg\\Downloads\\CLONE_arenaclash_com_br_1790748955950\\paginas\\home.html', 'utf8');
const idx = html.indexOf('asset_64');
console.log('Index of asset_64:', idx);
if (idx !== -1) {
  console.log(html.slice(Math.max(0, idx - 200), Math.min(html.length, idx + 400)));
}
