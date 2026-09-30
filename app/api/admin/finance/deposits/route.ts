import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { reconcileDeposit } from '@/lib/pix-gateway';

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
    let query: any = db.collection('arena_deposits').orderBy('created_at', 'desc').limit(200);

    const snap = await query.get();
    let deposits = snap.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (status && status !== 'all') {
      deposits = deposits.filter((d: any) => {
        const s = (d.status || '').toLowerCase();
        if (status === 'pending') return s === 'pending' || s === 'pendente';
        if (status === 'approved') return s === 'aprovado' || s === 'completed' || s === 'approved';
        if (status === 'failed') return s === 'failed' || s === 'falhou' || s === 'expired';
        return s === status;
      });
    }

    if (q) {
      deposits = deposits.filter((d: any) => {
        return (
          (d.user_nome || '').toLowerCase().includes(q) ||
          (d.user_telefone || '').includes(q) ||
          (d.user_email || '').toLowerCase().includes(q) ||
          (d.gateway || '').toLowerCase().includes(q) ||
          (d.id || '').toLowerCase().includes(q)
        );
      });
    }

    return NextResponse.json({
      success: true,
      deposits,
      total: deposits.length,
    });
  } catch (error: any) {
    console.error('[Admin Deposits API Error]:', error);
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
    const { depositId, action } = body;

    if (!depositId) {
      return NextResponse.json({ error: 'ID do depósito é obrigatório.' }, { status: 400 });
    }

    const db = getAdminDb();
    const depRef = db.collection('arena_deposits').doc(depositId);
    const snap = await depRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Depósito não encontrado.' }, { status: 404 });
    }

    const depData = snap.data()!;

    if (action === 'force_approve') {
      const reconciled = await reconcileDeposit(depositId);

      await db.collection('arena_audit_logs').add({
        action: 'DEPOSIT_FORCE_APPROVED',
        actor: admin.email || admin.nome,
        target: depositId,
        detail: `Depósito de R$ ${Number(depData.valor || 0).toFixed(2)} aprovado manualmente pelo administrador.`,
        created_at: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        message: 'Depósito aprovado e saldo creditado com sucesso.',
        reconciled,
      });
    }

    return NextResponse.json({ error: 'Ação não suportada.' }, { status: 400 });
  } catch (error: any) {
    console.error('[Admin Deposits Action Error]:', error);
    return NextResponse.json({ error: error.message || 'Erro ao processar depósito.' }, { status: 500 });
  }
}
