import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
import { createPixTransfer } from '@/lib/pix-gateway';

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const body = await req.json();
  const valor = Number(body.valor || 0);
  const chavePix = String(body.chave_pix || '').trim();
  const cpf = String(body.cpf || user.cpf || '52968522817').replace(/\D/g, '');
  const pixType = String(body.pix_type || 'cpf');

  if (isNaN(valor) || valor < 20) {
    return NextResponse.json({ error: 'Valor mínimo para saque é de R$ 20,00.' }, { status: 400 });
  }
  if (!chavePix) {
    return NextResponse.json({ error: 'Informe a chave PIX para saque.' }, { status: 400 });
  }

  const db = getAdminDb();
  const userRef = db.collection('arena_users').doc(user.id);
  let saldoNovo = 0;
  const saqueId = randomUUID();

  try {
    await db.runTransaction(async (t) => {
      const uSnap = await t.get(userRef);
      const uData = uSnap.data()!;
      const saldoAtual = Number(uData.saldo || 0);

      if (saldoAtual < valor) {
        throw new Error('Saldo insuficiente para o valor solicitado.');
      }

      saldoNovo = Number((saldoAtual - valor).toFixed(2));
      t.update(userRef, {
        saldo: saldoNovo,
        chave_pix: chavePix,
        cpf: cpf || uData.cpf || null,
        total_sacado: FieldValue.increment(valor),
        updated_at: FieldValue.serverTimestamp(),
      });

      const saqueRef = db.collection('arena_withdrawals').doc(saqueId);
      t.set(saqueRef, {
        id: saqueId,
        uid: user.id,
        tipo: 'saldo_normal',
        valor,
        chave_pix: chavePix,
        pix_type: pixType,
        cpf,
        status: 'processando',
        created_at: FieldValue.serverTimestamp(),
      });
    });

    // Payout automático via API PIX dos Gateways
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '177.18.200.5';
    const payoutResult = await createPixTransfer({
      identifier: `wtd_${saqueId.slice(0, 12)}`,
      amount: valor,
      pixKey: chavePix,
      pixType,
      owner: {
        name: user.nome || 'Piloto Arena Clash',
        document: cpf,
        ip,
      },
    });

    const finalStatus = payoutResult.executed ? 'aprovado' : 'pendente';
    await db.collection('arena_withdrawals').doc(saqueId).update({
      status: finalStatus,
      gateway: payoutResult.provider,
      gateway_result: payoutResult.result || null,
      gateway_note: payoutResult.note || null,
      updated_at: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      status: 'success',
      saldo_novo: saldoNovo,
      saque_status: finalStatus,
      gateway: payoutResult.provider,
      message: payoutResult.executed
        ? 'Saque transferido via PIX com sucesso!'
        : 'Solicitação de saque enviada com sucesso.',
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || 'Erro ao processar saque.' }, { status: 400 });
  }
}
