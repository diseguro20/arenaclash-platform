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

    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').toLowerCase().trim();

    const db = getAdminDb();
    const snap = await db.collection('arena_users').orderBy('created_at', 'desc').limit(200).get();

    let users = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        nome: d.nome || 'Jogador',
        telefone: d.telefone || '',
        email: d.email || '',
        saldo: Number(d.saldo || 0),
        saldo_bonus: Number(d.saldo_bonus || 0),
        saldo_afiliado: Number(d.saldo_afiliado || 0),
        status: d.status || 'active',
        is_admin: Boolean(d.is_admin),
        is_influencer: Boolean(d.is_influencer),
        influencer_rate1: Number(d.influencer_rate1 || 10),
        influencer_rate2: Number(d.influencer_rate2 || 2),
        codigo_convite: d.codigo_convite || doc.id.slice(0, 6).toUpperCase(),
        indicado_por: d.indicado_por || null,
        cpf: d.cpf || null,
        chave_pix: d.chave_pix || null,
        partidas: Number(d.total_partidas || d.partidas || 0),
        created_at: d.created_at || null,
        last_login: d.last_login || null,
      };
    });

    if (q) {
      users = users.filter((u) => {
        return (
          u.nome.toLowerCase().includes(q) ||
          u.telefone.includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.codigo_convite.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q)
        );
      });
    }

    return NextResponse.json({
      success: true,
      users,
      total: users.length,
    });
  } catch (error: any) {
    console.error('[Admin Users API Error]:', error);
    return NextResponse.json({ error: error.message || 'Erro interno.' }, { status: 500 });
  }
}
