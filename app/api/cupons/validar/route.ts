import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const body = await req.json();
  const codigo = String(body.codigo || '').trim().toUpperCase();

  if (codigo === 'SALTO10' || codigo === 'BONUS20' || codigo === 'HELIXVIP') {
    const valor = codigo === 'BONUS20' ? 20 : 10;
    return NextResponse.json({
      valido: true,
      codigo,
      valor_bonus: valor,
      descricao: `Cupom de R$ ${valor},00 em bônus!`,
    });
  }

  return NextResponse.json({ error: 'Cupom inválido ou expirado.' }, { status: 400 });
}
