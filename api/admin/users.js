import { getAdminClient } from '../_lib/supabase.js';
import { requireAdmin } from '../_lib/admin.js';

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;
  const sb = getAdminClient();
  const { q, limit = 100, offset = 0 } = req.query;

  let query = sb.from('users')
    .select('id, email, username, full_name, unique_id, balance, referral_earnings, activated, banned, admin, badge_awarded, created_at, streak_day, devices, last_claim_date')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (q) {
    const needle = `%${q.toLowerCase()}%`;
    query = query.or(`email.ilike.${needle},username.ilike.${needle},full_name.ilike.${needle},unique_id.ilike.${needle}`);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Get referred counts
  const users = data || [];
  const { data: refCounts } = await sb.from('users')
    .select('referred_by')
    .in('referred_by', users.map(u => u.username));

  const referralMap = {};
  for (const r of refCounts || []) {
    referralMap[r.referred_by] = (referralMap[r.referred_by] || 0) + 1;
  }

  res.status(200).json({
    users: users.map(u => ({ ...u, referralCount: referralMap[u.username] || 0 }))
  });
}
