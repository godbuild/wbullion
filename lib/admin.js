import { getAdminClient } from './supabase.js';
import { hashPassword, verifyPassword } from './hash.js';

const SESSION_HOURS = 12;

export function getAdminDeviceId(req) {
  return req.headers['x-admin-device'] || req.body?.deviceId || req.query?.deviceId || null;
}

export async function getAdminConfig() {
  const sb = getAdminClient();
  const { data } = await sb.from('admin_settings').select('value').eq('key', 'admin_config').maybeSingle();
  return data?.value || { admin_account_email: null, admin_password_hash: null };
}

export async function setAdminConfig(updates) {
  const sb = getAdminClient();
  const current = await getAdminConfig();
  const merged = { ...current, ...updates };
  await sb.from('admin_settings').upsert({ key: 'admin_config', value: merged });
  return merged;
}

export async function createSession({ deviceId, authMethod, adminUserId }) {
  const sb = getAdminClient();
  // Revoke all other sessions — single-device enforcement
  await sb.from('admin_sessions').update({ revoked: true }).eq('revoked', false);
  const expires = new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString();
  const { data } = await sb.from('admin_sessions').insert({
    device_id: deviceId,
    auth_method: authMethod,
    admin_user_id: adminUserId || null,
    expires_at: expires
  }).select('*').single();
  return data;
}

export async function validateSession(deviceId) {
  if (!deviceId) return null;
  const sb = getAdminClient();
  const { data } = await sb.from('admin_sessions').select('*')
    .eq('device_id', deviceId).eq('revoked', false)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  return data;
}

export async function revokeSession(deviceId) {
  const sb = getAdminClient();
  await sb.from('admin_sessions').update({ revoked: true }).eq('device_id', deviceId);
}

export async function requireAdmin(req, res) {
  const deviceId = getAdminDeviceId(req);
  const session = await validateSession(deviceId);
  if (!session) {
    res.status(401).json({ error: 'Admin session invalid or expired' });
    return null;
  }
  return session;
}

export { hashPassword, verifyPassword };
