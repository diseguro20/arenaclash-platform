/**
 * KRS Creator Hub Integration for Salto Cash
 * Dispatches real-time conversion webhooks (signups, deposits) to KRS Creator Hub
 */

const KRS_WEBHOOK_URL = process.env.KRS_WEBHOOK_URL || 'https://krs-creator-hub.vercel.app/api/webhooks/conversions';
const KRS_WEBHOOK_SECRET = process.env.KRS_WEBHOOK_SECRET || 'krs_sec_live_99f821a084c7e481b3';

export async function notifyKrsHubConversion(params: {
  affiliateCode: string;
  eventType: 'signup' | 'deposit';
  amountDeposited?: number;
  commissionAmount?: number;
  playerName: string;
  playerId: string;
  playerEmail?: string;
  transactionId?: string;
  gateway?: 'vizzionpay' | 'omegapay';
}) {
  const code = String(params.affiliateCode || '').trim();
  if (!code || code === 'null' || code === 'undefined') return;

  try {
    const payload = {
      game_slug: 'salto-cash',
      game_name: 'Salto Cash',
      affiliate_code: code,
      event_type: params.eventType,
      amount_deposited: params.amountDeposited || 0,
      commission_amount: params.commissionAmount || 0,
      player_name: params.playerName,
      player_id: params.playerId,
      player_email: params.playerEmail,
      transaction_id: params.transactionId || `sc_${Date.now()}`,
      gateway: params.gateway || 'vizzionpay',
    };

    console.log(`[KRS Creator Hub] Notificando conversão: ${params.eventType} para afiliado '${code}'...`);

    fetch(KRS_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-krs-secret': KRS_WEBHOOK_SECRET,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    })
      .then(async (res) => {
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          console.warn(`[KRS Hub Webhook Response ${res.status}]:`, txt);
        } else {
          console.log(`[KRS Hub Webhook Sucesso] Evento ${params.eventType} registrado para '${code}'.`);
        }
      })
      .catch((err) => {
        console.warn('[KRS Hub Webhook Non-blocking Warning]:', err.message);
      });
  } catch (e) {
    // Non-blocking
  }
}
