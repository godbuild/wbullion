import { getAdminClient } from '../_lib/supabase.js';
import {
  getAdminConfig, setAdminConfig, createSession,
  validateSession, revokeSession, hashPassword, verifyPassword
} from '../_lib/admin.js';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'wbullion0@gmail.com';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'wbullion01';

export default async function handler(req, res) {
  const action = req.query.action;

  if (action === 'session') return checkSession(req, res);
  if (action === 'logout') return logout(req, res);
  if (action === 'set-account' || req.method === 'POST') return doAuth(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function checkSession(req, res) {
  const deviceId = req.headers['x-admin-device'];
  const session = await validateSession(deviceId);
  const config = await getAdminConfig();

  let adminUser = null;
  if (config.admin_account_email) {
    const sb = getAdminClient();
    const { data } = await sb.from('users')
      .select('username, full_name, email')
      .eq('email', config.admin_account_email)
      .maybeSingle();
    adminUser = data;
  }

  res.status(200).json({
    authenticated: !!session,
    hasAdminAccount: !!config.admin_account_email,
    adminUser
  });
}

async function logout(req, res) {
  const deviceId = req.headers['x-admin-device'] || req.body?.deviceId;
  if (deviceId) await revokeSession(deviceId);
  res.status(200).json({ success: true });
}

async function doAuth(req, res) {
  const { password, adminAccountPassword, deviceId, bindAccountEmail } = req.body || {};
  if (!deviceId) return res.status(400).json({ error: 'Device ID required' });

  const config = await getAdminConfig();
  const sb = getAdminClient();

  // Path 1: bind a W Bullion account as admin (first-time setup)
  if (bindAccountEmail) {
    if (config.admin_account_email) {
      return res.status(400).json({ error: 'Admin account already set' });
    }
    const { data: user } = await sb.from('users').select('id, email, username, password_hash')
      .eq('email', bindAccountEmail.toLowerCase()).maybeSingle();
    if (!user) return res.status(404).json({ error: 'W Bullion account not found' });

    // Require the account's own password
    const ok = await verifyPassword(adminAccountPassword || '', user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Incorrect account password' });

    // Mark as admin on users table
    await sb.from('users').update({
      admin: true,
      admin_tag: 'Admin',
      badge_awarded: true
    }).eq('id', user.id);

    await setAdminConfig({ admin_account_email: user.email });
    await createSession({ deviceId, authMethod: 'account', adminUserId: user.id });
    return res.status(200).json({ success: true, authMethod: 'account' });
  }

  // Path 2: password login
  if (!password) return res.status(400).json({ error: 'Password required' });

  let valid = false;
  if (!config.admin_password_hash) {
    // First-time: compare against env default, then hash + store
    valid = password === DEFAULT_ADMIN_PASSWORD;
    if (valid) {
      const hash = await hashPassword(password);
      await setAdminConfig({ admin_password_hash: hash });
    }
  } else {
    valid = await verifyPassword(password, config.admin_password_hash);
  }

  if (!valid) return res.status(401).json({ error: 'Invalid admin password' });

  // If an admin account is bound, require its password on new devices
  if (config.admin_account_email) {
    const { data: user } = await sb.from('users').select('password_hash')
      .eq('email', config.admin_account_email).maybeSingle();
    if (user) {
      const accOk = await verifyPassword(adminAccountPassword || '', user.password_hash);
      if (!accOk) return res.status(401).json({ error: 'Admin account password required' });
    }
  }

  await createSession({ deviceId, authMethod: 'password', adminUserId: null });
  res.status(200).json({ success: true, authMethod: 'password' });
}
