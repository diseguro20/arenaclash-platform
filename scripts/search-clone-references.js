const fs = require('fs');
const path = require('path');

const cloneDir = 'C:\\Users\\diseg\\Downloads\\CLONE_arenaclash_com_br_1790748955950';

function searchInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  console.log(`\n=== Searching in ${path.basename(filePath)} ===`);

  const patterns = [
    /game-\d+/g,
    /asset_64/g,
    /asset_5\d/g,
    /asset_6\d/g,
    /asset_9\d/g,
    /canvas/gi,
    /iframe/gi,
    /<video/gi,
    /\.mp4/gi,
    /game/gi
  ];

  for (let m of content.matchAll(/src=["']([^"']*(?:game-|asset_64|asset_5|bg_|character_|base_)[^"']*)["']/gi)) {
    console.log('Found src:', m[1]);
  }
}

searchInFile(path.join(cloneDir, 'index.html'));
searchInFile(path.join(cloneDir, 'paginas', 'home.html'));
searchInFile(path.join(cloneDir, 'paginas', 'jogar.html'));
searchInFile(path.join(cloneDir, 'paginas', 'painel.html'));
searchInFile(path.join(cloneDir, 'paginas', 'profile_me.html'));
