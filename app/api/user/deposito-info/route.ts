import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    limites: {
      deposito_minimo: 20,
      deposito_maximo: 5000,
      saque_minimo: 20,
      saque_maximo: 5000,
      saque_afiliado_minimo: 10,
      saque_afiliado_maximo: 5000,
    },
    valores_rapidos: [20, 30, 50, 100],
    temDireito: true,
    perc: 50,
    minimo: 20,
    maximo: 5000,
    bonus_percent_global: 50,
    bonus: [
      { valor: 20, bonus: 5 },
      { valor: 30, bonus: 10 },
      { valor: 50, bonus: 20 },
      { valor: 100, bonus: 50 },
    ],
  });
}
