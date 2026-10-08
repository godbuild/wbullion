import { getAdminClient } from '../_lib/supabase.js';
import { requireAdmin } from '../_lib/admin.js';

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;
  const sb = getAdminClient();

  const [{ count: totalUsers }, { count: activatedUsers }, { count: pendingPayments }, { data: txData }] = await Promise.all([
    sb.from('users').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    sb.from('users').select('*', { count: 'exact', head: true }).eq('activated', true).is('deleted_at', null),
    sb.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('transactions').select('amount, type, description').eq('type', 'debit')
  ]);

  const gameLosses = (txData || [])
    .filter(t => /game|bet|loss/i.test(t.description || ''))
    .reduce((s, t) => s + Number(t.amount), 0);

  const activations = await sb.from('payments')
    .select('amount:1', { count: 'exact', head: true })
    .eq('status', 'confirmed');

  res.status(200).json({
    totalUsers: totalUsers || 0,
    activatedUsers: activatedUsers || 0,
    pendingPayments: pendingPayments || 0,
    adminEarnings: Math.round(gameLosses),
    confirmedActivations: activations.count || 0,
    totalActivationRevenue: (activations.count || 0) * 500
  });
}
