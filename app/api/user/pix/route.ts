import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

export async function PUT(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
  }

  const body = await req.json();
  const chavePix = String(body.chave_pix || '').trim();

  const db = getAdminDb();
  await db.collection('arena_users').doc(user.id).update({
    chave_pix: chavePix,
  });

  return NextResponse.json({ ok: true, chave_pix: chavePix });
}
