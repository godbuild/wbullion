import { getAdminClient } from '../_lib/supabase.js';
import { hashPassword } from '../_lib/hash.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { fullName, username, email, password, referralCode, deviceId } = req.body || {};

  // --- Validation ---
  if (!fullName || !username || !email || !password) {
    return res.status(400).json({ error: 'All fields required' });
  }
  const cleanUsername = username.trim().toLowerCase();
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanUsername.startsWith('@')) {
    return res.status(400).json({ error: 'Username must start with @' });
  }
  if (!/^@[a-z0-9_]{2,30}$/.test(cleanUsername)) {
    return res.status(400).json({ error: 'Username: 2-30 lowercase letters, numbers or underscores' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const sb = getAdminClient();

  // --- Uniqueness checks ---
  const { data: existingUser } = await sb
    .from('users').select('id, email, username')
    .or(`email.eq.${cleanEmail},username.eq.${cleanUsername}`)
    .maybeSingle();

  if (existingUser) {
    if (existingUser.email === cleanEmail) return res.status(400).json({ error: 'Email already registered' });
    return res.status(400).json({ error: 'Username already taken' });
  }

  // --- Referral check ---
  let referrer = null;
  if (referralCode) {
    const cleanRef = referralCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const { data } = await sb.from('users').select('id, username, email, balance, referral_earnings')
      .eq('unique_id', cleanRef).maybeSingle();
    if (!data) return res.status(400).json({ error: 'Invalid referral code' });
    referrer = data;
  }

  // --- Generate unique ID ---
  const uniqueId = 'WB' + Math.random().toString(36).substring(2, 10).toUpperCase();

  // --- Hash password ---
  const passwordHash = await hashPassword(password);

  // --- Insert user ---
  const { data: newUser, error: insertErr } = await sb.from('users').insert({
    email: cleanEmail,
    username: cleanUsername,
    full_name: fullName.trim(),
    password_hash: passwordHash,
    unique_id: uniqueId,
    referred_by: referrer ? referrer.username : null,
    devices: deviceId ? [deviceId] : [],
    activated: false,
    balance: 0,
    referral_earnings: 0
  }).select('id, email, username, full_name, unique_id, activated, balance, referred_by, created_at').single();

  if (insertErr) return res.status(500).json({ error: insertErr.message });

  // --- Credit referrer ---
  if (referrer) {
    await sb.from('users').update({
      balance: Number(referrer.balance || 0) + 500,
      referral_earnings: Number(referrer.referral_earnings || 0) + 500,
      updated_at: new Date().toISOString()
    }).eq('id', referrer.id);

    await sb.from('transactions').insert({
      user_id: referrer.id,
      type: 'credit',
      amount: 500,
      description: `Referral bonus — ${cleanUsername}`
    });
  }

  res.status(200).json({ success: true, user: newUser });
}
