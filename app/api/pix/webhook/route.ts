import { NextRequest, NextResponse } from 'next/server';
import { reconcileDeposit } from '@/lib/pix-gateway';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const identifier = url.searchParams.get('identifier');
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const targetId = identifier || (body.identifier as string) || (body.clientIdentifier as string);
    if (!targetId) {
      return NextResponse.json({ error: 'identifier ausente.' }, { status: 400 });
    }

    const db = getAdminDb();
    const depositRef = db.collection('arena_deposits').doc(targetId);
    const snap = await depositRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Depósito não encontrado.' }, { status: 404 });
    }

    const statusRaw = String(body.status || body.transactionStatus || '').toUpperCase();
    const isCompleted =
      ['COMPLETED', 'PAID', 'APROVADO', 'APPROVED', 'SUCCESS', 'CONFIRMED', 'PAGO', 'SETTLED'].includes(statusRaw) ||
      Boolean(body.payedAt);

    if (isCompleted) {
      await db.runTransaction(async (t) => {
        const dFresh = await t.get(depositRef);
        const dData = dFresh.data();
        if (!dData || dData.status === 'aprovado') return;

        const uid = dData.uid;
        const amount = Number(dData.amount || 0);
        const bonus = Number(dData.bonusAmount || 0);
        const totalCredit = amount + bonus;

        const userRef = db.collection('arena_users').doc(uid);
        const userSnap = await t.get(userRef);
        if (userSnap.exists) {
          const uData = userSnap.data()!;
          const currentSaldo = Number(uData.saldo || 0);
          const newSaldo = currentSaldo + totalCredit;

          t.update(userRef, {
            saldo: Number(newSaldo.toFixed(2)),
            total_depositado: FieldValue.increment(amount),
            updated_at: FieldValue.serverTimestamp(),
          });

          // Affiliate commission
          if (uData.indicado_por) {
            const referrerRef = db.collection('arena_users').doc(uData.indicado_por);
            const refSnap = await t.get(referrerRef);
            if (refSnap.exists) {
              const comm = Number((amount * 0.10).toFixed(2));
              t.update(referrerRef, {
                saldo_afiliado: FieldValue.increment(comm),
                total_comissao: FieldValue.increment(comm),
              });
              const commRef = db.collection('arena_commissions').doc();
              t.set(commRef, {
                referrer_id: uData.indicado_por,
                referred_id: uid,
                deposit_id: targetId,
                amount: comm,
                percent: 10,
                created_at: FieldValue.serverTimestamp(),
              });
            }
          }
        }

        t.update(depositRef, {
          status: 'aprovado',
          paid_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });
      });
    } else {
      // Reconcile via gateway verification
      await reconcileDeposit(targetId);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
