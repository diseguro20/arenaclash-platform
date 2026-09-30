const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function parseServiceAccount(raw) {
  let candidate = raw.trim();
  try {
    const p = JSON.parse(candidate);
    if (typeof p === 'object' && p !== null) return p;
    if (typeof p === 'string') return parseServiceAccount(p);
  } catch (e) {}

  try {
    const unescaped = candidate.replace(/\\"/g, '"');
    const p = JSON.parse(unescaped);
    if (typeof p === 'object' && p !== null) return p;
    if (typeof p === 'string') return parseServiceAccount(p);
  } catch (e) {}

  try {
    let clean = candidate;
    if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
      clean = clean.slice(1, -1);
    }
    const unescaped = clean.replace(/\\"/g, '"');
    const p = JSON.parse(unescaped);
    if (typeof p === 'object' && p !== null) return p;
  } catch (e) {}

  throw new Error('Falha ao interpretar credenciais Firebase.');
}

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/^FIREBASE_SERVICE_ACCOUNT_JSON=(.*)$/m);
if (!match) throw new Error('Not found in .env.local');

const saObj = parseServiceAccount(match[1]);
// Produce clean, valid single-line JSON string without extraneous backslashes
const cleanJson = JSON.stringify(saObj);

console.log('Clean JSON length:', cleanJson.length);
console.log('Sending clean JSON to Vercel env add FIREBASE_SERVICE_ACCOUNT_JSON...');

const proc = spawn('cmd.exe', ['/c', 'npx', 'vercel', 'env', 'add', 'FIREBASE_SERVICE_ACCOUNT_JSON', 'production,preview,development', '--yes', '--force'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let stdout = '';
let stderr = '';
proc.stdout.on('data', d => stdout += d.toString());
proc.stderr.on('data', d => stderr += d.toString());

proc.on('close', code => {
  if (code === 0) {
    console.log('✅ FIREBASE_SERVICE_ACCOUNT_JSON updated successfully on Vercel!');
  } else {
    console.error('❌ Failed updating:', stderr || stdout);
  }
});

proc.stdin.write(cleanJson);
proc.stdin.end();
