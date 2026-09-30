import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const body = await req.json();
  const partidaId = String(body.partida_id || '');
  const plataformasPassadas = Number(body.plataformas_passadas || 0);

  if (!partidaId) {
    return NextResponse.json({ error: 'Partida não informada.' }, { status: 400 });
  }

  const db = getAdminDb();
  const partidaRef = db.collection('arena_corridas').doc(partidaId);
  const snap = await partidaRef.get();

  if (!snap.exists) {
    return NextResponse.json({ error: 'Partida não encontrada.' }, { status: 404 });
  }

  const partida = snap.data()!;
  if (partida.uid !== user.id) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  }

  if (partida.status !== 'active') {
    return NextResponse.json({ error: 'Partida já finalizada.' }, { status: 400 });
  }

  const novoToken = randomUUID();
  await partidaRef.update({
    plataformas_passadas: plataformasPassadas,
    progress_token: novoToken,
  });

  return NextResponse.json({
    plataformas_passadas: plataformasPassadas,
    progress_token: novoToken,
  });
}
