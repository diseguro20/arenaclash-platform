import { createVizzionPix, getVizzionTransaction, createVizzionTransfer } from './vizzion';
import { createOmegaPix, getOmegaTransaction, createOmegaTransfer } from './omega';
import { getAdminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { notifyKrsHubConversion } from './krs-hub';

export type GatewayProvider = 'vizzion' | 'omega';

/**
 * Routes 80% of operations to Vizzion Pay, 20% to Omega Pay
 */
export function selectGateway(): GatewayProvider {
  return Math.random() < 0.80 ? 'vizzion' : 'omega';
}

export async function createPixCharge(params: {
  identifier: string;
  amount: number;
  client: { name: string; email: string; phone?: string; document?: string };
  callbackUrl?: string;
  preferredGateway?: GatewayProvider;
}) {
  const primary = params.preferredGateway || selectGateway();
  const secondary = primary === 'vizzion' ? 'omega' : 'vizzion';

  // Try primary gateway
  try {
    if (primary === 'vizzion') {
      const res = await createVizzionPix(params);
      return { provider: 'vizzion' as GatewayProvider, result: res };
    } else {
      const res = await createOmegaPix(params);
      return { provider: 'omega' as GatewayProvider, result: res };
    }
  } catch (errPrimary) {
    console.warn(`Primary gateway ${primary} failed, falling back to ${secondary}:`, errPrimary);
    try {
      if (secondary === 'vizzion') {
        const res = await createVizzionPix(params);
        return { provider: 'vizzion' as GatewayProvider, result: res };
      } else {
        const res = await createOmegaPix(params);
        return { provider: 'omega' as GatewayProvider, result: res };
      }
    } catch (errSecondary) {
      throw new Error(`Ambos os gateways falharam: ${(errPrimary as Error)?.message || ''} | ${(errSecondary as Error)?.message || ''}`);
    }
  }
}

export async function createPixTransfer(params: {
  identifier: string;
  amount: number;
  pixKey: string;
  pixType?: string;
  owner: { name: string; document: string; ip?: string };
  preferredGateway?: GatewayProvider;
}) {
  const primary = params.preferredGateway || selectGateway();
  const secondary = primary === 'vizzion' ? 'omega' : 'vizzion';

  // Normalize pix type to: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random'
  let normalizedType: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random' = 'cpf';
  const rawType = (params.pixType || '').toLowerCase();
  if (rawType.includes('cnpj')) normalizedType = 'cnpj';
  else if (rawType.includes('email')) normalizedType = 'email';
  else if (rawType.includes('fone') || rawType.includes('phone') || rawType.includes('celular')) normalizedType = 'phone';
  else if (rawType.includes('evp') || rawType.includes('aleat') || rawType.includes('random')) normalizedType = 'random';
  else if (params.pixKey.includes('@')) normalizedType = 'email';
  else if (params.pixKey.replace(/\D/g, '').length === 11) normalizedType = 'cpf';
  else if (params.pixKey.replace(/\D/g, '').length === 14) normalizedType = 'cnpj';

  const transferPayload = {
    identifier: params.identifier,
    amount: params.amount,
    pix: {
      key: params.pixKey,
      type: normalizedType,
    },
    owner: {
      name: params.owner.name || 'Piloto Arena Clash',
      document: {
        number: params.owner.document.replace(/\D/g, '') || '52968522817',
        type: 'cpf' as const,
      },
      ip: params.owner.ip || '177.18.200.5',
    },
  };

  try {
    if (primary === 'vizzion') {
      const res = await createVizzionTransfer(transferPayload);
      return { provider: 'vizzion' as GatewayProvider, result: res, executed: true };
    } else {
      const res = await createOmegaTransfer(transferPayload);
      return { provider: 'omega' as GatewayProvider, result: res, executed: true };
    }
  } catch (errPrimary) {
    console.warn(`Primary payout gateway ${primary} failed, trying secondary ${secondary}:`, (errPrimary as Error)?.message);
    try {
      if (secondary === 'vizzion') {
        const res = await createVizzionTransfer(transferPayload);
        return { provider: 'vizzion' as GatewayProvider, result: res, executed: true };
      } else {
        const res = await createOmegaTransfer(transferPayload);
        return { provider: 'omega' as GatewayProvider, result: res, executed: true };
      }
    } catch (errSecondary) {
      console.warn(`Both payout gateways returned response:`, (errSecondary as Error)?.message);
      return {
        provider: primary,
        result: null,
        executed: false,
        note: (errPrimary as Error)?.message || (errSecondary as Error)?.message || 'Aguardando liberação de permissão de saque na conta da adquirente.',
      };
    }
  }
}

export async function getGatewayTransaction(provider: GatewayProvider, id: string, identifier: string) {
  if (provider === 'vizzion') {
    return getVizzionTransaction(id, identifier);
  } else {
    return getOmegaTransaction(id, identifier);
  }
}

/**
 * Reconcile deposit payment, credit user balance, update affiliate commission
 */
export async function reconcileDeposit(identifier: string) {
  const db = getAdminDb();
  const depositRef = db.collection('arena_deposits').doc(identifier);
  const snap = await depositRef.get();
  if (!snap.exists) return null;

  const deposit = snap.data()!;
  if (deposit.status === 'aprovado' || deposit.status === 'COMPLETED') {
    return deposit;
  }

  // Check with gateway if pending
  const provider = (deposit.provider || 'vizzion') as GatewayProvider;
  let isPaid = false;

  try {
    const tx = await getGatewayTransaction(provider, deposit.transactionId || identifier, identifier);
    if (tx) {
      const statusUpper = String(tx.status || (tx as any).transactionStatus || '').toUpperCase();
      if (
        ['COMPLETED', 'PAID', 'APPROVED', 'APROVADO', 'SUCCESS', 'CONFIRMED', 'PAGO', 'SETTLED'].includes(statusUpper) ||
        Boolean((tx as any).payedAt)
      ) {
        isPaid = true;
      }
    }
  } catch (err) {
    console.error('Error checking gateway transaction:', err);
  }

  if (isPaid) {
    await db.runTransaction(async (t) => {
      const dFresh = await t.get(depositRef);
      const dData = dFresh.data();
      if (!dData || dData.status === 'aprovado' || dData.status === 'COMPLETED') return;

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

        // Affiliate commission (10% on deposit to direct referrer)
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
              deposit_id: identifier,
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

    // Notify KRS Creator Hub of deposit
    try {
      const userDoc = await db.collection('arena_users').doc(deposit.uid).get();
      if (userDoc.exists) {
        const u = userDoc.data()!;
        const affCode = u.indicado_por_tag || (u.indicado_por ? u.indicado_por.slice(0, 6).toUpperCase() : null);
        if (affCode) {
          notifyKrsHubConversion({
            affiliateCode: affCode,
            eventType: 'deposit',
            amountDeposited: Number(deposit.amount || 0),
            commissionAmount: Number((Number(deposit.amount || 0) * 0.10).toFixed(2)),
            playerName: u.nome || 'Piloto Arena Clash',
            playerId: deposit.uid,
            playerEmail: u.email,
            transactionId: identifier,
            gateway: (deposit.provider === 'omega' ? 'omegapay' : 'vizzionpay') as 'vizzionpay' | 'omegapay',
          });
        }
      }
    } catch (_) {}

    const updatedSnap = await depositRef.get();
    return updatedSnap.data();
  }

  return deposit;
}
