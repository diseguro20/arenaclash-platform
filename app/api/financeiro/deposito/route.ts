import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { createPixCharge } from '@/lib/pix-gateway';
import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Faça login para realizar um depósito.' }, { status: 401 });
    }

    const body = await req.json();
    const amount = Number(body.valor || 0);
    const defaultDoc = process.env.VIZZION_PIX_DEFAULT_DOCUMENT || '52968522817';
    const cpf = String(body.cpf || user.cpf || defaultDoc).replace(/\D/g, '');
    const phone = String(user.telefone || process.env.VIZZION_PIX_DEFAULT_PHONE || '11999999999').replace(/\D/g, '');

    if (isNaN(amount) || amount < 20 || amount > 5000) {
      return NextResponse.json({ error: 'O valor mínimo de depósito é de R$ 20,00.' }, { status: 400 });
    }

    const db = getAdminDb();
    const identifier = `sc_${user.id.slice(0, 8)}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const appUrl = (process.env.APP_URL || 'https://arenaclash-platform.vercel.app').replace(/\/$/, '');
    const callbackUrl = `${appUrl}/api/pix/webhook?identifier=${encodeURIComponent(identifier)}`;

    const { provider, result } = await createPixCharge({
      identifier,
      amount,
      client: {
        name: user.nome || 'Piloto Arena Clash',
        email: user.email || `${user.id.slice(0, 8)}@arenaclash.com.br`,
        phone: phone.length >= 10 ? phone : '11999999999',
        document: cpf.length === 11 ? cpf : defaultDoc,
      },
      callbackUrl,
    });

    // Determine bonus tier
    let bonusAmount = 0;
    if (amount >= 100) bonusAmount = 50;
    else if (amount >= 50) bonusAmount = 20;
    else if (amount >= 30) bonusAmount = 10;
    else if (amount >= 20) bonusAmount = 5;

    const qrText = result.pix?.code || '';
    const qrImage = result.pix?.image || (result.pix?.base64 ? `data:image/png;base64,${result.pix.base64}` : `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrText)}`);

    await db.collection('arena_deposits').doc(identifier).set({
      identifier,
      uid: user.id,
      amount,
      bonusAmount,
      provider,
      transactionId: result.transactionId || identifier,
      status: 'pendente',
      qrcode_texto: qrText,
      qrcode_imagem: qrImage,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      txid: identifier,
      qrcode_texto: qrText,
      qrcode_imagem: qrImage,
      valor: amount,
      bonus: bonusAmount,
      gateway: provider,
    });
  } catch (error) {
    console.error('Deposito error:', error);
    return NextResponse.json({ error: (error as Error).message || 'Erro ao gerar PIX.' }, { status: 500 });
  }
}
