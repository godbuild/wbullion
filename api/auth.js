import { getAdminClient } from '../lib/supabase.js';
import { hashPassword, verifyPassword } from '../lib/hash.js';

export default async function handler(req, res) {
  const action = req.query.action || req.body?.action;
  switch (action) {
    case 'register':     return register(req, res);
    case 'login':        return login(req, res);
    case 'device-login': return deviceLogin(req, res);
    default: return res.status(400).json({ error: 'Unknown auth action' });
  }
}

// ---------- register ----------
async function register(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { fullName, username, email, password, referralCode, deviceId } = req.body || {};
  if (!fullName || !username || !email || !password) return res.status(400).json({ error: 'All fields required' });

  const cleanUsername = username.trim().toLowerCase();
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanUsername.startsWith('@')) return res.status(400).json({ error: 'Username must start with @' });
  if (!/^@[a-z0-9_]{2,30}$/.test(cleanUsername)) return res.status(400).json({ error: 'Invalid username format' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return res.status(400).json({ error: 'Invalid email' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const sb = getAdminClient();
  const { data: existingUser } = await sb.from('users').select('id, email, username')
    .or(`email.eq.${cleanEmail},username.eq.${cleanUsername}`).maybeSingle();
  if (existingUser) {
    if (existingUser.email === cleanEmail) return res.status(400).json({ error: 'Email already registered' });
    return res.status(400).json({ error: 'Username already taken' });
  }

  let referrer = null;
  if (referralCode) {
    const cleanRef = referralCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const { data } = await sb.from('users').select('id, username, email, balance, referral_earnings')
      .eq('unique_id', cleanRef).maybeSingle();
    if (!data) return res.status(400).json({ error: 'Invalid referral code' });
    referrer = data;
  }

  const uniqueId = 'WB' + Math.random().toString(36).substring(2, 10).toUpperCase();
  const passwordHash = await hashPassword(password);

  const { data: newUser, error } = await sb.from('users').insert({
    email: cleanEmail, username: cleanUsername, full_name: fullName.trim(),
    password_hash: passwordHash, unique_id: uniqueId,
    referred_by: referrer ? referrer.username : null,
    devices: deviceId ? [deviceId] : [],
    activated: false, balance: 0, referral_earnings: 0
  }).select('id, email, username, full_name, unique_id, activated, balance, referred_by, created_at').single();

  if (error) return res.status(500).json({ error: error.message });

  if (referrer) {
    await sb.from('users').update({
      balance: Number(referrer.balance || 0) + 500,
      referral_earnings: Number(referrer.referral_earnings || 0) + 500,
      updated_at: new Date().toISOString()
    }).eq('id', referrer.id);
    await sb.from('transactions').insert({
      user_id: referrer.id, type: 'credit', amount: 500,
      description: `Referral bonus — ${cleanUsername}`
    });
  }

  res.status(200).json({ success: true, user: newUser });
}

// ---------- login ----------
async function login(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { identifier, password, deviceId } = req.body || {};
  if (!identifier || !password) return res.status(400).json({ error: 'All fields required' });

  const clean = identifier.trim().toLowerCase();
  const sb = getAdminClient();
  const { data: user } = await sb.from('users').select('*')
    .or(`email.eq.${clean},username.eq.${clean}`)
    .is('deleted_at', null).maybeSingle();

  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.banned) return res.status(403).json({
    error: `Your account has been banned from operation due to ${user.ban_reason || 'violation of terms'}`
  });

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  if (deviceId) {
    // A device is only a local session handle, not an account identity. Move
    // it to the account that just completed an explicit password login so a
    // shared device cannot keep resolving to a previously logged-in account.
    const { data: linkedUsers } = await sb.from('users').select('id, devices')
      .contains('devices', [deviceId]).neq('id', user.id).is('deleted_at', null);
    for (const linked of linkedUsers || []) {
      const devices = (linked.devices || []).filter(id => id !== deviceId);
      await sb.from('users').update({ devices, updated_at: new Date().toISOString() }).eq('id', linked.id);
    }

    const devices = user.devices || [];
    if (!devices.includes(deviceId)) devices.push(deviceId);
    await sb.from('users').update({ devices, updated_at: new Date().toISOString() }).eq('id', user.id);
  }

  const { password_hash, ...safeUser } = user;
  res.status(200).json({ success: true, user: safeUser });
}

// ---------- device-login ----------
async function deviceLogin(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { deviceId } = req.body || {};
  if (!deviceId) return res.status(400).json({ success: false });

  const sb = getAdminClient();
  const { data: user } = await sb.from('users').select('*')
    .contains('devices', [deviceId]).is('deleted_at', null).maybeSingle();
  if (!user) return res.status(200).json({ success: false });

  const { password_hash, ...safeUser } = user;
  res.status(200).json({ success: true, user: safeUser });
}
