const fs = require('fs');
const html = fs.readFileSync('C:\\Users\\diseg\\Downloads\\CLONE_arenaclash_com_br_1790748955950\\paginas\\jogar.html', 'utf8');

const idxBody = html.indexOf('<body');
const bodyContent = html.slice(idxBody);

// Find all script tags in body
const scriptTags = [...bodyContent.matchAll(/<script[\s\S]*?<\/script>/gi)].map(m => m[0]);
console.log('Number of script tags in body:', scriptTags.length);
scriptTags.forEach((s, i) => {
  console.log(`--- SCRIPT ${i} (length: ${s.length}) ---`);
  console.log(s.slice(0, 500));
});

// Let's print the entire body HTML without scripts
const withoutScripts = bodyContent.replace(/<script[\s\S]*?<\/script>/gi, '');
console.log('\n--- BODY WITHOUT SCRIPTS (length: ' + withoutScripts.length + ') ---');
console.log(withoutScripts.slice(0, 10000));
