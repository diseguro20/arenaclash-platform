import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser(req);
    if (!admin) {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
    }

    const db = getAdminDb();
    const doc = await db.collection('platform_settings').doc('global').get();

    const data = doc.exists ? doc.data() : {};
    return NextResponse.json({
      success: true,
      settings: {
        difficulty: data?.difficulty || 'balanced',
        maintenance: Boolean(data?.maintenance),
        vizzionPercent: Number(data?.vizzionPercent || 80),
        omegaPercent: Number(data?.omegaPercent || 20),
        minDeposit: Number(data?.minDeposit || 10),
        maxDeposit: Number(data?.maxDeposit || 500),
        minWithdrawal: Number(data?.minWithdrawal || 20),
        minBet: Number(data?.minBet || 1),
        maxBet: Number(data?.maxBet || 100),
        affiliateRate1: Number(data?.affiliateRate1 || 10),
        affiliateRate2: Number(data?.affiliateRate2 || 2),
      },
    });
  } catch (error: any) {
    console.error('[Admin Settings GET Error]:', error);
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
    const db = getAdminDb();
    const nowIso = new Date().toISOString();

    const updated = {
      difficulty: body.difficulty || 'balanced',
      maintenance: Boolean(body.maintenance),
      vizzionPercent: Number(body.vizzionPercent ?? 80),
      omegaPercent: Number(body.omegaPercent ?? 20),
      minDeposit: Number(body.minDeposit ?? 10),
      maxDeposit: Number(body.maxDeposit ?? 500),
      minWithdrawal: Number(body.minWithdrawal ?? 20),
      minBet: Number(body.minBet ?? 1),
      maxBet: Number(body.maxBet ?? 100),
      affiliateRate1: Number(body.affiliateRate1 ?? 10),
      affiliateRate2: Number(body.affiliateRate2 ?? 2),
      updated_at: nowIso,
      updated_by: admin.email || admin.nome,
    };

    await db.collection('platform_settings').doc('global').set(updated, { merge: true });

    await db.collection('arena_audit_logs').add({
      action: 'SETTINGS_UPDATE',
      actor: admin.email || admin.nome,
      target: 'global_settings',
      detail: `Configurações da plataforma atualizadas: Dificuldade=${updated.difficulty}, Manutenção=${updated.maintenance}, Gateways=${updated.vizzionPercent}%/${updated.omegaPercent}%`,
      created_at: nowIso,
    });

    return NextResponse.json({
      success: true,
      message: 'Configurações atualizadas com sucesso.',
      settings: updated,
    });
  } catch (error: any) {
    console.error('[Admin Settings POST Error]:', error);
    return NextResponse.json({ error: error.message || 'Erro interno.' }, { status: 500 });
  }
}
