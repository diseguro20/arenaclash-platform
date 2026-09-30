import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, hashPassword, verifyPassword } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

export async function PUT(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
  }

  const body = await req.json();
  const senhaAtual = String(body.senha_atual || '');
  const senhaNova = String(body.senha_nova || '');

  if (!senhaAtual || !senhaNova || senhaNova.length < 6) {
    return NextResponse.json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' }, { status: 400 });
  }

  const db = getAdminDb();
  const doc = await db.collection('arena_users').doc(user.id).get();
  const data = doc.data()!;

  const valid = await verifyPassword(senhaAtual, data.senha_hash || '');
  if (!valid) {
    return NextResponse.json({ error: 'Senha atual incorreta.' }, { status: 400 });
  }

  const newHash = await hashPassword(senhaNova);
  await db.collection('arena_users').doc(user.id).update({ senha_hash: newHash });

  return NextResponse.json({ ok: true, message: 'Senha alterada com sucesso.' });
}
