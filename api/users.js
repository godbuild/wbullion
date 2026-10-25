import { getAdminClient } from '../lib/supabase.js';
import { resolveUser, stripPassword } from '../lib/auth.js';
import { hashPassword, verifyPassword } from '../lib/hash.js';
import { notify } from '../lib/notify.js';

export default async function handler(req, res) {
  const action = req.query.action || req.body?.action;
  switch (action) {
    case 'me':              return me(req, res);
    case 'update':          return update(req, res);
    case 'update-me':       return updateMe(req, res);
    case 'change-password': return changePassword(req, res);
    case 'profile':         return profile(req, res);
    case 'search':          return search(req, res);
    case 'check-username':  return checkUsername(req, res);
    case 'check-email':     return checkEmail(req, res);
    case 'balance':         return balance(req, res);
    case 'transactions':    return transactions(req, res);
    case 'er':              return er(req, res);
    case 'referral-info':   return referralInfo(req, res);
    case 'visibility':      return visibility(req, res);
    case 'hoep':            return hoep(req, res);
    case 'follow':          return follow(req, res);
    case 'follow-info':     return followInfo(req, res);
    case 'logout':          return logout(req, res);
    case 'track-view':      return trackView(req, res);
    case 'delete':          return deleteUser(req, res);
    case 'sptf':            return sptf(req, res);
    default: return res.status(400).json({ error: 'Unknown users action' });
  }
}

async function me(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { deviceId, identifier } = req.query;
  const sb = getAdminClient();
  let query = sb.from('users').select('*').is('deleted_at', null);
  if (deviceId) query = query.contains('devices', [deviceId]);
  else if (identifier) query = query.eq('email', identifier.toLowerCase());
  else return res.status(400).json({ error: 'deviceId or identifier required' });

  let { data: user } = await query.maybeSingle();

  // A browser privacy reset can remove the device id while the signed-in
  // profile is still available locally. Recover by email before declaring the
  // session invalid so profile, search, Hoep and games keep working.
  if (!user && deviceId) {
    const identifier = req.query.email || req.query.identifier;
    if (identifier) {
      const { data: byEmail } = await sb.from('users').select('*')
        .eq('email', identifier.trim().toLowerCase()).is('deleted_at', null).maybeSingle();
      user = byEmail;
    }
  }
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.banned) return res.status(403).json({ error: `Your account has been banned from operation due to ${user.ban_reason || 'violation of terms'}` });
  const { password_hash, ...safe } = user;
  res.status(200).json(safe);
}

async function update(req, res) {
  if (req.method !== 'PUT' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const ALLOWED = ['theme', 'visibility', 'full_name', 'username', 'last_claim_date', 'telegram_bonus_claimed'];
  const updates = {};
  for (const k of ALLOWED) if (k in (req.body || {})) updates[k] = req.body[k];
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' });
  updates.updated_at = new Date().toISOString();
  const sb = getAdminClient();
  const { data, error } = await sb.from('users').update(updates).eq('id', user.id).select('*').single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ success: true, user: stripPassword(data) });
}

async function updateMe(req, res) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { fullName, username, email, bio } = req.body || {};
  const updates = {};
  if (fullName && fullName.trim() !== user.full_name) updates.full_name = fullName.trim();
  if (bio !== undefined && bio !== user.bio) updates.bio = String(bio).slice(0, 200);
  if (username) {
    const clean = username.trim().toLowerCase();
    if (!clean.startsWith('@')) return res.status(400).json({ error: 'Username must start with @' });
    if (!/^@[a-z0-9_]{2,30}$/.test(clean)) return res.status(400).json({ error: 'Invalid username format' });
    if (clean !== user.username) {
      const sb = getAdminClient();
      const { data: exists } = await sb.from('users').select('id').eq('username', clean).maybeSingle();
      if (exists) return res.status(400).json({ error: 'Username already taken' });
      updates.username = clean;
    }
  }
  if (email) {
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return res.status(400).json({ error: 'Invalid email' });
    if (clean !== user.email) {
      const sb = getAdminClient();
      const { data: exists } = await sb.from('users').select('id').eq('email', clean).maybeSingle();
      if (exists) return res.status(400).json({ error: 'Email already registered' });
      updates.email = clean;
    }
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' });
  updates.updated_at = new Date().toISOString();
  const sb = getAdminClient();
  const { data, error } = await sb.from('users').update(updates).eq('id', user.id).select('*').single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ success: true, user: stripPassword(data) });
}

