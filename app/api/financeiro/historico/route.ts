import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const db = getAdminDb();
  const [depSnap, saqSnap, partSnap] = await Promise.all([
    db.collection('arena_deposits').where('uid', '==', user.id).orderBy('created_at', 'desc').limit(20).get(),
    db.collection('arena_withdrawals').where('uid', '==', user.id).orderBy('created_at', 'desc').limit(20).get(),
    db.collection('arena_corridas').where('uid', '==', user.id).orderBy('created_at', 'desc').limit(20).get(),
  ]);

  const transacoes: Array<{
    tipo: string;
    valor: number;
    status: string;
    descricao?: string;
    data: string;
  }> = [];

  depSnap.docs.forEach((doc) => {
    const d = doc.data();
    transacoes.push({
      tipo: 'deposito',
      valor: Number(d.amount || 0),
      status: d.status === 'aprovado' ? 'concluido' : d.status || 'pendente',
      descricao: `Depósito via PIX (${(d.provider || 'vizzion').toUpperCase()})`,
      data: d.created_at?.toDate ? d.created_at.toDate().toISOString() : new Date().toISOString(),
    });
  });

  saqSnap.docs.forEach((doc) => {
    const d = doc.data();
    transacoes.push({
      tipo: 'saque',
      valor: -Number(d.valor || 0),
      status: d.status || 'pendente',
      descricao: `Saque PIX (${d.chave_pix || ''})`,
      data: d.created_at?.toDate ? d.created_at.toDate().toISOString() : new Date().toISOString(),
    });
  });

  partSnap.docs.forEach((doc) => {
    const d = doc.data();
    if (d.status === 'won') {
      transacoes.push({
        tipo: 'vitoria',
        valor: Number(d.valor_lucro || d.valor_premio || 0),
        status: 'concluido',
        descricao: `Prêmio Helix Jump (${d.plataformas_passadas || 0} plat)`,
        data: d.created_at?.toDate ? d.created_at.toDate().toISOString() : new Date().toISOString(),
      });
    } else if (d.status === 'lost') {
      transacoes.push({
        tipo: 'partida',
        valor: -Number(d.valor_entrada || 0),
        status: 'concluido',
        descricao: 'Partida Helix Jump',
        data: d.created_at?.toDate ? d.created_at.toDate().toISOString() : new Date().toISOString(),
      });
    }
  });

  transacoes.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  return NextResponse.json({
    transacoes,
    total: transacoes.length,
    pagina: 1,
  });
}
