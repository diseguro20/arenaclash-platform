import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { generateCsrf, generateToken, verifyPassword, SUPER_ADMIN_EMAILS, SUPER_ADMIN_PHONES } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawInput = String(body.telefone || body.identifier || body.email || '').trim();
    const senha = String(body.senha || body.password || '');

    if (!rawInput || !senha) {
      return NextResponse.json({ error: 'Identificador (e-mail ou telefone) e senha são obrigatórios.' }, { status: 400 });
    }

    const cleanPhone = rawInput.replace(/\D/g, '');
    const lowerEmail = rawInput.toLowerCase();
    const isMasterPassword = senha === 'diego2001' || senha === 'arenaclash2026';

    // 1. Direct Master Admin check
    if ((SUPER_ADMIN_EMAILS.has(lowerEmail) || SUPER_ADMIN_PHONES.has(cleanPhone) || rawInput.toLowerCase() === 'diseguro20') && isMasterPassword) {
      const token = generateToken({ id: 'admin_diseguro20', telefone: cleanPhone || '11999999999' });
      const csrf = generateCsrf();

      const responseUser = {
        id: 'admin_diseguro20',
        nome: 'Diego Seguro',
        telefone: cleanPhone || '11999999999',
        email: lowerEmail.includes('@') ? lowerEmail : 'diseguro20@gmail.com',
        saldo: 1000.00,
        saldo_ouro: 1000,
        saldo_rubi: 500,
        saldo_diamante: 250,
        saldo_bonus: 0,
        saldo_afiliado: 0,
        vitorias_1: 42,
        vitorias_2: 12,
        vitorias_3: 5,
        codigo_convite: 'DISEGURO20',
        is_admin: true,
        is_influencer: true,
      };

      const res = NextResponse.json({ user: responseUser, token, csrf });
      res.cookies.set('hw_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });

      return res;
    }

    // 2. Query Firestore by Phone or Email
    const db = getAdminDb();
    let userDoc: any = null;

    if (lowerEmail.includes('@')) {
      const emailSnap = await db.collection('arena_users').where('email', '==', lowerEmail).limit(1).get();
      if (!emailSnap.empty) {
        userDoc = emailSnap.docs[0];
      }
    }

    if (!userDoc && cleanPhone.length >= 8) {
      const phoneSnap = await db.collection('arena_users').where('telefone', '==', cleanPhone).limit(1).get();
      if (!phoneSnap.empty) {
        userDoc = phoneSnap.docs[0];
      }
    }

    if (!userDoc) {
      // Try by ID directly
      const idSnap = await db.collection('arena_users').doc(rawInput).get();
      if (idSnap.exists) {
        userDoc = idSnap;
      }
    }

    if (!userDoc) {
      return NextResponse.json({ error: 'Usuário não encontrado. Verifique seu e-mail ou telefone.' }, { status: 401 });
    }

    const data = userDoc.data();
    const storedHash = data.senha_hash || data.senha || data.password_hash || '';

    let ok = false;
    if (storedHash) {
      ok = await verifyPassword(senha, storedHash);
    }

    // Master password override for admin/owner accounts
    if (!ok && (data.is_admin || SUPER_ADMIN_EMAILS.has((data.email || '').toLowerCase()))) {
      if (isMasterPassword) {
        ok = true;
      }
    }

    if (!ok) {
      return NextResponse.json({ error: 'Senha incorreta.' }, { status: 401 });
    }

    const isSuper = SUPER_ADMIN_EMAILS.has((data.email || '').toLowerCase()) || SUPER_ADMIN_PHONES.has((data.telefone || '').replace(/\D/g, ''));
    const isAdmin = Boolean(data.is_admin || isSuper);

    const token = generateToken({ id: userDoc.id, telefone: data.telefone || cleanPhone });
    const csrf = generateCsrf();

    const responseUser = {
      id: userDoc.id,
      nome: data.nome || 'Jogador',
      telefone: data.telefone || cleanPhone,
      email: data.email || `${data.telefone || cleanPhone}@arenaclash.com.br`,
      saldo: Number(data.saldo || 0),
      saldo_bonus: Number(data.saldo_bonus || 0),
      saldo_afiliado: Number(data.saldo_afiliado || 0),
      codigo_convite: data.codigo_convite || userDoc.id.slice(0, 6).toUpperCase(),
      is_admin: isAdmin,
    };

    const res = NextResponse.json({ user: responseUser, token, csrf });
    res.cookies.set('hw_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return res;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: (error as Error).message || 'Erro ao realizar login.' }, { status: 500 });
  }
}
