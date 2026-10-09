import { getAdminClient } from './supabase.js';

export async function notify(userId, { category, title, body, meta = {} }) {
  if (!userId || !category) return;
  const sb = getAdminClient();
  try {
    await sb.from('notifications').insert({
      user_id: userId,
      category,
      title: title || null,
      body: body || null,
      meta
    });
  } catch (err) {
    console.error('notify failed:', err);
  }
}

export async function notifyMany(userIds, payload) {
  if (!Array.isArray(userIds) || userIds.length === 0) return;
  const sb = getAdminClient();
  try {
    await sb.from('notifications').insert(
      userIds.map(userId => ({
        user_id: userId,
        category: payload.category,
        title: payload.title || null,
        body: payload.body || null,
        meta: payload.meta || {}
      }))
    );
  } catch (err) {
    console.error('notifyMany failed:', err);
  }
}
