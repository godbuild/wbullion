import { getAdminClient } from './supabase.js';

export async function resolveUser(req) {
  const sb = getAdminClient();
  const deviceId = req.query.deviceId || req.body?.deviceId;
  const identifier = req.query.email || req.query.identifier || req.body?.email || req.body?.identifier;

  if (deviceId) {
    const { data } = await sb.from('users').select('*')
      .contains('devices', [deviceId]).is('deleted_at', null).maybeSingle();
    if (data) return data;
  }
  // Device IDs can change after browser privacy/storage cleanup. If the
  // client still has the signed-in email, use it as a safe recovery path.
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
