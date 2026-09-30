import { NextRequest, NextResponse } from 'next/server';
import { generateCsrf, getAuthenticatedUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const csrf = generateCsrf();
  return NextResponse.json({
    user: {
      id: user.id,
      nome: user.nome,
      telefone: user.telefone,
      email: user.email,
      saldo: user.saldo ?? 0,
      saldo_ouro: user.saldo_ouro ?? 100,
      saldo_rubi: user.saldo_rubi ?? 10,
      saldo_diamante: user.saldo_diamante ?? 5,
      saldo_bonus: user.saldo_bonus ?? 0,
      saldo_afiliado: user.saldo_afiliado ?? 0,
      codigo_convite: user.codigo_convite,
      chave_pix: user.chave_pix,
      cpf: user.cpf,
      is_admin: Boolean(user.is_admin),
      is_influencer: Boolean(user.is_influencer),
      vitorias_1: user.vitorias_1 ?? 0,
      vitorias_2: user.vitorias_2 ?? 0,
      vitorias_3: user.vitorias_3 ?? 0,
    },
    csrf,
  });
}
