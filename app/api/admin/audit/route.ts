import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser(req);
    if (!admin) {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
    }

    const db = getAdminDb();
    const snap = await db.collection('arena_audit_logs').orderBy('created_at', 'desc').limit(100).get();

    const logs = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return NextResponse.json({
      success: true,
      logs,
    });
  } catch (error: any) {
    console.error('[Admin Audit API Error]:', error);
    return NextResponse.json({ error: error.message || 'Erro interno.' }, { status: 500 });
  }
}
