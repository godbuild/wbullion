import nodemailer from 'nodemailer';
import { getAdminClient } from '../lib/supabase.js';
import {
  getAdminDeviceId, getAdminConfig, setAdminConfig, createSession,
  validateSession, revokeSession, requireAdmin, hashPassword, verifyPassword
} from '../lib/admin.js';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'wbullion0@gmail.com';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'wbullion01';

export default async function handler(req, res) {
  const action = req.query.action || req.body?.action;
  switch (action) {
    case 'auth':             return auth(req, res);
    case 'session':          return session(req, res);
    case 'set-password':     return setPassword(req, res);
    case 'logout':           return adminLogout(req, res);
    case 'stats':            return stats(req, res);
    case 'earnings-history': return earningsHistory(req, res);
    case 'users-list':       return usersList(req, res);
    case 'users-single':     return usersSingle(req, res);
    case 'balance-adjust':   return balanceAdjust(req, res);
    case 'ban':              return ban(req, res);
    case 'reset':            return reset(req, res);
    case 'reset-all':        return resetAll(req, res);
    case 'payments-list':    return paymentsList(req, res);
    case 'payments-single':  return paymentsSingle(req, res);
    case 'receipt':          return receipt(req, res);
    case 'send-email':       return sendEmail(req, res);
    case 'broadcast':        return broadcast(req, res);
    case 'notification-readers': return notificationReaders(req, res);
    case 'badges':           return badges(req, res);
    case 'statistics':       return statistics(req, res);
    case 'sessions-list':    return sessionsList(req, res);
    case 'sessions-revoke':  return sessionsRevoke(req, res);
    default: return res.status(400).json({ error: 'Unknown admin action' });
  }
}

// ---------- auth (login / bind / session / logout) ----------
async function auth(req, res) {
  const sub = req.query.sub;
  if (sub === 'session') return session(req, res);
  if (sub === 'logout') return adminLogout(req, res);

  const { password, adminAccountPassword, deviceId, bindAccountEmail } = req.body || {};
  if (!deviceId) return res.status(400).json({ error: 'Device ID required' });

  const config = await getAdminConfig();
  const sb = getAdminClient();

  if (bindAccountEmail) {
    if (config.admin_account_email) return res.status(400).json({ error: 'Admin account already set' });
    const { data: user } = await sb.from('users').select('id, email, username, password_hash')
      .eq('email', bindAccountEmail.toLowerCase()).maybeSingle();
    if (!user) return res.status(404).json({ error: 'W Bullion account not found' });

    const ok = await verifyPassword(adminAccountPassword || '', user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Incorrect account password' });

    await sb.from('users').update({
      admin: true, admin_tag: 'Admin', badge_awarded: true
    }).eq('id', user.id);

    await setAdminConfig({ admin_account_email: user.email });
    await createSession({ deviceId, authMethod: 'account', adminUserId: user.id });
    return res.status(200).json({ success: true, authMethod: 'account' });
  }

  if (!password) return res.status(400).json({ error: 'Password required' });

  let valid = false;
  if (!config.admin_password_hash) {
    valid = password === DEFAULT_ADMIN_PASSWORD;
    if (valid) await setAdminConfig({ admin_password_hash: await hashPassword(password) });
  } else {
    valid = await verifyPassword(password, config.admin_password_hash);
  }
  if (!valid) return res.status(401).json({ error: 'Invalid admin password' });

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

async function sessionsList(req, res) {
  if (!(await requireAdmin(req, res))) return;
  const sb = getAdminClient();
  const { data, error } = await sb.from('admin_sessions')
    .select('id, device_id, auth_method, admin_user_id, expires_at, created_at, revoked')
    .order('created_at', { ascending: false }).limit(200);
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ sessions: data || [] });
}

