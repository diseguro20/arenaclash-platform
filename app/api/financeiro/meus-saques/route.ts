import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const db = getAdminDb();
  const saqSnap = await db.collection('arena_withdrawals').where('uid', '==', user.id).orderBy('created_at', 'desc').limit(50).get();

  const saques = saqSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      valor: Number(d.valor || 0),
      status: d.status || 'pendente',
      chave_pix: d.chave_pix || '',
      pix_type: d.pix_type || 'CPF',
      tipo: d.tipo || 'saldo_normal',
      created_at: d.created_at?.toDate ? d.created_at.toDate().toISOString() : new Date().toISOString(),
    };
  });

  return NextResponse.json({ saques });
}
