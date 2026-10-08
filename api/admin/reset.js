import { getAdminClient } from '../_lib/supabase.js';
import { requireAdmin } from '../_lib/admin.js';

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const sb = getAdminClient();
  const { data: user } = await sb.from('users').select('*').eq('id', userId).maybeSingle();
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.activated) return res.status(400).json({ error: 'Cannot reset an activated account' });

  await sb.from('users').update({
    email: `reset_${Date.now()}_${user.email}`,
    username: `reset_${Date.now()}_${user.username}`,
    unique_id: `RST_${Date.now()}_${user.unique_id}`,
    deleted_at: new Date().toISOString()
  }).eq('id', userId);

  res.status(200).json({ success: true });
}
