import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';

const BOTS_POOL = [
  { name: 'Mateus Do', avatar: 'M', character: 2, speed: 0.96 },
  { name: 'Barry Allen', avatar: 'B', character: 3, speed: 0.98 },
  { name: 'Pedro Lucas', avatar: 'P', character: 4, speed: 0.94 },
  { name: 'Said Gabriel', avatar: 'S', character: 1, speed: 0.95 },
  { name: 'Alex Sandro', avatar: 'A', character: 2, speed: 0.97 },
  { name: 'Lucas Dos', avatar: 'L', character: 3, speed: 0.93 },
  { name: 'Jaqueline de', avatar: 'J', character: 4, speed: 0.92 },
  { name: 'Anny Elly', avatar: 'E', character: 1, speed: 0.94 },
];

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Faça login para correr na arena.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const valorEntrada = Number(body.valor_entrada || 1);
  const modalidade = String(body.modalidade || 'classica');
  const personagemId = Number(body.personagem || 1);

  if (isNaN(valorEntrada) || valorEntrada < 1 || valorEntrada > 3000) {
    return NextResponse.json({ error: 'Valor de aposta inválido (mínimo R$ 1,00, máximo R$ 3.000,00).' }, { status: 400 });
  }

  const db = getAdminDb();
  const userRef = db.collection('arena_users').doc(user.id);
  const corridaId = randomUUID();
  const tokenCorrida = randomUUID();

  // Multiplicadores do Arena Clash:
  // 1º lugar = 3.5x
  // 2º lugar = 1.5x
  // 3º lugar = 1.0x
  const mult1 = 3.5;
  const mult2 = 1.5;
  const mult3 = 1.0;

  // Pick 4 unique bots
  const shuffledBots = [...BOTS_POOL].sort(() => 0.5 - Math.random()).slice(0, 4);

  let finalIsInfluencer = false;
  let novoSaldo = 0;

  await db.runTransaction(async (t) => {
    const userSnap = await t.get(userRef);
    if (!userSnap.exists) throw new Error('Usuário não encontrado.');

    const uData = userSnap.data()!;
    const saldoAtual = Number(uData.saldo || 0);

    if (saldoAtual < valorEntrada) {
      throw new Error('Saldo insuficiente para iniciar a corrida. Realize um depósito via PIX!');
    }

    const isInfluencer = Boolean(uData.is_influencer || user.is_influencer);
    finalIsInfluencer = isInfluencer;

    novoSaldo = Number((saldoAtual - valorEntrada).toFixed(2));
    t.update(userRef, {
      saldo: novoSaldo,
      total_corridas: FieldValue.increment(1),
      updated_at: FieldValue.serverTimestamp(),
    });

    const corridaRef = db.collection('arena_corridas').doc(corridaId);
    t.set(corridaRef, {
      id: corridaId,
      uid: user.id,
      jogador_nome: user.nome || 'Piloto Arena',
      valor_entrada: valorEntrada,
      modalidade,
      personagem: personagemId,
      multiplicador_1: mult1,
      multiplicador_2: mult2,
      multiplicador_3: mult3,
      adversarios: shuffledBots,
      is_influencer: isInfluencer,
      token: tokenCorrida,
      status: 'active',
      created_at: FieldValue.serverTimestamp(),
    });
  });

  return NextResponse.json({
    corrida_id: corridaId,
    token: tokenCorrida,
    valor_entrada: valorEntrada,
    modalidade,
    personagem: personagemId,
    multiplicador_1: mult1,
    multiplicador_2: mult2,
    multiplicador_3: mult3,
    premio_1: Number((valorEntrada * mult1).toFixed(2)),
    premio_2: Number((valorEntrada * mult2).toFixed(2)),
    premio_3: Number((valorEntrada * mult3).toFixed(2)),
    adversarios: shuffledBots,
    saldo_restante: novoSaldo,
    is_influencer: finalIsInfluencer,
  });
}
