import { getAdminClient } from '../_lib/supabase.js';
import { verifyPassword } from '../_lib/hash.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { identifier, password, deviceId } = req.body || {};
  if (!identifier || !password) return res.status(400).json({ error: 'All fields required' });

  const clean = identifier.trim().toLowerCase();
  const sb = getAdminClient();

  const { data: user } = await sb.from('users')
    .select('*')
    .or(`email.eq.${clean},username.eq.${clean}`)
    .is('deleted_at', null)
    .maybeSingle();

  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.banned) {
    return res.status(403).json({
      error: `Your account has been banned from operation due to ${user.ban_reason || 'violation of terms'}`
    });
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  // Register device
  if (deviceId) {
    const devices = user.devices || [];
    if (!devices.includes(deviceId)) {
      devices.push(deviceId);
      await sb.from('users').update({ devices, updated_at: new Date().toISOString() }).eq('id', user.id);
    }
  }

  const { password_hash, ...safeUser } = user;
  res.status(200).json({ success: true, user: safeUser });
}
