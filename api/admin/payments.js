import { getAdminClient } from '../_lib/supabase.js';
import { requireAdmin } from '../_lib/admin.js';

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;
  const sb = getAdminClient();
  const { status = 'pending' } = req.query;

  let query = sb.from('payments').select('*, users:user_id (username, unique_id, activated)').order('submitted_at', { ascending: false });
  if (status === 'pending') query = query.eq('status', 'pending');
  else if (status === 'confirmed') query = query.eq('status', 'confirmed');
  else if (status === 'rejected') query = query.eq('status', 'rejected');

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ payments: data || [] });
}
