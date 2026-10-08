import { getAdminClient } from '../_lib/supabase.js';
import { requireAdmin } from '../_lib/admin.js';

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;
  const sb = getAdminClient();

  if (req.method === 'GET') {
    const { data } = await sb.from('badge_nominees')
      .select('*, users:user_id (username, full_name, email, balance, referral_earnings)')
      .order('created_at', { ascending: false });
    return res.status(200).json({ nominees: data || [] });
  }

  if (req.method === 'POST') {
    const { nomineeId, action } = req.body || {};
    if (!nomineeId || !['confirm', 'ignore'].includes(action)) {
      return res.status(400).json({ error: 'nomineeId and valid action required' });
    }

    const { data: n } = await sb.from('badge_nominees').select('*').eq('id', nomineeId).maybeSingle();
    if (!n) return res.status(404).json({ error: 'Nominee not found' });

    if (action === 'confirm') {
      await sb.from('badge_nominees').update({ status: 'confirmed', reviewed_at: new Date().toISOString() }).eq('id', nomineeId);
      await sb.from('users').update({ badge_awarded: true }).eq('id', n.user_id);
      await sb.from('notifications').insert({
        user_id: n.user_id,
        category: 'badge',
        title: 'W Bullion Verified Badge Awarded',
        body: 'You have been awarded the W Bullion Verified Badge.'
      });
      return res.status(200).json({ success: true, action: 'confirmed' });
    }

    if (action === 'ignore') {
      await sb.from('badge_nominees').update({ status: 'ignored', reviewed_at: new Date().toISOString() }).eq('id', nomineeId);
      return res.status(200).json({ success: true, action: 'ignored' });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
