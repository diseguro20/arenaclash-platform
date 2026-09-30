import type { VizzionTransaction } from './vizzion';

const API_URL = (process.env.OMEGA_BASE_URL || 'https://app.omegapayments.com.br').replace(/\/+$/, '');

export type OmegaPixResponse = {
  transactionId: string;
  status: string;
  transactionStatus?: string;
  webhookToken?: string;
  pix?: { code?: string; image?: string; base64?: string };
  order?: { id?: string; url?: string };
  fee?: number;
  details?: unknown;
};

export type OmegaTransferInput = {
  identifier: string;
  amount: number;
  pix: {
    key: string;
    type: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  };
  owner: {
    name: string;
    document: { number: string; type: 'cpf' | 'cnpj' };
    ip?: string;
  };
};

function buildAuthHeaders() {
  const publicKey = (process.env.OMEGA_PUBLIC_KEY || '').trim();
  const secretKey = (process.env.OMEGA_SECRET_KEY || '').trim();
  if (!publicKey || !secretKey) throw new Error('Omega Pay não configurada.');

  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'x-public-key': publicKey,
    'x-secret-key': secretKey,
    'x-client-id': publicKey,
    'client-id': publicKey,
    'x-client-secret': secretKey,
    'client-secret': secretKey,
    'Authorization': `Bearer ${secretKey}`,
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(raw);
  } catch (_) {
    data = { rawText: raw };
  }

  if (!response.ok) {
    const detail =
      data.details && typeof data.details === 'object'
        ? Object.values(data.details as Record<string, unknown>)
            .flat()
            .filter((value) => typeof value === 'string')
            .join(' ')
        : typeof data.details === 'string'
        ? data.details
        : '';
    const providerError = typeof data.error === 'string' ? data.error : (data.error as { message?: string })?.message;
    throw new Error(
      detail ||
        (data.message as string) ||
        providerError ||
        (data.errorDescription as string) ||
        `Falha na Omega Pay (${response.status}): ${raw}`
    );
  }
  return data as unknown as T;
}

export async function createOmegaPix(input: {
  identifier: string;
  amount: number;
  client: { name: string; email: string; phone?: string; document?: string };
  callbackUrl?: string;
}) {
  const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const endpoint = `${API_URL}/api/v1/gateway/pix/receive`;

  const payload = {
    identifier: input.identifier,
    amount: input.amount,
    client: {
      name: input.client.name || 'Piloto Arena Clash',
      email: input.client.email || 'jogador@arenaclash.com.br',
      phone: String(input.client.phone || '11999999999').replace(/\D/g, ''),
      document: String(input.client.document || '52968522817').replace(/\D/g, ''),
    },
    dueDate,
    products: [
      {
        id: 'arenaclash-credit',
        name: 'Créditos Arena Clash',
        quantity: 1,
        price: input.amount,
      },
    ],
    metadata: { platform: 'arena-clash', identifier: input.identifier },
    ...(input.callbackUrl ? { callbackUrl: input.callbackUrl } : {}),
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });

  return parseResponse<OmegaPixResponse>(response);
}

export async function createOmegaTransfer(input: OmegaTransferInput) {
  const endpoint = `${API_URL}/api/v1/gateway/transfers`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      identifier: input.identifier,
      amount: input.amount,
      pix: {
        key: input.pix.key,
        type: input.pix.type.toLowerCase(),
      },
      owner: {
        name: input.owner.name,
        document: {
          number: input.owner.document.number.replace(/\D/g, ''),
          type: input.owner.document.type.toLowerCase(),
        },
        ip: input.owner.ip || '177.18.200.5',
      },
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  return parseResponse<{ transactionId?: string; id?: string; status: string; message?: string }>(response);
}

export async function getOmegaTransaction(id: string, identifier: string) {
  const params = new URLSearchParams({ id, clientIdentifier: identifier });
  const endpoint = `${API_URL}/api/v1/gateway/transactions?${params}`;
  const response = await fetch(endpoint, {
    headers: buildAuthHeaders(),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  return parseResponse<VizzionTransaction>(response);
}
