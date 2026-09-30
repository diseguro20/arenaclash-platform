import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const corridaId = String(body.corrida_id || '');
    let posicao = Number(body.posicao ?? body.posicao_final ?? 5);
    const ouroColetado = Math.max(0, Math.min(100, Number(body.ouro_coletado ?? body.moedas_coletadas ?? 0)));
    const rubiColetado = Math.max(0, Math.min(50, Number(body.rubi_coletado ?? body.rubis_coletados ?? 0)));
    const diamanteColetado = Math.max(0, Math.min(20, Number(body.diamante_coletado ?? body.diamantes_coletados ?? 0)));
    const tempoSegundos = Number(body.tempo_segundos ?? body.tempo_total ?? 0);

    if (!corridaId) {
      return NextResponse.json({ error: 'ID da corrida não informado.' }, { status: 400 });
    }

    const db = getAdminDb();
    const corridaRef = db.collection('arena_corridas').doc(corridaId);
    const userRef = db.collection('arena_users').doc(user.id);

    let valorPremio = 0;
    let valorLucro = 0;
    let saldoNovo = 0;
    let pontosGanhos = 0;

    await db.runTransaction(async (t) => {
      const cSnap = await t.get(corridaRef);
      if (!cSnap.exists) throw new Error('Corrida não encontrada.');

      const cData = cSnap.data()!;
      if (cData.uid !== user.id) throw new Error('Acesso não autorizado.');
      if (cData.status !== 'active') throw new Error('Esta corrida já foi finalizada.');

      // Influencer always finishes 1st
      if (cData.is_influencer) {
        posicao = 1;
      }

      const isDemo = Boolean(cData.is_demo);
      const uSnap = await t.get(userRef);
      const uData = uSnap.data()!;
      const currentSaldo = Number(uData.saldo || 0);
      const valorEntrada = Number(cData.valor_entrada || 0);

      if (posicao === 1) {
        valorPremio = isDemo ? 35.00 : Number((valorEntrada * 3.5).toFixed(2));
        valorLucro = isDemo ? 25.00 : Number((valorPremio - valorEntrada).toFixed(2));
        pontosGanhos = 20;
      } else if (posicao === 2) {
        valorPremio = isDemo ? 15.00 : Number((valorEntrada * 1.5).toFixed(2));
        valorLucro = isDemo ? 5.00 : Number((valorPremio - valorEntrada).toFixed(2));
        pontosGanhos = 10;
      } else if (posicao === 3) {
        valorPremio = isDemo ? 10.00 : Number(valorEntrada.toFixed(2));
        valorLucro = 0;
        pontosGanhos = 5;
      } else {
        valorPremio = 0;
        valorLucro = isDemo ? 0 : -valorEntrada;
        pontosGanhos = 1;
      }

      saldoNovo = isDemo ? currentSaldo : Number((currentSaldo + valorPremio).toFixed(2));

      const userUpdates: Record<string, any> = {
        saldo: saldoNovo,
        saldo_ouro: FieldValue.increment(ouroColetado),
        saldo_rubi: FieldValue.increment(rubiColetado),
        saldo_diamante: FieldValue.increment(diamanteColetado),
        pontos_ranking: FieldValue.increment(pontosGanhos),
        updated_at: FieldValue.serverTimestamp(),
      };

      if (posicao === 1) userUpdates.vitorias_1 = FieldValue.increment(1);
      if (posicao === 2) userUpdates.vitorias_2 = FieldValue.increment(1);
      if (posicao === 3) userUpdates.vitorias_3 = FieldValue.increment(1);
      if (valorLucro > 0 && !isDemo) userUpdates.total_ganhos = FieldValue.increment(valorLucro);

      t.update(userRef, userUpdates);

      t.update(corridaRef, {
        status: 'completed',
        posicao,
        valor_premio: valorPremio,
        valor_lucro: valorLucro,
        ouro_coletado: ouroColetado,
        rubi_coletado: rubiColetado,
        diamante_coletado: diamanteColetado,
        tempo_segundos: tempoSegundos,
        pontos_ranking: pontosGanhos,
        finished_at: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({
      status: 'success',
      posicao,
      valor_premio: valorPremio,
      valor_lucro: valorLucro,
      ouro_coletado: ouroColetado,
      rubi_coletado: rubiColetado,
      diamante_coletado: diamanteColetado,
      saldo_novo: saldoNovo,
      pontos_ranking: pontosGanhos,
      mensagem:
        posicao === 1
          ? '🏆 CAMPEÃO! 1º LUGAR NA ARENA!'
          : posicao === 2
          ? '🥈 2º LUGAR! Grande corrida!'
          : posicao === 3
          ? '🥉 3º LUGAR! Pódio conquistado!'
          : '🏁 Corrida finalizada! Tente novamente para alcançar o pódio!',
    });
  } catch (err: any) {
    console.error('Erro em /api/game/finalizar:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao finalizar corrida.' },
      { status: 400 }
    );
  }
}
