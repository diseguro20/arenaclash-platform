const fs = require('fs');
const path = require('path');

const dir = 'C:\\Users\\diseg\\Downloads\\CLONE_arenaclash_com_br_1790748955950\\imagens';
const gameFiles = fs.readdirSync(dir).filter(f => f.startsWith('game-') || f.startsWith('asset_5'));

console.log('Found game files:', gameFiles);
