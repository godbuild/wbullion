import { getAdminClient } from '../../_lib/supabase.js';
import { requireAdmin } from '../../_lib/admin.js';

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sb = getAdminClient();
  const { id } = req.query;
  const { action, rejectionReason } = req.body || {};

  const { data: payment } = await sb.from('payments').select('*').eq('id', id).maybeSingle();
  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  if (action === 'confirm') {
    await sb.from('payments').update({
      status: 'confirmed',
      reviewed_at: new Date().toISOString()
    }).eq('id', id);

    await sb.from('users').update({
      activated: true,
      updated_at: new Date().toISOString()
    }).eq('id', payment.user_id);

    // Notification
    await sb.from('notifications').insert({
      user_id: payment.user_id,
      category: 'activation',
      title: 'Account Activated',
      body: 'Your account has been activated. Your earning journey begins now'
    });

    return res.status(200).json({ success: true, action: 'confirmed' });
  }

  if (action === 'reject') {
    await sb.from('payments').update({
      status: 'rejected',
      rejection_reason: rejectionReason || 'Invalid payment',
      reviewed_at: new Date().toISOString()
    }).eq('id', id);

    await sb.from('notifications').insert({
      user_id: payment.user_id,
      category: 'activation',
      title: 'Payment Rejected',
      body: `Your activation payment was rejected. Reason: ${rejectionReason || 'Invalid payment'}`
    });

    return res.status(200).json({ success: true, action: 'rejected' });
  }

  res.status(400).json({ error: 'Invalid action' });
}
