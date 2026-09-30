import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    aposta_minima: 1,
    aposta_maxima: 100,
    valor_por_plataforma: 0.1,
    multiplicador_padrao: 3,
    multiplicador: 3,
    taxa_por_plataforma: 0.1,
    entrada_valores_rapidos: [1, 2, 5, 10, 20, 50],
  });
}
