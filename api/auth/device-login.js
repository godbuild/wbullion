import { getAdminClient } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { deviceId } = req.body || {};
  if (!deviceId) return res.status(400).json({ success: false });

  const sb = getAdminClient();
  const { data: user } = await sb.from('users')
    .select('*')
    .contains('devices', [deviceId])
    .is('deleted_at', null)
    .maybeSingle();

  if (!user) return res.status(200).json({ success: false });

  const { password_hash, ...safeUser } = user;
  res.status(200).json({ success: true, user: safeUser });
}
