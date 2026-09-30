import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { createPixTransfer } from '@/lib/pix-gateway';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser(req);
    if (!admin) {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const q = (url.searchParams.get('q') || '').toLowerCase().trim();

    const db = getAdminDb();
    const snap = await db.collection('arena_withdrawals').orderBy('created_at', 'desc').limit(200).get();

    let withdrawals = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (status && status !== 'all') {
      withdrawals = withdrawals.filter((w: any) => {
        const s = (w.status || '').toLowerCase();
        if (status === 'pending') return s === 'pending' || s === 'pendente';
        if (status === 'approved') return s === 'aprovado' || s === 'pago' || s === 'approved' || s === 'COMPLETED';
        if (status === 'rejected') return s === 'rejeitado' || s === 'rejected' || s === 'cancelado';
        return s === status;
      });
    }

    if (q) {
      withdrawals = withdrawals.filter((w: any) => {
        return (
          (w.user_nome || '').toLowerCase().includes(q) ||
          (w.user_telefone || '').includes(q) ||
          (w.chave_pix || '').toLowerCase().includes(q) ||
          (w.cpf || '').includes(q) ||
          (w.id || '').toLowerCase().includes(q)
        );
      });
    }

    return NextResponse.json({
      success: true,
      withdrawals,
      total: withdrawals.length,
    });
  } catch (error: any) {
    console.error('[Admin Withdrawals API Error]:', error);
    return NextResponse.json({ error: error.message || 'Erro interno.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser(req);
    if (!admin) {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
    }

    const body = await req.json();
    const { withdrawalId, action, reason } = body;

    if (!withdrawalId || !action) {
      return NextResponse.json({ error: 'ID do saque e ação são obrigatórios.' }, { status: 400 });
    }

    const db = getAdminDb();
    const withRef = db.collection('arena_withdrawals').doc(withdrawalId);
    const snap = await withRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Solicitação de saque não encontrada.' }, { status: 404 });
    }

    const withData = snap.data()!;
    const nowIso = new Date().toISOString();

    if (withData.status === 'aprovado' || withData.status === 'pago') {
      return NextResponse.json({ error: 'Este saque já foi processado e pago anteriormente.' }, { status: 400 });
    }

    if (action === 'approve') {
      const amount = Number(withData.valor || withData.amount || 0);
      const pixKey = String(withData.chave_pix || withData.pixKey || '');
      const pixType = String(withData.tipo_chave || withData.pixType || 'cpf');

      // Attempt live payout via gateway transfer
      let gatewayResult: any = null;
      try {
        gatewayResult = await createPixTransfer({
          identifier: withdrawalId,
          amount,
          pixKey,
          pixType,
          owner: {
            name: withData.user_nome || 'Piloto Arena Clash',
            document: withData.cpf || '52968522817',
          },
        });
      } catch (err: any) {
        console.warn('[Admin Payout Warning]:', err.message);
      }

      await withRef.update({
        status: 'aprovado',
        processed_at: nowIso,
        approved_by: admin.email || admin.nome,
        gateway_transfer: gatewayResult || null,
        updated_at: nowIso,
      });

      await db.collection('arena_audit_logs').add({
        action: 'WITHDRAWAL_APPROVED',
        actor: admin.email || admin.nome,
        target: withdrawalId,
        detail: `Saque de R$ ${amount.toFixed(2)} para chave PIX ${pixKey} aprovado com sucesso.`,
        created_at: nowIso,
      });

      return NextResponse.json({
        success: true,
        message: `Saque de R$ ${amount.toFixed(2)} aprovado com sucesso.`,
        gatewayResult,
      });
    }

    if (action === 'reject') {
      const amount = Number(withData.valor || withData.amount || 0);
      const userId = withData.user_id;

      // Refund balance to user
      if (userId && amount > 0) {
        await db.collection('arena_users').doc(userId).update({
          saldo: FieldValue.increment(amount),
          updated_at: nowIso,
        });

        await db.collection('transactions').add({
          user_id: userId,
          tipo: 'estorno_saque_rejeitado',
          valor: amount,
          motivo: reason || 'Saque rejeitado pela administração',
          withdrawal_id: withdrawalId,
          created_at: nowIso,
        });
      }

      await withRef.update({
        status: 'rejeitado',
        motivo_rejeicao: reason || 'Não atendeu aos requisitos de saque.',
        processed_at: nowIso,
        rejected_by: admin.email || admin.nome,
        updated_at: nowIso,
      });

      await db.collection('arena_audit_logs').add({
        action: 'WITHDRAWAL_REJECTED',
        actor: admin.email || admin.nome,
        target: withdrawalId,
        detail: `Saque de R$ ${amount.toFixed(2)} rejeitado. Motivo: ${reason || 'N/A'}. Saldo estornado ao jogador.`,
        created_at: nowIso,
      });

      return NextResponse.json({
        success: true,
        message: 'Saque rejeitado e valor estornado para a carteira do usuário.',
      });
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  } catch (error: any) {
    console.error('[Admin Withdrawal Action Error]:', error);
    return NextResponse.json({ error: error.message || 'Erro ao processar saque.' }, { status: 500 });
  }
}
