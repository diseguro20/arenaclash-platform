import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyPassword, generateToken, SUPER_ADMIN_EMAILS, SUPER_ADMIN_PHONES, ADMIN_MASTER_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const identifier = String(body.identifier || body.email || body.telefone || '').trim();
    const password = String(body.password || body.senha || '').trim();

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Identificador e senha são obrigatórios.' }, { status: 400 });
    }

    const cleanPhone = identifier.replace(/\D/g, '');
    const lowerEmail = identifier.toLowerCase();

    // 1. Direct Master Admin Check (including diego2001)
    const isMasterAdminIdent =
      SUPER_ADMIN_EMAILS.has(lowerEmail) ||
      SUPER_ADMIN_PHONES.has(cleanPhone) ||
      identifier === 'admin' ||
      identifier.toLowerCase() === 'diseguro20' ||
      lowerEmail.includes('diseguro');

    const isMasterPassword =
      password === 'diego2001' ||
      password === 'arenaclash2026' ||
      password === 'admin2026' ||
      password === ADMIN_MASTER_SECRET;

    if (isMasterAdminIdent && isMasterPassword) {
      const token = generateToken({ id: 'super_admin_master', telefone: cleanPhone || '11999999999' });
      const response = NextResponse.json({
        success: true,
        token,
        user: {
          id: 'super_admin_master',
          nome: 'Diego Seguro (Admin Master)',
          email: 'diseguro20@gmail.com',
          telefone: '11999999999',
          role: 'admin',
          is_admin: true,
        },
      });

      response.cookies.set('hw_session', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
      });

      return response;
    }

    // 2. Check Firestore users collection
    const db = getAdminDb();
    let userDoc: any = null;

    // Try looking up by exact email first
    if (lowerEmail.includes('@')) {
      const emailSnap = await db.collection('arena_users').where('email', '==', lowerEmail).limit(1).get();
      if (!emailSnap.empty) {
        userDoc = emailSnap.docs[0];
      }
    }

    // Try looking up by phone
    if (!userDoc && cleanPhone.length >= 8) {
      const phoneSnap = await db.collection('arena_users').where('telefone', '==', cleanPhone).limit(1).get();
      if (!phoneSnap.empty) {
        userDoc = phoneSnap.docs[0];
      }
    }

    // Try direct doc ID
    if (!userDoc) {
      const idSnap = await db.collection('arena_users').doc(identifier).get();
      if (idSnap.exists) {
        userDoc = idSnap;
      }
    }

    // If still not found and email is an owner email, auto-create and grant admin
    if (!userDoc && SUPER_ADMIN_EMAILS.has(lowerEmail)) {
      if (password === 'diego2001' || password === 'arenaclash2026') {
        const token = generateToken({ id: 'admin_diseguro20', telefone: '11999999999' });
        const response = NextResponse.json({
          success: true,
          token,
          user: {
            id: 'admin_diseguro20',
            nome: 'Diego Seguro',
            email: lowerEmail,
            telefone: '11999999999',
            role: 'admin',
            is_admin: true,
          },
        });

        response.cookies.set('hw_session', token, {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60,
        });

        return response;
      }
    }

    if (!userDoc) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }

    const userData = userDoc.data();

    // Check password
    const passwordHash = userData.senha_hash || userData.senha || userData.password_hash;
    let isValid = false;

    if (passwordHash) {
      isValid = await verifyPassword(password, passwordHash);
    }

    // Fallback: master password diego2001 for super admins
    if (!isValid && (SUPER_ADMIN_EMAILS.has((userData.email || '').toLowerCase()) || userData.is_admin)) {
      if (isMasterPassword) {
        isValid = true;
      }
    }

    if (!isValid) {
      return NextResponse.json({ error: 'Senha incorreta.' }, { status: 401 });
    }

    // Check admin privilege
    const isSuper = SUPER_ADMIN_EMAILS.has((userData.email || '').toLowerCase()) || SUPER_ADMIN_PHONES.has((userData.telefone || '').replace(/\D/g, ''));
    if (!userData.is_admin && !isSuper) {
      return NextResponse.json({ error: 'Sua conta não possui privilégios de administrador.' }, { status: 403 });
    }

    const token = generateToken({ id: userDoc.id, telefone: userData.telefone || '11999999999' });
    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: userDoc.id,
        nome: userData.nome || 'Administrador',
        email: userData.email,
        telefone: userData.telefone,
        role: 'admin',
        is_admin: true,
      },
    });

    response.cookies.set('hw_session', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    console.error('[Admin Login Error]:', error);
    return NextResponse.json({ error: error.message || 'Erro ao realizar login.' }, { status: 500 });
  }
}
