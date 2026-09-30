import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser, hashPassword } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser(req);
    if (!admin) {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
    }

    const body = await req.json();
    const { action, targetId, value, amount, reason } = body;

    if (!targetId && action !== 'save-settings') {
      return NextResponse.json({ error: 'Identificador do usuário alvo é obrigatório.' }, { status: 400 });
    }

    const db = getAdminDb();
    const nowIso = new Date().toISOString();

    switch (action) {
      case 'adjust_balance': {
        const delta = Number(amount);
        if (isNaN(delta) || delta === 0) {
          return NextResponse.json({ error: 'Valor de ajuste inválido.' }, { status: 400 });
        }

        const userRef = db.collection('arena_users').doc(targetId);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
          return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
        }

        const currentBalance = Number(userDoc.data()?.saldo || 0);
        const newBalance = Math.max(0, currentBalance + delta);

        await userRef.update({
          saldo: newBalance,
          updated_at: nowIso,
        });

        // Record in transactions collection
        await db.collection('transactions').add({
          user_id: targetId,
          tipo: delta > 0 ? 'ajuste_credito_admin' : 'ajuste_debito_admin',
          valor: Math.abs(delta),
          saldo_anterior: currentBalance,
          saldo_novo: newBalance,
          motivo: reason || 'Ajuste administrativo',
          admin_id: admin.id,
          admin_nome: admin.nome,
          created_at: nowIso,
        });

        // Audit log
        await db.collection('arena_audit_logs').add({
          action: 'BALANCE_ADJUSTMENT',
          actor: admin.email || admin.nome,
          target: targetId,
          detail: `Ajuste de R$ ${delta.toFixed(2)} (${reason || 'Sem motivo informado'}). Saldo: R$ ${currentBalance.toFixed(2)} -> R$ ${newBalance.toFixed(2)}`,
          created_at: nowIso,
        });

        return NextResponse.json({
          success: true,
          message: `Saldo atualizado com sucesso para R$ ${newBalance.toFixed(2)}.`,
          newBalance,
        });
      }

      case 'set_user_role': {
        const newRole = value === 'admin' || value === true;
        await db.collection('arena_users').doc(targetId).update({
          is_admin: newRole,
          updated_at: nowIso,
        });

        await db.collection('arena_audit_logs').add({
          action: 'USER_ROLE',
          actor: admin.email || admin.nome,
          target: targetId,
          detail: newRole ? 'Privilégio de administrador concedido' : 'Privilégio de administrador revogado',
          created_at: nowIso,
        });

        return NextResponse.json({ success: true, is_admin: newRole });
      }

      case 'set_user_status': {
        const newStatus = value === 'suspended' ? 'suspended' : 'active';
        await db.collection('arena_users').doc(targetId).update({
          status: newStatus,
          updated_at: nowIso,
        });

        await db.collection('arena_audit_logs').add({
          action: 'USER_STATUS',
          actor: admin.email || admin.nome,
          target: targetId,
          detail: newStatus === 'suspended' ? 'Conta suspensa pelo administrador' : 'Conta reativada',
          created_at: nowIso,
        });

        return NextResponse.json({ success: true, status: newStatus });
      }

      case 'set_influencer': {
        const { enabled, refCode, rate1, rate2 } = value || {};
        const updateData: Record<string, any> = {
          is_influencer: Boolean(enabled),
          updated_at: nowIso,
        };
        if (refCode) updateData.codigo_convite = refCode.trim().toUpperCase();
        if (rate1 !== undefined) updateData.influencer_rate1 = Number(rate1);
        if (rate2 !== undefined) updateData.influencer_rate2 = Number(rate2);

        await db.collection('arena_users').doc(targetId).update(updateData);

        await db.collection('arena_audit_logs').add({
          action: 'INFLUENCER_UPDATE',
          actor: admin.email || admin.nome,
          target: targetId,
          detail: `Modo influencer ${enabled ? 'ativado' : 'desativado'}. Código: ${refCode || 'N/A'}. Taxas: ${rate1}% / ${rate2}%`,
          created_at: nowIso,
        });

        return NextResponse.json({ success: true, updateData });
      }

      case 'reset_password': {
        const newPassword = String(value || '').trim();
        if (!newPassword || newPassword.length < 6) {
          return NextResponse.json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' }, { status: 400 });
        }

        const hashedPassword = await hashPassword(newPassword);
        await db.collection('arena_users').doc(targetId).update({
          senha: hashedPassword,
          password_hash: hashedPassword,
          updated_at: nowIso,
        });

        await db.collection('arena_audit_logs').add({
          action: 'PASSWORD_RESET',
          actor: admin.email || admin.nome,
          target: targetId,
          detail: 'Senha redefinida diretamente pelo administrador',
          created_at: nowIso,
        });

        return NextResponse.json({ success: true, message: 'Senha alterada com sucesso.' });
      }

      default:
        return NextResponse.json({ error: `Ação desconhecida: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[Admin Actions API Error]:', error);
    return NextResponse.json({ error: error.message || 'Erro ao executar ação.' }, { status: 500 });
  }
}