async function sessionsRevoke(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { deviceId } = req.body || {};
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
  try {
    await revokeSession(deviceId);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function session(req, res) {
  const deviceId = req.headers['x-admin-device'];
  const s = await validateSession(deviceId);
  const config = await getAdminConfig();

  let adminUser = null;
  if (config.admin_account_email) {
    const sb = getAdminClient();
    const { data } = await sb.from('users')
      .select('username, full_name, email').eq('email', config.admin_account_email).maybeSingle();
    adminUser = data;
  }
  res.status(200).json({
    authenticated: !!s,
    hasAdminAccount: !!config.admin_account_email,
    adminUser
  });
}

async function adminLogout(req, res) {
  const deviceId = req.headers['x-admin-device'] || req.body?.deviceId;
  if (deviceId) await revokeSession(deviceId);
  res.status(200).json({ success: true });
}

// ---------- notification read receipts ----------
async function notificationReaders(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const sb = getAdminClient();
  const { data: notifications, error } = await sb.from('notifications')
    .select('id, user_id, title, read, created_at')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return res.status(500).json({ error: error.message });

  const userIds = [...new Set((notifications || []).map(n => n.user_id).filter(Boolean))];
  const { data: users, error: usersError } = userIds.length
    ? await sb.from('users').select('id, username, full_name, email').in('id', userIds)
    : { data: [], error: null };
  if (usersError) return res.status(500).json({ error: usersError.message });
  const usersById = Object.fromEntries((users || []).map(user => [user.id, user]));
  return res.status(200).json({
    notifications: (notifications || []).map(notification => ({
      ...notification,
      user: usersById[notification.user_id] || null
    }))
  });
}

// ---------- admin earnings history ----------
async function earningsHistory(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;
  const sb = getAdminClient();
  const { data: transactions, error } = await sb.from('transactions').select('*').eq('user_id', session.admin_user_id).order('created_at', { ascending: false }).limit(100);
  if (error) return res.status(500).json({ error: error.message });
  const credits = (transactions || []).filter(t => t.type === 'credit').reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const debits = (transactions || []).filter(t => t.type === 'debit').reduce((sum, t) => sum + Number(t.amount || 0), 0);
  return res.status(200).json({ transactions: transactions || [], credits, debits });
}

// ---------- stats ----------
async function stats(req, res) {
  if (!(await requireAdmin(req, res))) return;
  const sb = getAdminClient();
  const [{ count: totalUsers }, { count: activatedUsers }, { count: pendingPayments }, { data: txData }] = await Promise.all([
    sb.from('users').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    sb.from('users').select('*', { count: 'exact', head: true }).eq('activated', true).is('deleted_at', null),
    sb.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('transactions').select('amount, type, description').eq('type', 'debit')
  ]);
  const gameLosses = (txData || [])
    .filter(t => /game|bet|loss/i.test(t.description || ''))
    .reduce((s, t) => s + Number(t.amount), 0);

  const { count: activations } = await sb.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'confirmed');

  const { data: adminUser } = await sb.from('users').select('balance').eq('admin', true).maybeSingle();
  res.status(200).json({
    totalUsers: totalUsers || 0,
    activatedUsers: activatedUsers || 0,
    pendingPayments: pendingPayments || 0,
    adminEarnings: Number(adminUser?.balance || gameLosses),
    confirmedActivations: activations || 0,
    totalActivationRevenue: (activations || 0) * 500
  });
}

// ---------- users list ----------
async function usersList(req, res) {
  if (!(await requireAdmin(req, res))) return;
  const sb = getAdminClient();
  const { q, limit = 100, offset = 0 } = req.query;

  let query = sb.from('users')
    .select('id, email, username, full_name, unique_id, balance, referral_earnings, activated, banned, admin, badge_awarded, created_at, streak_day, devices, last_claim_date')
    .is('deleted_at', null).order('created_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (q) {
    const needle = `%${q.toLowerCase()}%`;
    query = query.or(`email.ilike.${needle},username.ilike.${needle},full_name.ilike.${needle},unique_id.ilike.${needle}`);
  }
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const users = data || [];
  const { data: refCounts } = await sb.from('users').select('referred_by')
    .in('referred_by', users.map(u => u.username));
  const referralMap = {};
  for (const r of refCounts || []) {
    referralMap[r.referred_by] = (referralMap[r.referred_by] || 0) + 1;
  }
  res.status(200).json({ users: users.map(u => ({ ...u, referralCount: referralMap[u.username] || 0 })) });
}

// ---------- users single ----------
async function usersSingle(req, res) {
  if (!(await requireAdmin(req, res))) return;
  const sb = getAdminClient();
  const { id } = req.query;

  if (req.method === 'GET') {
    const { data: user } = await sb.from('users').select('*').eq('id', id).maybeSingle();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { data: txs } = await sb.from('transactions').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(50);
    const { data: payments } = await sb.from('payments').select('*').eq('user_id', id).order('submitted_at', { ascending: false });
    const { data: logs } = await sb.from('action_logs').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(100);
    const { password_hash, ...safe } = user;
    return res.status(200).json({ user: safe, transactions: txs || [], payments: payments || [], logs: logs || [] });
  }
  if (req.method === 'PUT') {
    const updates = req.body || {};
    delete updates.password_hash; delete updates.id;
    updates.updated_at = new Date().toISOString();
    const { data, error } = await sb.from('users').update(updates).eq('id', id).select('*').single();
    if (error) return res.status(500).json({ error: error.message });
    const { password_hash, ...safe } = data;
    return res.status(200).json({ success: true, user: safe });
  }
  if (req.method === 'DELETE') {
    const { data: user } = await sb.from('users').select('email, username, unique_id').eq('id', id).maybeSingle();
    if (!user) return res.status(404).json({ error: 'User not found' });
    await sb.from('users').update({
      deleted_at: new Date().toISOString(),
      email: `deleted_${Date.now()}_${user.email}`,
      username: `deleted_${Date.now()}_${user.username}`,
      unique_id: `DEL_${Date.now()}_${user.unique_id}`
    }).eq('id', id);
    return res.status(200).json({ success: true });
  }
  res.status(405).json({ error: 'Method not allowed' });
}

// ---------- balance adjustment ----------
async function balanceAdjust(req, res) {
  const adminSession = await requireAdmin(req, res);
  if (!adminSession) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, operation, amount, description } = req.body || {};
  const value = Number(amount);
  if (!userId || !['credit', 'debit'].includes(operation) || !Number.isFinite(value) || value <= 0) {
    return res.status(400).json({ error: 'User, operation, and a positive amount are required' });
  }

  const sb = getAdminClient();
  const { data: user, error: userError } = await sb.from('users').select('id, balance, username').eq('id', userId).maybeSingle();
  if (userError || !user) return res.status(404).json({ error: 'User not found' });

  const { data: adminUser } = await sb.from('users').select('id, balance').eq('id', adminSession.admin_user_id).maybeSingle();
  if (!adminUser) return res.status(500).json({ error: 'Admin earnings account is not configured' });
  const currentBalance = Number(user.balance || 0);
  const adminBalance = Number(adminUser.balance || 0);
  if (operation === 'debit' && currentBalance < value) return res.status(400).json({ error: 'Insufficient balance' });
  if (operation === 'credit' && adminBalance < value) return res.status(400).json({ error: 'Insufficient admin earnings' });
  const nextBalance = operation === 'credit' ? currentBalance + value : currentBalance - value;
  const nextAdminBalance = operation === 'credit' ? adminBalance - value : adminBalance + value;
  const { data: updated, error: updateError } = await sb.from('users').update({
    balance: nextBalance,
    updated_at: new Date().toISOString()
  }).eq('id', userId).select('id, balance, username').single();
  if (updateError || !updated) return res.status(500).json({ error: 'Balance update failed' });

  const { error: transactionError } = await sb.from('transactions').insert({
    user_id: userId,
    type: operation,
    amount: value,
    description: description?.trim() || (operation === 'credit' ? 'Admin credit' : 'Admin debit')
  });
  if (transactionError) {
    await sb.from('users').update({ balance: currentBalance, updated_at: new Date().toISOString() }).eq('id', userId);
    return res.status(500).json({ error: 'Transaction could not be recorded' });
  }

  const { error: adminUpdateError } = await sb.from('users').update({ balance: nextAdminBalance, updated_at: new Date().toISOString() }).eq('id', adminUser.id);
  if (adminUpdateError) {
    await sb.from('users').update({ balance: currentBalance, updated_at: new Date().toISOString() }).eq('id', userId);
    await sb.from('transactions').delete().eq('user_id', userId).eq('amount', value).eq('description', description?.trim() || (operation === 'credit' ? 'Admin credit' : 'Admin debit')).limit(1);
    return res.status(500).json({ error: 'Admin earnings could not be updated' });
  }

  const adminOperation = operation === 'credit' ? 'debit' : 'credit';
  await sb.from('transactions').insert({
    user_id: adminUser.id,
    type: adminOperation,
    amount: value,
    description: `${operation === 'credit' ? 'Credit to' : 'Debit from'} ${user.username}: ${description?.trim() || 'Admin balance adjustment'}`
  });
  await sb.from('action_logs').insert({
    user_id: userId,
    action: operation === 'credit' ? 'admin_credit' : 'admin_debit',
    meta: { amount: value, balance: nextBalance, adminBalance: nextAdminBalance }
  });
  return res.status(200).json({ success: true, balance: nextBalance, adminBalance: nextAdminBalance });
}

