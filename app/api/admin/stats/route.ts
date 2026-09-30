import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser(req);
    if (!admin) {
      return NextResponse.json({ error: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const db = getAdminDb();

    // Query collections in parallel with limits for speed
    const [usersSnap, depositsSnap, withdrawalsSnap, gamesSnap, settingsDoc] = await Promise.all([
      db.collection('arena_users').get(),
      db.collection('arena_deposits').limit(300).get(),
      db.collection('arena_withdrawals').limit(300).get(),
      db.collection('games').limit(300).get(),
      db.collection('platform_settings').doc('global').get(),
    ]);

    const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const totalUsers = users.length;
    const activeUsers = users.filter((u: any) => u.status !== 'suspended').length;
    const totalWalletBalance = users.reduce((sum: number, u: any) => sum + Number(u.saldo || 0), 0);
    const totalBonusBalance = users.reduce((sum: number, u: any) => sum + Number(u.saldo_bonus || 0), 0);
    const totalAffiliateBalance = users.reduce((sum: number, u: any) => sum + Number(u.saldo_afiliado || 0), 0);

    const deposits = depositsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const pendingDeposits = deposits.filter((d: any) => d.status === 'pending' || d.status === 'pendente');
    const approvedDeposits = deposits.filter((d: any) => d.status === 'aprovado' || d.status === 'COMPLETED' || d.status === 'approved');
    const totalDeposited = approvedDeposits.reduce((sum: number, d: any) => sum + Number(d.valor || d.amount || 0), 0);

    const withdrawals = withdrawalsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const pendingWithdrawals = withdrawals.filter((w: any) => w.status === 'pending' || w.status === 'pendente');
    const approvedWithdrawals = withdrawals.filter((w: any) => w.status === 'aprovado' || w.status === 'pago' || w.status === 'approved' || w.status === 'COMPLETED');
    const totalWithdrawn = approvedWithdrawals.reduce((sum: number, w: any) => sum + Number(w.valor || w.amount || 0), 0);

    const games = gamesSnap.docs.map((g) => ({ id: g.id, ...g.data() }));
    const totalGames = games.length;
    const wins = games.filter((g: any) => g.resultado === 'vitoria' || g.result === 'win' || (g.payout && g.payout > 0)).length;
    const losses = totalGames - wins;
    const totalBets = games.reduce((sum: number, g: any) => sum + Number(g.aposta || g.bet || g.amount || 0), 0);
    const totalPayouts = games.reduce((sum: number, g: any) => sum + Number(g.lucro || g.payout || 0), 0);
    const houseProfit = totalBets - totalPayouts;

    const settingsData = settingsDoc.exists ? settingsDoc.data() : {};

    return NextResponse.json({
      success: true,
      metrics: {
        totalUsers,
        activeUsers,
        totalWalletBalance,
        totalBonusBalance,
        totalAffiliateBalance,
        totalGames,
        wins,
        losses,
        totalBets,
        totalPayouts,
        houseProfit,
        pendingDepositsCount: pendingDeposits.length,
        approvedDepositsCount: approvedDeposits.length,
        totalDeposited,
        pendingWithdrawalsCount: pendingWithdrawals.length,
        approvedWithdrawalsCount: approvedWithdrawals.length,
        totalWithdrawn,
      },
      settings: {
        difficulty: settingsData?.difficulty || 'balanced',
        maintenance: settingsData?.maintenance || false,
        vizzionPercent: settingsData?.vizzionPercent || 80,
        omegaPercent: settingsData?.omegaPercent || 20,
        minDeposit: settingsData?.minDeposit || 10,
        minWithdrawal: settingsData?.minWithdrawal || 20,
        minBet: settingsData?.minBet || 1,
        maxBet: settingsData?.maxBet || 100,
      },
      gateways: {
        vizzion: { name: 'Vizzion Pay', status: 'online', ratio: '80%' },
        omega: { name: 'Omega Pay', status: 'online', ratio: '20%' },
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Admin Stats API Error]:', error);
    return NextResponse.json({ error: error.message || 'Erro interno.' }, { status: 500 });
  }
}
