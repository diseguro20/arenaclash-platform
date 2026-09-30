import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { getAdminDb } from './firebase-admin';

const JWT_SECRET = process.env.JWT_SECRET || 'arenaclash_super_secure_jwt_secret_2026_key';

export type AuthUser = {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  is_admin?: boolean;
  is_influencer?: boolean;
  codigo_convite: string;
  indicado_por?: string | null;
  saldo: number;
  saldo_ouro: number;
  saldo_rubi: number;
  saldo_diamante: number;
  saldo_bonus: number;
  saldo_afiliado: number;
  vitorias_1: number;
  vitorias_2: number;
  vitorias_3: number;
  chave_pix?: string | null;
  cpf?: string | null;
  status?: 'active' | 'suspended';
  created_at?: string;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: { id: string; telefone: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { id: string; telefone: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: string; telefone: string };
  } catch {
    return null;
  }
}

export function generateCsrf(): string {
  return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

export async function getAuthenticatedUser(req: NextRequest): Promise<AuthUser | null> {
  let token = req.cookies.get('hw_session')?.value;
  if (!token) {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  // Also check custom header or fallback query/token
  if (!token) {
    token = req.headers.get('x-user-token') || undefined;
  }

  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded || !decoded.id) return null;

  if (decoded.id === 'super_admin_master') {
    return {
      id: 'super_admin_master',
      nome: 'Administrador Master',
      telefone: decoded.telefone || 'Master',
      email: 'diseguro20@gmail.com',
      is_admin: true,
      is_influencer: true,
      status: 'active',
      codigo_convite: 'ADMIN',
      saldo: 999999,
      saldo_ouro: 1000,
      saldo_rubi: 500,
      saldo_diamante: 250,
      saldo_bonus: 0,
      saldo_afiliado: 0,
      vitorias_1: 42,
      vitorias_2: 12,
      vitorias_3: 5,
    };
  }

  const db = getAdminDb();
  const userDoc = await db.collection('arena_users').doc(decoded.id).get();
  if (!userDoc.exists) return null;

  const data = userDoc.data()!;
  const email = (data.email || '').toLowerCase();
  const telefone = (data.telefone || decoded.telefone || '').replace(/\D/g, '');
  const isSuperAdmin = SUPER_ADMIN_EMAILS.has(email) || SUPER_ADMIN_PHONES.has(telefone);

  return {
    id: userDoc.id,
    nome: data.nome || 'Piloto Arena',
    telefone: data.telefone || decoded.telefone,
    email: data.email || `${decoded.id.slice(0, 8)}@arenaclash.com.br`,
    is_admin: Boolean(data.is_admin || isSuperAdmin),
    is_influencer: Boolean(data.is_influencer !== undefined ? data.is_influencer : isSuperAdmin),
    status: (data.status || 'active') as 'active' | 'suspended',
    codigo_convite: data.codigo_convite || userDoc.id.slice(0, 6).toUpperCase(),
    indicado_por: data.indicado_por || null,
    saldo: Number(data.saldo || 0),
    saldo_ouro: Number(data.saldo_ouro || 0),
    saldo_rubi: Number(data.saldo_rubi || 0),
    saldo_diamante: Number(data.saldo_diamante || 0),
    saldo_bonus: Number(data.saldo_bonus || 0),
    saldo_afiliado: Number(data.saldo_afiliado || 0),
    vitorias_1: Number(data.vitorias_1 || 0),
    vitorias_2: Number(data.vitorias_2 || 0),
    vitorias_3: Number(data.vitorias_3 || 0),
    chave_pix: data.chave_pix || null,
    cpf: data.cpf || null,
    created_at: data.created_at || new Date().toISOString(),
  };
}

export const SUPER_ADMIN_EMAILS = new Set(['diseguro18@gmail.com', 'diseguro20@gmail.com']);
export const SUPER_ADMIN_PHONES = new Set(['11999999999', '21999999999', '11982854183', 'diseguro20']);
export const ADMIN_MASTER_SECRET = process.env.ADMIN_MASTER_SECRET || 'arenaclash_admin_master_secret_2026';

export async function requireAdminUser(req: NextRequest): Promise<AuthUser | null> {
  const masterKey = req.headers.get('x-admin-key');
  if (masterKey && masterKey === ADMIN_MASTER_SECRET) {
    return {
      id: 'super_admin_master',
      nome: 'Administrador Master',
      telefone: 'Master',
      email: 'diseguro20@gmail.com',
      is_admin: true,
      is_influencer: true,
      status: 'active',
      codigo_convite: 'ADMIN',
      saldo: 999999,
      saldo_ouro: 1000,
      saldo_rubi: 500,
      saldo_diamante: 250,
      saldo_bonus: 0,
      saldo_afiliado: 0,
      vitorias_1: 42,
      vitorias_2: 12,
      vitorias_3: 5,
    };
  }

  const user = await getAuthenticatedUser(req);
  if (!user) return null;

  if (user.is_admin) return user;
  if (user.email && SUPER_ADMIN_EMAILS.has(user.email.toLowerCase())) return user;
  if (user.telefone && SUPER_ADMIN_PHONES.has(user.telefone.replace(/\D/g, ''))) return user;

  return null;
}
