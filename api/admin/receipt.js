import { getAdminClient } from '../_lib/supabase.js';
import { requireAdmin } from '../_lib/admin.js';

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;
  const { paymentId } = req.query;
  if (!paymentId) return res.status(400).json({ error: 'paymentId required' });

  const sb = getAdminClient();
  const { data: p } = await sb.from('payments').select('*, users:user_id (full_name, username, email)').eq('id', paymentId).maybeSingle();
  if (!p) return res.status(404).json({ error: 'Payment not found' });

  const fullName = p.name || p.users?.full_name || 'W Bullion User';
  const account = p.account_number || '—';
  const bank = p.bank_name || '—';
  const date = new Date(p.reviewed_at || p.submitted_at).toLocaleString('en-NG');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>W Bullion Receipt</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background:#f4f6fb; padding:24px; color:#1f3723; }
  .card { max-width:560px; margin:auto; background:white; border-radius:16px; padding:32px; box-shadow:0 10px 30px rgba(0,0,0,0.08); }
  .head { display:flex; align-items:center; gap:14px; margin-bottom:24px; }
  .head img { width:56px; height:56px; border-radius:50%; }
  .head h1 { font-size:22px; margin:0; }
  .head p { color:#6b8070; font-size:13px; margin:2px 0 0; }
  .row { display:flex; justify-content:space-between; padding:12px 0; border-bottom:1px solid #e5e7eb; font-size:14px; }
  .row:last-child { border-bottom:none; }
  .label { color:#6b8070; }
  .value { font-weight:600; }
  .total { background:linear-gradient(135deg,#3ba072,#154c00); color:white; text-align:center; padding:20px; border-radius:12px; margin:20px 0; }
  .total .amount { font-size:32px; font-weight:bold; }
  .success { background:#e1fedb; color:#154c00; padding:14px; border-radius:12px; text-align:center; font-weight:600; font-size:14px; margin-top:20px; }
  .foot { margin-top:28px; text-align:center; color:#6b8070; font-size:13px; }
</style></head>
<body>
  <div class="card">
    <div class="head">
      <img src="${process.env.PUBLIC_URL || ''}/images/logo.png" alt="W Bullion">
      <div><h1>W Bullion</h1><p>Activation Receipt</p></div>
    </div>
    <div class="row"><span class="label">Full Name</span><span class="value">${fullName}</span></div>
    <div class="row"><span class="label">Bank Name</span><span class="value">${bank}</span></div>
    <div class="row"><span class="label">Account Number</span><span class="value">${account}</span></div>
    <div class="row"><span class="label">Date</span><span class="value">${date}</span></div>
    <div class="total">
      <p style="font-size:12px;opacity:0.9;margin:0;">Amount Paid</p>
      <p class="amount" style="margin:6px 0;">NGN 500</p>
    </div>
    <div class="success">✓ Activation Successful</div>
    <p class="foot">— The W Bullion Team</p>
  </div>
</body></html>`;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
}
