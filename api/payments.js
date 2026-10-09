import { getAdminClient } from '../lib/supabase.js';
import { resolveUser, stripPassword } from '../lib/auth.js';

const WITHDRAWAL_OPEN_DATE = new Date('2026-12-01T00:00:00Z');

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

export default async function handler(req, res) {
  const action = req.query.action || req.body?.action;
  switch (action) {
    case 'submit':     return submitPayment(req, res);
    case 'withdrawal': return withdrawal(req, res);
    default: return res.status(400).json({ error: 'Unknown payments action' });
  }
}

async function submitPayment(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, name, accountNumber, bankName, smsScreenshot, receiptScreenshot } = req.body || {};
  if (!email || !smsScreenshot || !receiptScreenshot) return res.status(400).json({ error: 'Missing required fields' });

  const sb = getAdminClient();
  const { data: user } = await sb.from('users').select('id').eq('email', email.toLowerCase()).maybeSingle();
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { data: existing } = await sb.from('payments').select('id')
    .eq('user_id', user.id).eq('status', 'pending').maybeSingle();
  if (existing) return res.status(400).json({ error: 'Payment already pending review' });

  const { error } = await sb.from('payments').insert({
    user_id: user.id, email: email.toLowerCase(), name,
    account_number: accountNumber, bank_name: bankName,
    sms_screenshot: smsScreenshot, receipt_screenshot: receiptScreenshot,
    status: 'pending'
  });
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ success: true });
}

async function withdrawal(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  if (new Date() < WITHDRAWAL_OPEN_DATE) {
    return res.status(403).json({
      error: 'Withdrawals open December 1, 2026',
      openDate: WITHDRAWAL_OPEN_DATE.toISOString()
    });
  }

  const { amount, accountNumber, bankName, accountName } = req.body || {};
  const amt = Number(amount);
  if (!amt || amt < 1500) return res.status(400).json({ error: 'Minimum withdrawal is NGN 1,500' });
  if (amt > Number(user.balance || 0)) return res.status(400).json({ error: 'Insufficient balance' });
  if (!accountNumber || !bankName || !accountName) return res.status(400).json({ error: 'All bank details required' });

  const sb = getAdminClient();
  const { data: pending } = await sb.from('withdrawal_requests').select('id')
    .eq('user_id', user.id).eq('status', 'pending').maybeSingle();
  if (pending) return res.status(400).json({ error: 'You already have a pending withdrawal' });

  const nb = Number(user.balance || 0) - amt;
  await sb.from('users').update({ balance: nb, updated_at: new Date().toISOString() }).eq('id', user.id);
  await sb.from('transactions').insert({
    user_id: user.id, type: 'debit', amount: amt, description: 'Withdrawal request'
  });

  const { data: req2 } = await sb.from('withdrawal_requests').insert({
    user_id: user.id, amount: amt,
    account_number: accountNumber, bank_name: bankName, account_name: accountName
  }).select('*').single();

  const { data: updatedUser } = await sb.from('users').select('*').eq('id', user.id).single();
  res.status(200).json({ success: true, request: req2, user: stripPassword(updatedUser) });
}
