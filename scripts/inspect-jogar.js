const fs = require('fs');
const html = fs.readFileSync('C:\\Users\\diseg\\Downloads\\CLONE_arenaclash_com_br_1790748955950\\paginas\\jogar.html', 'utf8');

console.log('Total length:', html.length);
const idxBody = html.indexOf('<body');
if (idxBody !== -1) {
  console.log('Body starts at:', idxBody);
  console.log(html.slice(idxBody, idxBody + 3000));
} else {
  console.log('No <body> found, first 1000 chars:');
  console.log(html.slice(0, 1000));
}
