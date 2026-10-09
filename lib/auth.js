import { getAdminClient } from './supabase.js';

export async function resolveUser(req) {
  const sb = getAdminClient();
  const { deviceId, email } = req.query;
  const body = req.body || {};
  const identifier = email || body.email || req.query.email;

  if (deviceId) {
    const { data } = await sb.from('users').select('*')
      .contains('devices', [deviceId]).is('deleted_at', null).maybeSingle();
    if (data) return data;
  }
  if (identifier) {
    const { data } = await sb.from('users').select('*')
      .eq('email', identifier.toLowerCase()).is('deleted_at', null).maybeSingle();
    if (data) return data;
  }
  return null;
}

export function stripPassword(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
}
