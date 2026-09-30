const fs = require('fs');
const html = fs.readFileSync('C:\\Users\\diseg\\Downloads\\CLONE_arenaclash_com_br_1790748955950\\paginas\\home.html', 'utf8');

const regex = /<[^>]+game-[^>]+>/gi;
let match;
while ((match = regex.exec(html)) !== null) {
  const start = Math.max(0, match.index - 300);
  const end = Math.min(html.length, match.index + 500);
  console.log('\n--- Match at ' + match.index + ' ---');
  console.log(html.slice(start, end));
}