// ---------- ban ----------
async function ban(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { userIds, reason, action } = req.body || {};
  if (!Array.isArray(userIds) || userIds.length === 0) return res.status(400).json({ error: 'userIds required' });

  const sb = getAdminClient();
  if (action === 'ban') {
    if (!reason || reason.trim().length < 3) return res.status(400).json({ error: 'Ban reason required' });
    const { error } = await sb.from('users').update({
      banned: true, ban_reason: reason.trim(), updated_at: new Date().toISOString()
    }).in('id', userIds);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, action: 'banned', count: userIds.length });
  }
  if (action === 'unban') {
    const { error } = await sb.from('users').update({
      banned: false, ban_reason: null, updated_at: new Date().toISOString()
    }).in('id', userIds);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, action: 'unbanned', count: userIds.length });
  }
  res.status(400).json({ error: 'Invalid action' });
}

// ---------- reset single ----------
async function reset(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const sb = getAdminClient();
  const { data: user } = await sb.from('users').select('*').eq('id', userId).maybeSingle();
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.activated) return res.status(400).json({ error: 'Cannot reset an activated account' });

  await sb.from('users').update({
    email: `reset_${Date.now()}_${user.email}`,
    username: `reset_${Date.now()}_${user.username}`,
    unique_id: `RST_${Date.now()}_${user.unique_id}`,
    deleted_at: new Date().toISOString()
  }).eq('id', userId);
  res.status(200).json({ success: true });
}