async function changePassword(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { currentPassword, newPassword, confirmPassword } = req.body || {};
  if (!currentPassword || !newPassword || !confirmPassword) return res.status(400).json({ error: 'All fields required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password too short' });
  if (newPassword !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match' });
  const ok = await verifyPassword(currentPassword, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Current password incorrect' });
  const hash = await hashPassword(newPassword);
  const sb = getAdminClient();
  const { data } = await sb.from('users').update({ password_hash: hash, updated_at: new Date().toISOString() }).eq('id', user.id).select('*').single();
  res.status(200).json({ success: true, user: stripPassword(data) });
}

async function profile(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const viewer = await resolveUser(req);
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: 'username required' });
  const clean = username.startsWith('@') ? username.toLowerCase() : '@' + username.toLowerCase();
  const sb = getAdminClient();
  const { data: user } = await sb.from('users')
    .select('id, username, full_name, balance, badge_awarded, hoep_enabled, hoep_percentage, admin, visibility, bio, created_at')
    .eq('username', clean).is('deleted_at', null).maybeSingle();
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.visibility === false && user.id !== viewer?.id) return res.status(403).json({ error: 'Not Available' });
  if (!viewer && user.visibility === false) return res.status(403).json({ error: 'Not Available' });

  const [{ count: followersCount }, { count: followingCount }, { count: referredCount }] = await Promise.all([
    sb.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id),
    sb.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id),
    sb.from('users').select('*', { count: 'exact', head: true }).eq('referred_by', user.username)
  ]);

  let following = false;
  if (viewer && user.id !== viewer.id) {
    const { data: f } = await sb.from('follows').select('id').eq('follower_id', viewer.id).eq('following_id', user.id).maybeSingle();
    following = !!f;
  }

  const isOwner = !!viewer && user.id === viewer.id;
  let hoepInfo = null;
  if (isOwner && user.hoep_enabled) {
    const { data: myTasks } = await sb.from('task_completions').select('user_id')
      .in('task_id', (await sb.from('tasks').select('id').eq('creator_id', user.id)).data?.map(t => t.id) || []);
    const uniqueHelpers = new Set((myTasks || []).map(t => t.user_id));
    const { count: helpedCount } = await sb.from('task_completions').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    hoepInfo = { helpedMeCount: uniqueHelpers.size, iHelpedCount: helpedCount || 0, percentage: user.hoep_percentage };
  }

  const { data: reels } = await sb.from('reels')
    .select('id, caption, cloudinary_secure_url, views, likes, created_at')
    .eq('user_id', user.id).eq('deleted', false).order('created_at', { ascending: false });

  res.status(200).json({
    user: { ...user, isOwner, isAdmin: user.admin, following },
    counts: { followers: followersCount || 0, following: followingCount || 0, referred: referredCount || 0 },
    hoepInfo,
    reels: reels || []
  });
}

async function search(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const viewer = await resolveUser(req);
  if (!viewer) return res.status(401).json({ error: 'Not authenticated' });
  const raw = (req.query.q || '').trim().toLowerCase();
  if (!raw || raw.length < 2) return res.status(200).json({ results: [], message: 'No Matching results' });
  const q = raw.startsWith('@') ? raw : '@' + raw;
  const sb = getAdminClient();
  const { data: users } = await sb.from('users')
    .select('id, username, full_name, badge_awarded, admin, visibility')
    .or(`username.ilike.%${q}%,full_name.ilike.%${raw}%`)
    .is('deleted_at', null).limit(10);
  if (!users || users.length === 0) return res.status(200).json({ results: [], message: 'No Matching results' });
  const visible = [];
  for (const u of users) {
    if (u.visibility === false && u.id !== viewer.id) {
      visible.push({ username: u.username, full_name: 'Not Available', private: true });
      continue;
    }
    const { data: f } = await sb.from('follows').select('id').eq('follower_id', viewer.id).eq('following_id', u.id).maybeSingle();
    visible.push({ id: u.id, username: u.username, full_name: u.full_name, badge_awarded: u.badge_awarded, admin: u.admin, isFollowing: !!f, private: false });
  }
  res.status(200).json({ results: visible });
}

async function checkUsername(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const raw = (req.query.username || '').trim().toLowerCase();
  if (!raw) return res.status(200).json({ available: false, reason: 'empty' });
  const username = raw.startsWith('@') ? raw : '@' + raw;
  const sb = getAdminClient();
  const { data } = await sb.from('users').select('id').eq('username', username).maybeSingle();
  res.status(200).json({ available: !data, username });
}

async function checkEmail(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const email = (req.query.email || '').trim().toLowerCase();
  if (!email) return res.status(200).json({ available: false, reason: 'empty' });
  const sb = getAdminClient();
  const { data } = await sb.from('users').select('id').eq('email', email).maybeSingle();
  res.status(200).json({ available: !data, email });
}

async function balance(req, res) {
  const user = await resolveUser(req);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.status(200).json({ balance: Number(user.balance || 0) });
}

async function transactions(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const type = req.query.type;
  const sb = getAdminClient();
  let q = sb.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200);
  if (type === 'credit' || type === 'debit') q = q.eq('type', type);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ transactions: data || [] });
}

