const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const admin = require('firebase-admin');

// 1. Read env
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

function getEnvVal(key) {
  const m = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (!m) return null;
  let val = m[1].trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  return val;
}

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

const rawSa = getEnvVal('FIREBASE_SERVICE_ACCOUNT_JSON');
const sa = parseServiceAccount(rawSa);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: sa.projectId || sa.project_id || 'saltocash-platform-2026',
      clientEmail: sa.clientEmail || sa.client_email,
      privateKey: (sa.privateKey || sa.private_key).replace(/\\n/g, '\n'),
    })
  });
}

const db = admin.firestore();

async function setupAdmin() {
  const nome = 'Diego';
  const telefone = '11982854183';
  const plainPassword = 'diego2001';
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  console.log(`Setting up admin user: ${nome} (${telefone})...`);

  const usersRef = db.collection('arena_users');
  const snap = await usersRef.where('telefone', '==', telefone).limit(1).get();

  let uid;
  if (!snap.empty) {
    const doc = snap.docs[0];
    uid = doc.id;
    console.log(`User already exists with ID: ${uid}. Updating to admin with balance...`);
    await usersRef.doc(uid).update({
      nome,
      senha_hash: hashedPassword,
      is_admin: true,
      is_influencer: true,
      saldo: 500.00,
      saldo_ouro: 5000,
      saldo_rubi: 500,
      saldo_diamante: 200,
      saldo_bonus: 50.00,
      status: 'active',
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    const newDoc = usersRef.doc();
    uid = newDoc.id;
    const codigoConvite = uid.slice(0, 6).toUpperCase();
    console.log(`Creating brand new admin user with ID: ${uid} (Code: ${codigoConvite})...`);
    await newDoc.set({
      id: uid,
      nome,
      telefone,
      email: `${telefone}@arenaclash.com.br`,
      senha_hash: hashedPassword,
      is_admin: true,
      is_influencer: true,
      saldo: 500.00,
      saldo_ouro: 5000,
      saldo_rubi: 500,
      saldo_diamante: 200,
      saldo_bonus: 50.00,
      saldo_afiliado: 0.00,
      total_depositado: 500.00,
      total_sacado: 0.00,
      total_corridas: 10,
      total_partidas: 10,
      total_ganhos: 1250.00,
      vitorias_1: 5,
      vitorias_2: 3,
      vitorias_3: 2,
      pontos_ranking: 180,
      codigo_convite: codigoConvite,
      chave_pix: telefone,
      tipo_chave_pix: 'telefone',
      cpf: '52968522817',
      status: 'active',
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  console.log('✅ Admin user created/updated successfully in Firestore!');
  console.log({
    nome,
    telefone,
    senha: plainPassword,
    is_admin: true,
    saldo: 'R$ 500,00',
    ouro: 5000,
    rubi: 500,
    diamante: 200
  });
}

setupAdmin().catch((err) => {
  console.error('Error setting up admin:', err);
  process.exit(1);
});