// ---------- reset all ----------
async function resetAll(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const sb = getAdminClient();
  const suffix = `wiped_${Date.now()}`;
  // Simple brute force: fetch IDs, then update each
  const { data: users } = await sb.from('users').select('id, email, username, unique_id').is('deleted_at', null);
  if (users) {
    for (const u of users) {
      await sb.from('users').update({
        deleted_at: new Date().toISOString(),
        email: `del_${Date.now()}_${u.email}`,
        username: `del_${Date.now()}_${u.username}`,
        unique_id: `DEL_${Date.now()}_${u.unique_id}`
      }).eq('id', u.id);
    }
  }
  res.status(200).json({ success: true, cleared: users?.length || 0 });
}

// ---------- payments list ----------
async function paymentsList(req, res) {
  if (!(await requireAdmin(req, res))) return;
  const sb = getAdminClient();
  const { status = 'pending' } = req.query;
  let query = sb.from('payments').select('*, users:user_id (username, unique_id, activated)')
    .order('submitted_at', { ascending: false });
  if (status === 'pending') query = query.eq('status', 'pending');
  else if (status === 'confirmed') query = query.eq('status', 'confirmed');
  else if (status === 'rejected') query = query.eq('status', 'rejected');
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ payments: data || [] });
}

// ---------- payments single ----------
async function paymentsSingle(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const sb = getAdminClient();
  const { id } = req.query;
  const { action, rejectionReason } = req.body || {};

  const { data: payment } = await sb.from('payments').select('*').eq('id', id).maybeSingle();
  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  if (action === 'confirm') {
    await sb.from('payments').update({ status: 'confirmed', reviewed_at: new Date().toISOString() }).eq('id', id);
    await sb.from('users').update({ activated: true, updated_at: new Date().toISOString() }).eq('id', payment.user_id);
    await sb.from('notifications').insert({
      user_id: payment.user_id, category: 'activation', title: 'Account Activated',
      body: 'Your account has been activated. Your earning journey begins now'
    });
    return res.status(200).json({ success: true, action: 'confirmed' });
  }

  if (action === 'reject') {
    await sb.from('payments').update({
      status: 'rejected', rejection_reason: rejectionReason || 'Invalid payment',
      reviewed_at: new Date().toISOString()
    }).eq('id', id);
    await sb.from('notifications').insert({
      user_id: payment.user_id, category: 'activation', title: 'Payment Rejected',
      body: `Your activation payment was rejected. Reason: ${rejectionReason || 'Invalid payment'}`
    });
    return res.status(200).json({ success: true, action: 'rejected' });
  }
  res.status(400).json({ error: 'Invalid action' });
}

