import crypto from 'crypto';
import { Readable } from 'node:stream';
import { getAdminClient } from '../lib/supabase.js';
import { resolveUser } from '../lib/auth.js';

export default async function handler(req, res) {
  const action = req.query.action || req.body?.action;
  switch (action) {
    case 'sign-upload': return signUpload(req, res);
    case 'create':      return createReel(req, res);
    case 'list':        return listReels(req, res);
    case 'single':      return singleReel(req, res);
    case 'download':    return downloadReel(req, res);
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
  // Signed uploads do not need an upload preset. Requiring a hard-coded preset
  // caused uploads to fail when that preset was missing or configured unsigned.
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto.createHash('sha1').update(paramsToSign + apiSecret).digest('hex');

  res.status(200).json({
    cloudName, apiKey, timestamp, folder, signature,
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
  if (user.visibility === false) return res.status(403).json({ error: 'Private accounts cannot browse reels' });

  const sb = getAdminClient();
  const search = String(req.query.q || '').trim().slice(0, 80);
  const safeSearch = search.replace(/[^\p{L}\p{N}\s@_-]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (search && !safeSearch) return res.status(200).json({ reels: [], followedCount: 0, totalCount: 0 });

  const { data: followRows } = await sb.from('follows').select('following_id').eq('follower_id', user.id);
  const followingIds = (followRows || []).map(r => r.following_id);

  let query = sb.from('reels')
    .select('id, user_id, username, caption, description, cloudinary_secure_url, duration, likes, views, created_at')
    .eq('deleted', false).order('created_at', { ascending: false }).limit(100);

  if (safeSearch) {
    const needle = `%${safeSearch}%`;
    const creatorNeedle = `%${safeSearch.replace(/^@/, '')}%`;
    query = query.or(`caption.ilike.${needle},description.ilike.${needle},username.ilike.${creatorNeedle}`);
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
    const viewer = await resolveUser(req);
    const { data: reel } = await sb.from('reels').select('*').eq('id', id).eq('deleted', false).maybeSingle();
    if (!reel) return res.status(404).json({ error: 'Reel not found. Might be deleted by the creator.' });
    if (viewer?.visibility === false && reel.user_id !== viewer.id) return res.status(403).json({ error: 'Private accounts cannot view reels' });
    const { data: owner } = await sb.from('users').select('visibility').eq('id', reel.user_id).maybeSingle();
    if (owner?.visibility === false && reel.user_id !== viewer?.id) return res.status(403).json({ error: 'Not Available' });
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

async function downloadReel(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Reel id required' });
  const sb = getAdminClient();
  const { data: reel, error } = await sb.from('reels')
    .select('id, user_id, cloudinary_secure_url, deleted')
    .eq('id', id).maybeSingle();
  if (error) return res.status(500).json({ error: 'Could not verify reel access' });
  if (!reel || reel.deleted) return res.status(404).json({ error: 'Reel not found' });

  if (reel.user_id !== user.id) {
    if (user.visibility === false) return res.status(403).json({ error: 'Private accounts cannot download reels' });
    const { data: owner } = await sb.from('users').select('visibility').eq('id', reel.user_id).maybeSingle();
    if (owner?.visibility === false) return res.status(403).json({ error: 'This reel is not available' });
  }

  let videoUrl;
  try {
    videoUrl = new URL(reel.cloudinary_secure_url);
  } catch {
    return res.status(502).json({ error: 'Reel video URL is invalid' });
  }
  if (videoUrl.protocol !== 'https:' || videoUrl.hostname !== 'res.cloudinary.com') {
    return res.status(502).json({ error: 'Reel video source is not supported' });
  }

  const safeId = String(reel.id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'video';
  res.setHeader('Content-Disposition', `attachment; filename="reel-${safeId}.mp4"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'HEAD') return res.status(200).end();

  try {
    const upstream = await fetch(videoUrl, { redirect: 'error', signal: AbortSignal.timeout(45000) });
    if (!upstream.ok || !upstream.body) return res.status(502).json({ error: 'Could not retrieve reel video' });
    const contentType = upstream.headers.get('content-type') || 'video/mp4';
    res.setHeader('Content-Type', contentType.startsWith('video/') ? contentType : 'video/mp4');
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    res.statusCode = 200;
    const stream = Readable.fromWeb(upstream.body);
    return await new Promise(resolve => {
      stream.once('error', () => {
        if (!res.headersSent) res.status(502).end();
        else res.destroy();
        resolve();
      });
      res.once('finish', resolve);
      res.once('close', resolve);
      stream.pipe(res);
    });
  } catch {
    if (!res.headersSent) return res.status(502).json({ error: 'Could not retrieve reel video' });
    return res.destroy();
  }
}

async function likeReel(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (user.visibility === false) return res.status(403).json({ error: 'Private accounts cannot like reels' });

  const { id } = req.query;
  const { action } = req.body || {};
  const sb = getAdminClient();
  const { data: reel } = await sb.from('reels').select('*').eq('id', id).eq('deleted', false).maybeSingle();
  if (!reel) return res.status(404).json({ error: 'Reel not found' });

  const likes = new Set(reel.likes || []);
  const wasLiked = likes.has(user.id);

  if (action === 'like') {
    if (wasLiked) return res.status(200).json({ success: true, message: 'Already liked' });
    likes.add(user.id);

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
  } else {
    return res.status(400).json({ error: 'Invalid action' });
  }

  const { data: updated } = await sb.from('reels').update({ likes: [...likes] })
    .eq('id', id).select('likes').single();

  res.status(200).json({
    success: true,
    likes: updated.likes.length,
    message: action === 'like' ? 'Liked' : 'Unliked'
  });
}

async function viewReel(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const sb = getAdminClient();
  const { id } = req.query;
  try { await sb.rpc('increment_reel_view', { reel_id: id }); } catch {}
  res.status(200).json({ success: true });
}
