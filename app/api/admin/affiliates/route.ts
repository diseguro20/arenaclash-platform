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
    const [usersSnap, depositsSnap] = await Promise.all([
      db.collection('arena_users').get(),
      db.collection('arena_deposits').where('status', 'in', ['aprovado', 'COMPLETED', 'approved']).get(),
    ]);

    const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const approvedDeposits = depositsSnap.docs.map((d) => d.data());

    // Map referral counts and revenue
    const affiliateMap = new Map<string, any>();

    users.forEach((u: any) => {
      if (u.codigo_convite) {
        affiliateMap.set(u.codigo_convite.toUpperCase(), {
          id: u.id,
          nome: u.nome || 'Jogador',
          telefone: u.telefone || '',
          email: u.email || '',
          codigo: u.codigo_convite.toUpperCase(),
          is_influencer: Boolean(u.is_influencer),
          saldo_afiliado: Number(u.saldo_afiliado || 0),
          comissao_total: Number(u.total_comissoes_geradas || u.saldo_afiliado || 0),
          comissao_paga: Number(u.total_comissoes_pagas || 0),
          leads: 0,
          deposits_count: 0,
          revenue_generated: 0,
        });
      }
    });

    // Count referred users
    users.forEach((u: any) => {
      const ref = (u.indicado_por || '').toUpperCase();
      if (ref && affiliateMap.has(ref)) {
        const aff = affiliateMap.get(ref);
        aff.leads += 1;
      }
    });

    // Count revenue from approved deposits
    approvedDeposits.forEach((dep: any) => {
      const ref = (dep.indicado_por || dep.affiliate_code || '').toUpperCase();
      if (ref && affiliateMap.has(ref)) {
        const aff = affiliateMap.get(ref);
        aff.deposits_count += 1;
        aff.revenue_generated += Number(dep.valor || dep.amount || 0);
      }
    });

    // Only return users who have referred someone, have balance, or are influencers
    const affiliates = Array.from(affiliateMap.values())
      .filter((a) => a.leads > 0 || a.saldo_afiliado > 0 || a.is_influencer)
      .sort((a, b) => b.revenue_generated - a.revenue_generated || b.leads - a.leads);

    const totalLeads = affiliates.reduce((s, a) => s + a.leads, 0);
    const totalRevenueAttributed = affiliates.reduce((s, a) => s + a.revenue_generated, 0);
    const totalCommissionsAvailable = affiliates.reduce((s, a) => s + a.saldo_afiliado, 0);

    return NextResponse.json({
      success: true,
      stats: {
        totalAffiliates: affiliates.length,
        totalLeads,
        totalRevenueAttributed,
        totalCommissionsAvailable,
      },
      affiliates,
    });
  } catch (error: any) {
    console.error('[Admin Affiliates API Error]:', error);
    return NextResponse.json({ error: error.message || 'Erro interno.' }, { status: 500 });
  }
}
