import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

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

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
  } catch {
    parsed = JSON.parse(JSON.parse(raw));
  }

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
