import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const tipo = url.searchParams.get('tipo') || 'semanal';

    const db = getAdminDb();
    const snap = await db.collection('arena_users')
      .orderBy('pontos_ranking', 'desc')
      .limit(20)
      .get()
      .catch(() => null);

    const rankingDb = snap && !snap.empty ? snap.docs.map((doc, idx) => {
      const data = doc.data();
      return {
        posicao: idx + 1,
        nome: data.nome || `Piloto ${idx + 1}`,
        avatar: (data.nome || 'P')[0].toUpperCase(),
        pontos: Number(data.pontos_ranking || 0),
        vitorias_1: Number(data.vitorias_1 || 0),
      };
    }) : [];

    const defaultRanking = [
      { posicao: 1, nome: 'ALEX SANDRO', avatar: 'A', pontos: 60, vitorias_1: 3 },
      { posicao: 2, nome: 'Deivid Medina', avatar: 'D', pontos: 52, vitorias_1: 2 },
      { posicao: 3, nome: 'Mateus Do', avatar: 'M', pontos: 48, vitorias_1: 2 },
      { posicao: 4, nome: 'Barry Allen', avatar: 'B', pontos: 40, vitorias_1: 2 },
      { posicao: 5, nome: 'Pedro Lucas', avatar: 'P', pontos: 35, vitorias_1: 1 },
      { posicao: 6, nome: 'Said Gabriel', avatar: 'S', pontos: 31, vitorias_1: 1 },
      { posicao: 7, nome: 'Lucas Dos', avatar: 'L', pontos: 28, vitorias_1: 1 },
      { posicao: 8, nome: 'Jaqueline de', avatar: 'J', pontos: 24, vitorias_1: 1 },
      { posicao: 9, nome: 'Anny Elly', avatar: 'E', pontos: 18, vitorias_1: 0 },
      { posicao: 10, nome: 'Alcedina Marta', avatar: 'A', pontos: 15, vitorias_1: 0 },
    ];

    const ranking = rankingDb.length > 0 ? rankingDb : defaultRanking;

    return NextResponse.json({
      tipo,
      ranking,
    });
  } catch (err) {
    return NextResponse.json({
      tipo: 'semanal',
      ranking: [
        { posicao: 1, nome: 'ALEX SANDRO', avatar: 'A', pontos: 60, vitorias_1: 3 },
        { posicao: 2, nome: 'Deivid Medina', avatar: 'D', pontos: 52, vitorias_1: 2 },
        { posicao: 3, nome: 'Mateus Do', avatar: 'M', pontos: 48, vitorias_1: 2 },
        { posicao: 4, nome: 'Barry Allen', avatar: 'B', pontos: 40, vitorias_1: 2 },
        { posicao: 5, nome: 'Pedro Lucas', avatar: 'P', pontos: 35, vitorias_1: 1 },
      ]
    });
  }
}
