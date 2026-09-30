import { NextRequest, NextResponse } from 'next/server';
import { reconcileDeposit } from '@/lib/pix-gateway';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const txid = url.searchParams.get('txid');

  if (!txid) {
    return NextResponse.json({ error: 'txid obrigatório.' }, { status: 400 });
  }

  const deposit = await reconcileDeposit(txid);
  if (!deposit) {
    return NextResponse.json({ error: 'Depósito não encontrado.' }, { status: 404 });
  }

  const isAprovado = deposit.status === 'aprovado' || deposit.status === 'COMPLETED';

  let saldoNovo = 0;
  if (isAprovado && deposit.uid) {
    const db = getAdminDb();
    const userDoc = await db.collection('arena_users').doc(deposit.uid).get();
    if (userDoc.exists) {
      saldoNovo = Number(userDoc.data()?.saldo || 0);
    }
  }

  return NextResponse.json({
    status: isAprovado ? 'aprovado' : 'pendente',
    valor: Number(deposit.amount || 0),
    saldo_novo: saldoNovo,
  });
}
