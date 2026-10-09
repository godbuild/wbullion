import crypto from 'crypto';
import { getAdminClient } from '../lib/supabase.js';
import { resolveUser } from '../lib/auth.js';

export default async function handler(req, res) {
  const action = req.query.action || req.body?.action;
  switch (action) {
    case 'sign-upload': return signUpload(req, res);
    case 'create':      return createReel(req, res);
    case 'list':        return listReels(req, res);
    case 'single':      return singleReel(req, res);
    case 'like':        return likeReel(req, res);
    case 'view':        return viewReel(req, res);
    default: return res.status(400).json({ error: 'Unknown reels action' });
  }
}

async function signUpload(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (!user.activated) return res.status(403).json({ error: 'Account not activated' });
  if (user.visibility === false) return res.status(403).json({ error: 'Private accounts cannot upload reels' });

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return res.status(500).json({ error: 'Cloudinary not configured' });

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'wbullion/reels';
  const uploadPreset = 'wbullion_signed';
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}&upload_preset=${uploadPreset}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

  res.status(200).json({
    cloudName, apiKey, timestamp, folder, uploadPreset, signature,
    maxBytes: 100 * 1024 * 1024
  });
}

async function createReel(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (!user.activated) return res.status(403).json({ error: 'Account not activated' });
  if (user.visibility === false) return res.status(403).json({ error: 'Private accounts cannot upload reels' });

  const { caption, description, cloudinary } = req.body || {};
  if (!cloudinary?.public_id || !cloudinary?.secure_url) return res.status(400).json({ error: 'Cloudinary result required' });
  if (caption && caption.length > 80) return res.status(400).json({ error: 'Caption max 80 characters' });
  if (description && description.length > 600) return res.status(400).json({ error: 'Description max 600 characters' });
  if (cloudinary.bytes && cloudinary.bytes > 100 * 1024 * 1024) return res.status(400).json({ error: 'Reel exceeds 100 MB limit' });

  const sb = getAdminClient();
  const { data: reel, error } = await sb.from('reels').insert({
    user_id: user.id, username: user.username,
    caption: caption || '', description: description || '',
    cloudinary_public_id: cloudinary.public_id,
    cloudinary_url: cloudinary.url || cloudinary.secure_url,
    cloudinary_secure_url: cloudinary.secure_url,
    duration: cloudinary.duration || null, bytes: cloudinary.bytes || null
  }).select('*').single();
  if (error) return res.status(500).json({ error: error.message });

  const newBalance = Number(user.balance || 0) + 500;
  await sb.from('users').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('id', user.id);
  await sb.from('transactions').insert({
    user_id: user.id, type: 'credit', amount: 500, description: 'Reel creation bonus'
  });
  await sb.from('action_logs').insert({ user_id: user.id, action: 'reel_create', meta: { reel_id: reel.id } });

  res.status(200).json({ success: true, reel, newBalance });
}

async function listReels(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const sb = getAdminClient();
  const search = (req.query.q || '').trim();

  const { data: followRows } = await sb.from('follows').select('following_id').eq('follower_id', user.id);
  const followingIds = (followRows || []).map(r => r.following_id);

  let query = sb.from('reels')
    .select('id, user_id, username, caption, description, cloudinary_secure_url, duration, likes, dislikes, views, created_at')
    .eq('deleted', false).order('created_at', { ascending: false }).limit(100);

  if (search) {
    const needle = `%${search}%`;
    query = query.or(`caption.ilike.${needle},description.ilike.${needle}`);
  }

  const { data: reels, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Filter out reels from private accounts
  const { data: privates } = await sb.from('users').select('id').eq('visibility', false);
  const privateIds = new Set((privates || []).map(p => p.id));
  const filtered = (reels || []).filter(r => !privateIds.has(r.user_id));

  const followed = [];
  const others = [];
  for (const r of filtered) {
    if (followingIds.includes(r.user_id)) followed.push(r);
    else others.push(r);
  }

  res.status(200).json({
    reels: [...followed, ...others],
    followedCount: followed.length,
    totalCount: filtered.length
  });
}

async function singleReel(req, res) {
  const sb = getAdminClient();
  const { id } = req.query;

  if (req.method === 'GET') {
    const { data: reel } = await sb.from('reels').select('*').eq('id', id).eq('deleted', false).maybeSingle();
    if (!reel) return res.status(404).json({ error: 'Reel not found. Might be deleted by the creator.' });
    return res.status(200).json({ reel });
  }

  if (req.method === 'DELETE') {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const { data: reel } = await sb.from('reels').select('user_id').eq('id', id).maybeSingle();
    if (!reel) return res.status(404).json({ error: 'Reel not found' });
    if (reel.user_id !== user.id) return res.status(403).json({ error: 'Not your reel' });
    await sb.from('reels').update({ deleted: true }).eq('id', id);
    return res.status(200).json({ success: true });
  }
  res.status(405).json({ error: 'Method not allowed' });
}

async function likeReel(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { id } = req.query;
  const { action } = req.body || {};
  const sb = getAdminClient();
  const { data: reel } = await sb.from('reels').select('*').eq('id', id).eq('deleted', false).maybeSingle();
  if (!reel) return res.status(404).json({ error: 'Reel not found' });

  const likes = new Set(reel.likes || []);
  const dislikes = new Set(reel.dislikes || []);
  const wasLiked = likes.has(user.id);
  const wasDisliked = dislikes.has(user.id);

  if (action === 'like') {
    if (wasLiked) return res.status(200).json({ success: true, message: 'Already liked' });
    likes.add(user.id);
    dislikes.delete(user.id);

    const { data: creator } = await sb.from('users').select('balance').eq('id', reel.user_id).maybeSingle();
    if (creator) {
      const nb = Number(creator.balance || 0) + 200;
      await sb.from('users').update({ balance: nb, updated_at: new Date().toISOString() }).eq('id', reel.user_id);
      await sb.from('transactions').insert({
        user_id: reel.user_id, type: 'credit', amount: 200, description: 'Reel like reward'
      });
    }
  } else if (action === 'unlike') {
    if (!wasLiked) return res.status(200).json({ success: true, message: 'Not liked' });
    likes.delete(user.id);
  } else if (action === 'dislike') {
    if (wasDisliked) return res.status(200).json({ success: true, message: 'Already disliked' });
    dislikes.add(user.id);
    likes.delete(user.id);
  } else {
    return res.status(400).json({ error: 'Invalid action' });
  }

  const { data: updated } = await sb.from('reels').update({
    likes: [...likes], dislikes: [...dislikes]
  }).eq('id', id).select('likes, dislikes').single();

  res.status(200).json({
    success: true, likes: updated.likes.length, dislikes: updated.dislikes.length,
    message: action === 'like' ? 'Liked' : action === 'unlike' ? 'Unliked' : 'Disliked'
  });
}

async function viewReel(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const sb = getAdminClient();
  const { id } = req.query;
  try { await sb.rpc('increment_reel_view', { reel_id: id }); } catch {}
  res.status(200).json({ success: true });
}
