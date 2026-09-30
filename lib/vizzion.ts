const API_URL = (process.env.VIZZION_BASE_URL || 'https://app.vizzionpay.com.br').replace(/\/+$/, '');

export type VizzionPixResponse = {
  transactionId: string;
  status: string;
  transactionStatus?: string;
  webhookToken?: string;
  pix?: { code?: string; image?: string; base64?: string };
  order?: { id?: string; url?: string; receiptUrl?: string };
  fee?: number;
  details?: unknown;
};

export type VizzionTransaction = {
  id: string;
  clientIdentifier: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'CHARGED_BACK';
  paymentMethod: string;
};

export type VizzionTransferInput = {
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

export type VizzionTransferResponse = {
  transactionId?: string;
  id?: string;
  status: string;
  message?: string;
  details?: unknown;
};

function buildAuthHeaders() {
  const apiKey = (process.env.VIZZION_PUBLIC_KEY || '').trim();
  const apiSecret = (process.env.VIZZION_SECRET_KEY || '').trim();
  if (!apiKey || !apiSecret) throw new Error('Vizzion Pay não configurada.');

  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'x-public-key': apiKey,
    'x-secret-key': apiSecret,
    'x-client-id': apiKey,
    'client-id': apiKey,
    'x-client-secret': apiSecret,
    'client-secret': apiSecret,
    'Authorization': `Bearer ${apiSecret}`,
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
    throw new Error(
      detail || (data.message as string) || (data.errorDescription as string) || `Falha na Vizzion Pay (${response.status}): ${raw}`
    );
  }
  return data as unknown as T;
}

export async function createVizzionPix(input: {
  identifier: string;
  amount: number;
  client: { name: string; email: string; phone?: string; document?: string };
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
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });

  return parseResponse<VizzionPixResponse>(response);
}

export async function createVizzionTransfer(input: VizzionTransferInput) {
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
  return parseResponse<VizzionTransferResponse>(response);
}

export async function getVizzionTransaction(id: string, identifier: string) {
  const params = new URLSearchParams({ id, clientIdentifier: identifier });
  const endpoint = `${API_URL}/api/v1/gateway/transactions?${params}`;
  const response = await fetch(endpoint, {
    headers: buildAuthHeaders(),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  return parseResponse<VizzionTransaction>(response);
}
