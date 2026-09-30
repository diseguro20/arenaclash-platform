import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

function parseServiceAccount(raw: string): any {
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON não configurada.');
  
  let candidate = raw.trim();
  
  // 1. Direct JSON parse
  try {
    const p = JSON.parse(candidate);
    if (typeof p === 'object' && p !== null) return p;
    if (typeof p === 'string') return parseServiceAccount(p);
  } catch (e) {}

  // 2. Unescape \" (literal escaped quotes from .env strings)
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

  // 4. Base64
  try {
    const decoded = Buffer.from(candidate, 'base64').toString('utf8');
    const p = JSON.parse(decoded);
    if (typeof p === 'object' && p !== null) return p;
  } catch (e) {}

  throw new Error('Falha ao interpretar credenciais Firebase Service Account.');
}

function getServiceAccount(): ServiceAccount {
  const localFile = path.join(process.cwd(), 'service-account.json');
  if (fs.existsSync(localFile)) {
    try {
      const content = fs.readFileSync(localFile, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed.private_key && (parsed.client_email || parsed.project_id)) {
        return {
          projectId: parsed.project_id || 'saltocash-platform-2026',
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key.replace(/\\n/g, '\n'),
        };
      }
    } catch (e) {
      console.warn('Failed reading local service-account.json, falling back to env:', e);
    }
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON não configurada.');
  }

  const parsed = parseServiceAccount(raw);

  return {
    projectId: parsed.projectId ?? parsed.project_id ?? 'saltocash-platform-2026',
    clientEmail: parsed.clientEmail ?? parsed.client_email,
    privateKey: (parsed.privateKey ?? parsed.private_key)?.replace(/\\n/g, '\n'),
  };
}

export function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }
  return initializeApp({ credential: cert(getServiceAccount()) });
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}
