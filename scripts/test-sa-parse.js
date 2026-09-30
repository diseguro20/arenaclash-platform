const fs = require('fs');
const path = require('path');

function parseServiceAccount(raw) {
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON não configurada.');
  
  let candidate = raw.trim();
  
  // 1. Direct parse
  try {
    const p = JSON.parse(candidate);
    if (typeof p === 'object' && p !== null) return p;
    if (typeof p === 'string') return parseServiceAccount(p);
  } catch (e) {}

  // 2. Unescape \"
  try {
    const unescaped = candidate.replace(/\\"/g, '"');
    const p = JSON.parse(unescaped);
    if (typeof p === 'object' && p !== null) return p;
    if (typeof p === 'string') return parseServiceAccount(p);
  } catch (e) {}

  // 3. Strip outer quotes and unescape
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

const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const match = envFile.match(/FIREBASE_SERVICE_ACCOUNT_JSON=(.*)/);
if (match) {
  let val = match[1].trim();
  if (val.startsWith('"') && val.endsWith('"')) {
    val = val.slice(1, -1);
  }
  console.log('Testing raw val snippet:', val.slice(0, 50));
  try {
    const res = parseServiceAccount(val);
    console.log('Successfully parsed! Project ID:', res.project_id || res.projectId, 'Client Email:', res.client_email || res.clientEmail);
  } catch (err) {
    console.error('Failed to parse:', err.message);
  }
}
