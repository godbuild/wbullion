import { getAdminClient } from '../lib/supabase.js';
import { resolveUser, stripPassword } from '../lib/auth.js';

export default async function handler(req, res) {
  const action = req.query.action || req.body?.action;
  switch (action) {
    case 'list':         return listNotifications(req, res);
    case 'read':         return readNotifications(req, res);
    case 'badges-list':  return listBadges(req, res);
    case 'badges-claim': return claimBadge(req, res);
    default: return res.status(400).json({ error: 'Unknown notifications action' });
  }
}

async function listNotifications(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const sb = getAdminClient();
  const { category } = req.query;
  let q = sb.from('notifications').select('*').eq('user_id', user.id)
    .order('created_at', { ascending: false }).limit(200);
  if (category && category !== 'all') q = q.eq('category', category);
  const { data } = await q;

  const { data: allNotifs } = await sb.from('notifications').select('category, read').eq('user_id', user.id);
  const counts = {};
  for (const n of allNotifs || []) {
    if (!counts[n.category]) counts[n.category] = { total: 0, unread: 0 };
    counts[n.category].total++;
    if (!n.read) counts[n.category].unread++;
  }

  res.status(200).json({ notifications: data || [], counts });
}

async function readNotifications(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { id, category, all } = req.body || {};
  const sb = getAdminClient();
  if (all) await sb.from('notifications').update({ read: true }).eq('user_id', user.id);
  else if (category) await sb.from('notifications').update({ read: true }).eq('user_id', user.id).eq('category', category);
  else if (id) await sb.from('notifications').update({ read: true }).eq('id', id).eq('user_id', user.id);
  res.status(200).json({ success: true });
}

async function listBadges(req, res) {
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const sb = getAdminClient();
  const { data } = await sb.from('badge_nominees').select('*').eq('user_id', user.id);
  const nominees = data || [];

  await sb.rpc('nominate_badge_candidates').catch(() => {});

  res.status(200).json({
    badges: nominees.filter(n => n.status === 'confirmed' || n.status === 'claimed'),
    pending: nominees.filter(n => n.status === 'confirmed' && !user.badge_awarded_at),
    hasBadge: user.badge_awarded
  });
}

async function claimBadge(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const sb = getAdminClient();
  const { data: nominee } = await sb.from('badge_nominees').select('*')
    .eq('user_id', user.id).eq('status', 'confirmed').maybeSingle();
  if (!nominee) return res.status(404).json({ error: 'No badge awaiting claim' });

  const { data: updated } = await sb.from('users').update({
    badge_awarded: true, badge_awarded_at: new Date().toISOString()
  }).eq('id', user.id).select('*').single();
  await sb.from('badge_nominees').update({ status: 'claimed' }).eq('id', nominee.id);
  res.status(200).json({ success: true, user: stripPassword(updated) });
}
