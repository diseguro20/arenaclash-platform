import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const body = await req.json();
  const codigo = String(body.codigo || '').trim().toUpperCase();

  if (!['SALTO10', 'BONUS20', 'HELIXVIP'].includes(codigo)) {
    return NextResponse.json({ error: 'Cupom inválido.' }, { status: 400 });
  }

  const db = getAdminDb();
  const cupomId = `coupon_${user.id}_${codigo}`;
  const redeemedRef = db.collection('coupons_redeemed').doc(cupomId);
  const snap = await redeemedRef.get();

  if (snap.exists) {
    return NextResponse.json({ error: 'Você já resgatou este cupom.' }, { status: 400 });
  }

  const valorBonus = codigo === 'BONUS20' ? 20 : 10;
  const userRef = db.collection('arena_users').doc(user.id);

  let saldoNovo = 0;
  await db.runTransaction(async (t) => {
    const uSnap = await t.get(userRef);
    const uData = uSnap.data()!;
    saldoNovo = Number((Number(uData.saldo || 0) + valorBonus).toFixed(2));

    t.update(userRef, {
      saldo: saldoNovo,
      saldo_bonus: FieldValue.increment(valorBonus),
      updated_at: FieldValue.serverTimestamp(),
    });

    t.set(redeemedRef, {
      uid: user.id,
      codigo,
      valor_bonus: valorBonus,
      redeemed_at: FieldValue.serverTimestamp(),
    });
  });

  return NextResponse.json({
    status: 'success',
    saldo_novo: saldoNovo,
    message: `Parabéns! R$ ${valorBonus},00 adicionados ao seu saldo.`,
  });
}
