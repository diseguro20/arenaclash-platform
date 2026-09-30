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
      saldo: user.saldo,
      saldo_bonus: user.saldo_bonus,
      saldo_afiliado: user.saldo_afiliado,
      codigo_convite: user.codigo_convite,
      chave_pix: user.chave_pix,
      cpf: user.cpf,
      is_admin: user.is_admin,
    },
    csrf,
  });
}