// ---------- receipt (returns HTML) ----------
async function receipt(req, res) {
  if (!(await requireAdmin(req, res))) return;
  const { paymentId } = req.query;
  if (!paymentId) return res.status(400).json({ error: 'paymentId required' });

  const sb = getAdminClient();
  const { data: p } = await sb.from('payments').select('*, users:user_id (full_name, username, email)')
    .eq('id', paymentId).maybeSingle();
  if (!p) return res.status(404).json({ error: 'Payment not found' });

  const fullName = p.name || p.users?.full_name || 'W Bullion User';
  const account = p.account_number || '—';
  const bank = p.bank_name || '—';
  const date = new Date(p.reviewed_at || p.submitted_at).toLocaleString('en-NG');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>W Bullion Receipt</title>
<style>body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f6fb;padding:24px;color:#1f3723}.card{max-width:560px;margin:auto;background:white;border-radius:16px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,0.06)}.head{display:flex;gap:12px;align-items:center}h1{margin:0} .row{display:flex;justify-content:space-between;padding:8px 0}.total{margin-top:18px}.amount{font-size:20px;font-weight:bold}</style></head>
<body><div class="card"><div class="head"><img src="${process.env.PUBLIC_URL || ''}/images/logo.png" alt="W Bullion" style="width:48px;height:48px;margin-right:12px"><div><h1>W Bullion</h1><p style="margin:0">Activation Receipt</p></div></div>
<div class="row"><span class="label">Full Name</span><span class="value">${fullName}</span></div>
<div class="row"><span class="label">Bank Name</span><span class="value">${bank}</span></div>
<div class="row"><span class="label">Account Number</span><span class="value">${account}</span></div>
<div class="row"><span class="label">Date</span><span class="value">${date}</span></div>
<div class="total"><p style="font-size:12px;opacity:0.9;margin:0;">Amount Paid</p><p class="amount" style="margin:6px 0;">NGN 500</p></div>
<div class="success" style="color:green;font-weight:bold;margin-top:12px">✓ Activation Successful</div>
<p class="foot" style="margin-top:18px;opacity:0.8">— The W Bullion Team</p></div></body></html>`;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
}

// ---------- send email ----------
async function sendEmail(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { paymentId } = req.body || {};
  if (!paymentId) return res.status(400).json({ error: 'paymentId required' });

  const sb = getAdminClient();
  const { data: p } = await sb.from('payments').select('*').eq('id', paymentId).maybeSingle();
  if (!p) return res.status(404).json({ error: 'Payment not found' });

  const baseUrl = process.env.PUBLIC_URL || `https://${req.headers.host}`;
  const deviceId = req.headers['x-admin-device'];
  let receiptHtml = '';
  try {
    const r = await fetch(`${baseUrl}/api/admin?action=receipt&paymentId=${paymentId}`, {
      headers: { 'x-admin-device': deviceId || '' }
    });
    receiptHtml = await r.text();
  } catch (e) {
    return res.status(500).json({ error: 'Failed to fetch receipt: ' + e.message });
  }

  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });

  try {
    await transport.sendMail({
      from: process.env.EMAIL_USER || ADMIN_EMAIL,
      to: p.email,
      subject: 'Payment Submission Info',
      html: `<p>Dear ${p.name || 'User'},</p><p>Your activation payment has been confirmed. Please find your receipt attached below.</p><p>— The W Bullion Team</p>`,
      attachments: [{
        filename: `wbullion-receipt-${paymentId}.html`,
        content: receiptHtml, contentType: 'text/html'
      }]
    });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ---------- broadcast ----------
async function broadcast(req, res) {
  if (!(await requireAdmin(req, res))) return;
  const sb = getAdminClient();

  if (req.method === 'GET') {
    const { data } = await sb.from('broadcasts').select('*').order('created_at', { ascending: false }).limit(50);
    return res.status(200).json({ broadcasts: data || [] });
  }

  if (req.method === 'POST') {
    const { kind, title, body_html, cover_image, background_image, inline_image, image_x, image_y, image_scale, publish, sendAsNotification } = req.body || {};
    if (!kind) return res.status(400).json({ error: 'kind required' });

    const { data: bcast, error } = await sb.from('broadcasts').insert({
      kind, title: title || null, body_html: body_html || '',
      cover_image: cover_image || null, background_image: background_image || null,
      inline_image: inline_image || null,
      image_x: image_x ?? 50, image_y: image_y ?? 50, image_scale: image_scale ?? 1,
      published: !!publish, published_at: publish ? new Date().toISOString() : null
    }).select('*').single();
    if (error) return res.status(500).json({ error: error.message });

    if (publish && sendAsNotification) {
      const { data: users } = await sb.from('users').select('id').is('deleted_at', null);
      const notifs = (users || []).map(u => ({
        user_id: u.id, category: 'general',
        title: title || 'W Bullion',
        body: body_html ? body_html.replace(/<[^>]+>/g, '').slice(0, 200) : ''
      }));
      if (notifs.length > 0) await sb.from('notifications').insert(notifs);
    }
    return res.status(200).json({ success: true, broadcast: bcast });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });
    await sb.from('broadcasts').delete().eq('id', id);
    return res.status(200).json({ success: true });
  }
  res.status(405).json({ error: 'Method not allowed' });
}

