import { getAdminClient } from '../_lib/supabase.js';
import { requireAdmin } from '../_lib/admin.js';

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;
  const sb = getAdminClient();

  if (req.method === 'GET') {
    const { data } = await sb.from('broadcasts').select('*').order('created_at', { ascending: false }).limit(50);
    return res.status(200).json({ broadcasts: data || [] });
  }

  if (req.method === 'POST') {
    const { kind, title, body_html, cover_image, background_image, inline_image, image_x, image_y, image_scale, publish, sendAsNotification } = req.body || {};
    if (!kind) return res.status(400).json({ error: 'kind required' });

    const { data: broadcast, error } = await sb.from('broadcasts').insert({
      kind,
      title: title || null,
      body_html: body_html || '',
      cover_image: cover_image || null,
      background_image: background_image || null,
      inline_image: inline_image || null,
      image_x: image_x ?? 50,
      image_y: image_y ?? 50,
      image_scale: image_scale ?? 1,
      published: !!publish,
      published_at: publish ? new Date().toISOString() : null
    }).select('*').single();

    if (error) return res.status(500).json({ error: error.message });

    // Optionally send as a general notification to all users
    if (publish && sendAsNotification) {
      const { data: users } = await sb.from('users').select('id').is('deleted_at', null);
      const notifs = (users || []).map(u => ({
        user_id: u.id,
        category: 'general',
        title: title || 'W Bullion',
        body: body_html ? body_html.replace(/<[^>]+>/g, '').slice(0, 200) : ''
      }));
      if (notifs.length > 0) await sb.from('notifications').insert(notifs);
    }

    return res.status(200).json({ success: true, broadcast });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });
    await sb.from('broadcasts').delete().eq('id', id);
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
