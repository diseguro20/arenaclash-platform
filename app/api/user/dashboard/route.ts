import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { reconcileDeposit } from '@/lib/pix-gateway';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
  }

  const db = getAdminDb();

  // Reconcilia automaticamente depósitos pendentes recentes do usuário
  try {
    const pendingSnap = await db
      .collection('arena_deposits')
      .where('uid', '==', user.id)
      .where('status', '==', 'pendente')
      .limit(3)
      .get();

    for (const doc of pendingSnap.docs) {
      await reconcileDeposit(doc.id).catch(() => {});
    }
  } catch (_) {}

  const userDoc = await db.collection('arena_users').doc(user.id).get();
  const data = userDoc.data() || {};

  return NextResponse.json({
    id: user.id,
    user_id: user.id,
    nome: data.nome || user.nome,
    email: data.email || user.email,
    telefone: data.telefone || user.telefone,
    saldo: Number(data.saldo || 0),
    saldo_bonus: Number(data.saldo_bonus || 0),
    saldo_afiliado: Number(data.saldo_afiliado || 0),
    total_partidas: Number(data.total_partidas || 0),
    total_ganhos: Number(data.total_ganhos || 0),
    total_depositado: Number(data.total_depositado || 0),
    total_sacado: Number(data.total_sacado || 0),
    total_indicados: Number(data.total_indicados || 0),
    indicados_n1: Number(data.indicados_n1 || data.total_indicados || 0),
    indicados_n2: Number(data.indicados_n2 || 0),
    indicados_n3: Number(data.indicados_n3 || 0),
    indicados_n4: Number(data.indicados_n4 || 0),
    codigo_convite: data.codigo_convite || user.codigo_convite,
    chave_pix: data.chave_pix || null,
    is_admin: !!data.is_admin,
    is_influencer: !!data.is_influencer,
  });
}
