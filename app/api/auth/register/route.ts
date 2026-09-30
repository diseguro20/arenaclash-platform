import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { generateCsrf, generateToken, hashPassword } from '@/lib/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { notifyKrsHubConversion } from '@/lib/krs-hub';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const nome = String(body.nome || '').trim();
    const telefoneRaw = String(body.telefone || '').replace(/\D/g, '');
    const senha = String(body.senha || '');
    const codigoIndicacao = String(body.codigo_indicacao || '').trim().toUpperCase();

    if (!nome) {
      return NextResponse.json({ error: 'Informe seu nome completo.' }, { status: 400 });
    }
    if (telefoneRaw.length < 10 || telefoneRaw.length > 11) {
      return NextResponse.json({ error: 'Informe um telefone brasileiro válido com DDD.' }, { status: 400 });
    }
    if (senha.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres.' }, { status: 400 });
    }

    const db = getAdminDb();
    const existingSnap = await db.collection('arena_users').where('telefone', '==', telefoneRaw).limit(1).get();
    if (!existingSnap.empty) {
      return NextResponse.json({ error: 'Este número de telefone já está cadastrado.' }, { status: 400 });
    }

    // Check referrer if any
    let indicadoPorUid: string | null = null;
    if (codigoIndicacao) {
      const refSnap = await db.collection('arena_users').where('codigo_convite', '==', codigoIndicacao).limit(1).get();
      if (!refSnap.empty) {
        indicadoPorUid = refSnap.docs[0].id;
      }
    }

    const hashedPassword = await hashPassword(senha);
    const userRef = db.collection('arena_users').doc();
    const uid = userRef.id;
    const codigoConvite = uid.slice(0, 6).toUpperCase();

    const userData = {
      id: uid,
      nome,
      telefone: telefoneRaw,
      email: `${telefoneRaw}@arenaclash.com.br`,
      senha_hash: hashedPassword,
      saldo: 0.00,
      saldo_ouro: 100,
      saldo_rubi: 10,
      saldo_diamante: 5,
      saldo_bonus: 0.00,
      saldo_afiliado: 0.00,
      total_depositado: 0.00,
      total_sacado: 0.00,
      total_corridas: 0,
      total_partidas: 0,
      total_ganhos: 0.00,
      vitorias_1: 0,
      vitorias_2: 0,
      vitorias_3: 0,
      pontos_ranking: 10,
      codigo_convite: codigoConvite,
      indicado_por: indicadoPorUid,
      indicado_por_tag: codigoIndicacao || null,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    };

    await userRef.set(userData);

    // If referred, increment referrer's referral count
    if (indicadoPorUid) {
      await db.collection('arena_users').doc(indicadoPorUid).update({
        total_indicados: FieldValue.increment(1),
        indicados_n1: FieldValue.increment(1),
      }).catch(() => {});
    }

    // Notify KRS Creator Hub of signup
    if (codigoIndicacao) {
      notifyKrsHubConversion({
        affiliateCode: codigoIndicacao,
        eventType: 'signup',
        playerName: nome,
        playerId: uid,
        playerEmail: userData.email,
        transactionId: `signup_${uid}`,
      });
    }

    const token = generateToken({ id: uid, telefone: telefoneRaw });
    const csrf = generateCsrf();

    const responseUser = {
      id: uid,
      nome,
      telefone: telefoneRaw,
      email: userData.email,
      saldo: 0,
      saldo_bonus: 0,
      saldo_afiliado: 0,
      codigo_convite: codigoConvite,
    };

    const res = NextResponse.json({ user: responseUser, csrf }, { status: 201 });
    res.cookies.set('hw_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return res;
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: (error as Error).message || 'Erro ao criar conta.' }, { status: 500 });
  }
}