// ---------- badges ----------
async function badges(req, res) {
  if (!(await requireAdmin(req, res))) return;
  const sb = getAdminClient();

  if (req.method === 'GET') {
    const { data } = await sb.from('badge_nominees')
      .select('*, users:user_id (username, full_name, email, balance, referral_earnings)')
      .order('created_at', { ascending: false });
    return res.status(200).json({ nominees: data || [] });
  }

  if (req.method === 'POST') {
    const { nomineeId, action } = req.body || {};
    if (!nomineeId || !['confirm', 'ignore'].includes(action)) return res.status(400).json({ error: 'nomineeId and valid action required' });

    const { data: n, error: nomineeError } = await sb.from('badge_nominees').select('*').eq('id', nomineeId).maybeSingle();
    if (nomineeError) return res.status(500).json({ error: nomineeError.message });
    if (!n) return res.status(404).json({ error: 'Nominee not found' });
    if (n.status !== 'pending') return res.status(409).json({ error: 'This nominee has already been reviewed' });

    if (action === 'confirm') {
      const reviewedAt = new Date().toISOString();
      const { error: nomineeUpdateError } = await sb.from('badge_nominees')
        .update({ status: 'confirmed', reviewed_at: reviewedAt }).eq('id', nomineeId).eq('status', 'pending');
      if (nomineeUpdateError) return res.status(500).json({ error: nomineeUpdateError.message });
      const { error: userUpdateError } = await sb.from('users').update({ badge_awarded: true }).eq('id', n.user_id);
      if (userUpdateError) return res.status(500).json({ error: userUpdateError.message });
      await sb.from('notifications').insert({
        user_id: n.user_id, category: 'badge',
        title: 'W Bullion Verified Badge Awarded',
        body: 'You have been awarded the W Bullion Verified Badge.'
      });
      return res.status(200).json({ success: true, action: 'confirmed' });
    }
    if (action === 'ignore') {
      const { error } = await sb.from('badge_nominees').update({ status: 'ignored', reviewed_at: new Date().toISOString() }).eq('id', nomineeId).eq('status', 'pending');
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, action: 'ignored' });
    }
  }
  res.status(405).json({ error: 'Method not allowed' });
}

