import { getAdminClient } from '../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const sb = getAdminClient();
  const { data, error } = await sb.from('broadcasts')
    .select('id, kind, title, body_html, cover_image, background_image, inline_image, image_x, image_y, image_scale, published_at')
    .eq('published', true)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  return res.status(200).json({ broadcast: data || null });
}
