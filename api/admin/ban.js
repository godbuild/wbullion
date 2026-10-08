import { getAdminClient } from '../_lib/supabase.js';
import { requireAdmin } from '../_lib/admin.js';

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userIds, reason, action } = req.body || {};
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'userIds required' });
  }

  const sb = getAdminClient();

  if (action === 'ban') {
    if (!reason || reason.trim().length < 3) {
      return res.status(400).json({ error: 'Ban reason required' });
    }
    const { error } = await sb.from('users').update({
      banned: true,
      ban_reason: reason.trim(),
      updated_at: new Date().toISOString()
    }).in('id', userIds);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, action: 'banned', count: userIds.length });
  }

  if (action === 'unban') {
    const { error } = await sb.from('users').update({
      banned: false,
      ban_reason: null,
      updated_at: new Date().toISOString()
    }).in('id', userIds);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, action: 'unbanned', count: userIds.length });
  }

  res.status(400).json({ error: 'Invalid action' });
}