async function er(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const sb = getAdminClient();
  const { data: txs } = await sb.from('transactions').select('*').eq('user_id', user.id).eq('type', 'credit').order('created_at', { ascending: false }).limit(500);
  const list = txs || [];
  const categorize = (t) => {
    const d = (t.description || '').toLowerCase();
    if (d.includes('referral')) return 'referrals';
    if (d.includes('follower') || d.includes('follow')) return 'follows';
    if (d.includes('reel')) return 'reels';
    if (d.includes('game') || d.includes('bet') || d.includes('goal') || d.includes('tic') || d.includes('rps') || d.includes('leveller')) return 'games';
    if (d.includes('task')) return 'tasks';
    if (d.includes('bonus') || d.includes('streak') || d.includes('telegram') || d.includes('daily')) return 'bonus';
    return 'other';
  };
  const grouped = { referrals: [], follows: [], reels: [], games: [], tasks: [], bonus: [], other: [] };
  for (const t of list) grouped[categorize(t)].push(t);
  const summary = Object.fromEntries(Object.entries(grouped).map(([k, arr]) => [k, { items: arr, total: arr.reduce((s, x) => s + Number(x.amount), 0) }]));
  const { label } = req.query;
  if (label && label !== 'all' && summary[label]) return res.status(200).json({ label, data: summary[label] });
  res.status(200).json({ summary, all: list });
}

async function referralInfo(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const sb = getAdminClient();
  const { data: referred } = await sb.from('users').select('username, full_name, balance, created_at, activated').eq('referred_by', user.username).is('deleted_at', null).order('created_at', { ascending: false });
  const { data: referralTxs } = await sb.from('transactions').select('amount, description, created_at').eq('user_id', user.id).eq('type', 'credit').ilike('description', '%referral%');
  const totalEarned = (referralTxs || []).reduce((s, t) => s + Number(t.amount), 0);
  res.status(200).json({ code: user.unique_id, link: `https://${req.headers.host}/ref/${user.unique_id}`, referred: referred || [], referredCount: (referred || []).length, totalEarned, transactions: referralTxs || [] });
}

async function visibility(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { visibility } = req.body || {};
  const sb = getAdminClient();
  const updates = { visibility: !!visibility, updated_at: new Date().toISOString() };
  if (visibility === false) updates.hoep_enabled = false;
  const { data } = await sb.from('users').update(updates).eq('id', user.id).select('*').single();
  res.status(200).json({ success: true, user: stripPassword(data) });
}

async function hoep(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const ALLOWED = [5, 10, 15, 20, 25, 30];
  const { enabled, percentage } = req.body || {};
  const sb = getAdminClient();
  const updates = { updated_at: new Date().toISOString() };
  if (typeof enabled === 'boolean') {
    if (enabled && user.visibility === false) return res.status(400).json({ error: 'Turn visibility on before enabling HOEP' });
    updates.hoep_enabled = enabled;
    updates.hoep_updated_at = new Date().toISOString();
  }
  if (typeof percentage === 'number') {
    if (!ALLOWED.includes(percentage)) return res.status(400).json({ error: 'Invalid percentage' });
    updates.hoep_percentage = percentage;
  }
  const { data } = await sb.from('users').update(updates).eq('id', user.id).select('*').single();
  res.status(200).json({ success: true, user: stripPassword(data) });
}

async function follow(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (user.visibility === false) return res.status(403).json({ error: 'Your account is private' });
  const { username, action = 'follow' } = req.body || {};
  if (!username) return res.status(400).json({ error: 'username required' });
  const clean = username.trim().toLowerCase().startsWith('@') ? username.trim().toLowerCase() : '@' + username.trim().toLowerCase();
  if (clean === user.username) return res.status(400).json({ error: 'You cannot follow yourself' });
  const sb = getAdminClient();
  const { data: target } = await sb.from('users').select('id, username, visibility, balance').eq('username', clean).maybeSingle();
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.visibility === false) return res.status(403).json({ error: 'Not Available' });
  if (action === 'unfollow') {
    await sb.from('follows').delete().eq('follower_id', user.id).eq('following_id', target.id);
    return res.status(200).json({ success: true, message: `You unfollowed ${clean}` });
  }
  const { data: existing } = await sb.from('follows').select('id').eq('follower_id', user.id).eq('following_id', target.id).maybeSingle();
  if (existing) return res.status(200).json({ success: true, message: `You already follow ${clean}`, already: true });
  await sb.from('follows').insert({ follower_id: user.id, following_id: target.id });
  const nb = Number(target.balance || 0) + 1000;
  await sb.from('users').update({ balance: nb, updated_at: new Date().toISOString() }).eq('id', target.id);
  const { error: rewardError } = await sb.from('transactions').insert({ user_id: target.id, type: 'credit', amount: 1000, description: `New follower — ${user.username}` });
  if (rewardError) return res.status(500).json({ error: 'Follow saved, but the reward could not be recorded. Please refresh your balance.' });
  await sb.from('action_logs').insert({ user_id: user.id, action: 'follow', meta: { target: clean, reward: 1000 } });
  res.status(200).json({ success: true, reward: 1000, message: `You are now following ${clean}` });
}