// ---------- statistics ----------
async function statistics(req, res) {
  if (!(await requireAdmin(req, res))) return;
  const sb = getAdminClient();
  const now = Date.now();
  const buckets = {
    hour: new Date(now - 3600_000).toISOString(),
    day: new Date(now - 86400_000).toISOString(),
    week: new Date(now - 7 * 86400_000).toISOString()
  };
  const { data: logs } = await sb.from('action_logs').select('*')
    .gte('created_at', buckets.week).order('created_at', { ascending: false });
  const all = logs || [];

  const summarize = (cutoff) => {
    const scoped = all.filter(l => l.created_at >= cutoff);
    const byAction = {};
    const byGame = {};
    for (const l of scoped) {
      byAction[l.action] = (byAction[l.action] || 0) + 1;
      if (l.action === 'game_play' && l.meta?.game) byGame[l.meta.game] = (byGame[l.meta.game] || 0) + 1;
    }
    return { total: scoped.length, byAction, byGame };
  };
  const gameLosses = all.filter(l => l.action === 'game_loss')
    .reduce((s, l) => s + Number(l.meta?.amount || 0), 0);

  res.status(200).json({
    hour: summarize(buckets.hour),
    day: summarize(buckets.day),
    week: summarize(buckets.week),
    gameLosses: Math.round(gameLosses)
  });
}

async function setPassword(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, newPassword, secret } = req.body || {};
  if (secret !== 'wbullion-2026') return res.status(403).json({ error: 'Forbidden' });
  if (!email || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'email + newPassword (min 6) required' });
  }

  try {
    const nodeCrypto = await import('node:crypto');
    const salt = nodeCrypto.randomBytes(16);
    const hash = nodeCrypto.pbkdf2Sync(newPassword, salt, 100000, 32, 'sha256');
    const stored = `pbkdf2$100000$${salt.toString('hex')}$${hash.toString('hex')}`;

    const sb = getAdminClient();
    const { data: user } = await sb.from('users').select('id, email')
      .eq('email', email.toLowerCase()).maybeSingle();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { error } = await sb.from('users').update({
      password_hash: stored,
      updated_at: new Date().toISOString()
    }).eq('id', user.id);
    if (error) return res.status(500).json({ error: 'DB: ' + error.message });

    res.status(200).json({ success: true, email: user.email });
  } catch (err) {
    res.status(500).json({ error: 'Server: ' + (err.message || String(err)) });
  }
}

// End of file
