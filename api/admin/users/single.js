import { getAdminClient } from '../../_lib/supabase.js';
import { requireAdmin } from '../../_lib/admin.js';

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;
  const sb = getAdminClient();
  const { id } = req.query;

  if (req.method === 'GET') {
    const { data: user } = await sb.from('users').select('*').eq('id', id).maybeSingle();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { data: txs } = await sb.from('transactions').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(50);
    const { data: payments } = await sb.from('payments').select('*').eq('user_id', id).order('submitted_at', { ascending: false });
    const { data: logs } = await sb.from('action_logs').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(100);

    const { password_hash, ...safe } = user;
    return res.status(200).json({ user: safe, transactions: txs || [], payments: payments || [], logs: logs || [] });
  }

  if (req.method === 'PUT') {
    const updates = req.body || {};
    delete updates.password_hash;
    delete updates.id;
    updates.updated_at = new Date().toISOString();
    const { data, error } = await sb.from('users').update(updates).eq('id', id).select('*').single();
    if (error) return res.status(500).json({ error: error.message });
    const { password_hash, ...safe } = data;
    return res.status(200).json({ success: true, user: safe });
  }

  if (req.method === 'DELETE') {
    // Soft-delete: email + username become reusable
    const { data: user } = await sb.from('users').select('email, username, unique_id').eq('id', id).maybeSingle();
    if (!user) return res.status(404).json({ error: 'User not found' });

    await sb.from('users').update({
      deleted_at: new Date().toISOString(),
      email: `deleted_${Date.now()}_${user.email}`,
      username: `deleted_${Date.now()}_${user.username}`,
      unique_id: `DEL_${Date.now()}_${user.unique_id}`
    }).eq('id', id);

    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