async function followInfo(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const viewer = await resolveUser(req);
  if (!viewer) return res.status(401).json({ error: 'Not authenticated' });
  const { username, type } = req.query;
  if (!username || !type) return res.status(400).json({ error: 'username and type required' });
  const sb = getAdminClient();
  const clean = username.startsWith('@') ? username.toLowerCase() : '@' + username.toLowerCase();
  const { data: target } = await sb.from('users').select('id').eq('username', clean).maybeSingle();
  if (!target) return res.status(404).json({ error: 'User not found' });
  let ids;
  if (type === 'followers') {
    const { data } = await sb.from('follows').select('follower_id').eq('following_id', target.id);
    ids = (data || []).map(x => x.follower_id);
  } else {
    const { data } = await sb.from('follows').select('following_id').eq('follower_id', target.id);
    ids = (data || []).map(x => x.following_id);
  }
  if (ids.length === 0) return res.status(200).json({ users: [] });
  const { data: users } = await sb.from('users').select('id, username, full_name, badge_awarded, admin, visibility').in('id', ids);
  res.status(200).json({ users: users || [] });
}

async function logout(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { deviceId } = req.body || {};
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
  const sb = getAdminClient();
  const { data: user } = await sb.from('users').select('id, devices').contains('devices', [deviceId]).maybeSingle();
  if (user) {
    const devices = (user.devices || []).filter(d => d !== deviceId);
    await sb.from('users').update({ devices, updated_at: new Date().toISOString() }).eq('id', user.id);
  }
  res.status(200).json({ success: true });
}

async function trackView(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const viewer = await resolveUser(req);
  if (!viewer) return res.status(401).json({ error: 'Not authenticated' });
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ error: 'username required' });
  const clean = username.startsWith('@') ? username.toLowerCase() : '@' + username.toLowerCase();
  const sb = getAdminClient();
  const { data: target } = await sb.from('users').select('id').eq('username', clean).maybeSingle();
  if (!target || target.id === viewer.id) return res.status(200).json({ success: true });
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const { data: existing } = await sb.from('profile_views').select('id').eq('viewer_id', viewer.id).eq('viewed_id', target.id).gte('viewed_at', dayStart.toISOString()).maybeSingle();
  if (existing) return res.status(200).json({ success: true });
  await sb.from('profile_views').insert({ viewer_id: viewer.id, viewed_id: target.id });
  await notify(target.id, { category: 'profile_view', title: 'New profile view', body: `${viewer.username} viewed your profile` });
  res.status(200).json({ success: true });
}

async function deleteUser(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const sb = getAdminClient();
  const suffix = `deleted_${Date.now()}`;
  await sb.from('users').update({
    deleted_at: new Date().toISOString(),
    email: `${suffix}_${user.email}`,
    username: `${suffix}_${user.username}`,
    unique_id: `DEL_${Date.now()}_${user.unique_id}`
  }).eq('id', user.id);
  res.status(200).json({ success: true });
}

async function sptf(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const sb = getAdminClient();
  const { data: followRows } = await sb.from('follows').select('following_id').eq('follower_id', user.id);
  const followingIds = new Set((followRows || []).map(r => r.following_id));
  let referrer = null;
  if (user.referred_by) {
    const { data } = await sb.from('users').select('id, username, full_name, badge_awarded, admin, visibility, hoep_enabled').eq('username', user.referred_by).maybeSingle();
    if (data && !followingIds.has(data.id) && data.visibility !== false) referrer = { ...data, referredYou: true };
  }
  const { data: hoepUsers } = await sb.from('users')
    .select('id, username, full_name, badge_awarded, admin, hoep_updated_at')
    .eq('hoep_enabled', true).eq('visibility', true).neq('id', user.id).is('deleted_at', null)
    .order('hoep_updated_at', { ascending: true }).limit(30);
  const list = [];
  const seen = new Set();
  if (referrer) { list.push(referrer); seen.add(referrer.id); }
  for (const u of hoepUsers || []) {
    if (seen.has(u.id) || followingIds.has(u.id)) continue;
    list.push({ ...u, referredYou: false });
    seen.add(u.id);
    if (list.length >= 20) break;
  }
  res.status(200).json({ users: list, message: list.length === 0 ? 'No Suggested People to Follow for now' : null });
}
