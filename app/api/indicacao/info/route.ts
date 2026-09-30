import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const db = getAdminDb();
  const userDoc = await db.collection('arena_users').doc(user.id).get();
  const data = userDoc.data() || {};

  const appUrl = (process.env.APP_URL || 'https://arenaclash-platform.vercel.app').replace(/\/$/, '');
  const codigo = data.codigo_convite || user.codigo_convite;
  const link = `${appUrl}/#cadastro?ref=${codigo}`;

  const commSnap = await db.collection('arena_commissions').where('referrer_id', '==', user.id).limit(10).get();
  const indicadosRecentes = commSnap.docs.map((doc) => {
    const c = doc.data();
    return {
      id: doc.id,
      nome: 'Jogador Indicado',
      comissao: Number(c.amount || 0),
      data: c.created_at?.toDate ? c.created_at.toDate().toLocaleDateString('pt-BR') : 'Hoje',
    };
  });

  return NextResponse.json({
    link,
    codigo,
    saldo_afiliado: Number(data.saldo_afiliado || 0),
    total_indicados: Number(data.total_indicados || 0),
    indicados_n1: Number(data.indicados_n1 || data.total_indicados || 0),
    indicados_n2: Number(data.indicados_n2 || 0),
    indicados_n3: Number(data.indicados_n3 || 0),
    indicados_n4: Number(data.indicados_n4 || 0),
    comissao_n1: 10,
    comissao_n2: 5,
    comissao_n3: 2,
    comissao_n4: 1,
    niveis_visiveis: {
      n1: true,
      n2: true,
      n3: true,
      n4: true,
      show_total_depositos: true,
    },
    indicados_recentes: indicadosRecentes,
  });
}
