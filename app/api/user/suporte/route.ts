import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    links: [
      {
        nome: 'Suporte Oficial WhatsApp',
        url: 'https://wa.link/5obr8i',
      },
    ],
  });
}
