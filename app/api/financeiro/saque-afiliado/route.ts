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

  if (isNaN(valor) || valor < 10) {
    return NextResponse.json({ error: 'Valor mínimo para saque de comissão é de R$ 10,00.' }, { status: 400 });
  }
  if (!chavePix) {
    return NextResponse.json({ error: 'Informe a chave PIX para saque.' }, { status: 400 });
  }

  const db = getAdminDb();
  const userRef = db.collection('arena_users').doc(user.id);
  let saldoAfiliadoNovo = 0;
  const saqueId = randomUUID();

  try {
    await db.runTransaction(async (t) => {
      const uSnap = await t.get(userRef);
      const uData = uSnap.data()!;
      const saldoAfilAtual = Number(uData.saldo_afiliado || 0);

      if (saldoAfilAtual < valor) {
        throw new Error('Saldo de comissão insuficiente.');
      }

      saldoAfiliadoNovo = Number((saldoAfilAtual - valor).toFixed(2));
      t.update(userRef, {
        saldo_afiliado: saldoAfiliadoNovo,
        chave_pix: chavePix,
        cpf: cpf || uData.cpf || null,
        updated_at: FieldValue.serverTimestamp(),
      });

      const saqueRef = db.collection('arena_withdrawals').doc(saqueId);
      t.set(saqueRef, {
        id: saqueId,
        uid: user.id,
        tipo: 'comissao_afiliado',
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
      identifier: `wtd_aff_${saqueId.slice(0, 12)}`,
      amount: valor,
      pixKey: chavePix,
      pixType,
      owner: {
        name: user.nome || 'Afiliado Arena Clash',
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
      saldo_afiliado_novo: saldoAfiliadoNovo,
      saque_status: finalStatus,
      gateway: payoutResult.provider,
      message: payoutResult.executed
        ? 'Saque de comissão transferido via PIX com sucesso!'
        : 'Solicitação de saque de comissão enviada com sucesso.',
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || 'Erro ao processar saque de comissão.' }, { status: 400 });
  }
}
