import nodemailer from 'nodemailer';
import { getAdminClient } from '../_lib/supabase.js';
import { requireAdmin } from '../_lib/admin.js';

const SENDER = process.env.EMAIL_USER || 'wbullion0@gmail.com';

function getTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
}

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { paymentId } = req.body || {};
  if (!paymentId) return res.status(400).json({ error: 'paymentId required' });

  const sb = getAdminClient();
  const { data: p } = await sb.from('payments').select('*').eq('id', paymentId).maybeSingle();
  if (!p) return res.status(404).json({ error: 'Payment not found' });

  // Fetch receipt HTML from our own endpoint (needs auth header)
  const baseUrl = process.env.PUBLIC_URL || `https://${req.headers.host}`;
  const deviceId = req.headers['x-admin-device'];
  let receiptHtml = '';
  try {
    const r = await fetch(`${baseUrl}/api/admin/receipt?paymentId=${paymentId}`, {
      headers: { 'x-admin-device': deviceId || '' }
    });
    receiptHtml = await r.text();
  } catch (e) {
    return res.status(500).json({ error: 'Failed to fetch receipt: ' + e.message });
  }

  const transport = getTransport();
  const mail = {
    from: SENDER,
    to: p.email,
    subject: 'Payment Submission Info',
    html: `
      <p>Dear ${p.name || 'User'},</p>
      <p>Your activation payment has been confirmed. Please find your receipt attached below.</p>
      <p>— The W Bullion Team</p>
    `,
    attachments: [{
      filename: `wbullion-receipt-${paymentId}.html`,
      content: receiptHtml,
      contentType: 'text/html'
    }]
  };

  try {
    await transport.sendMail(mail);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
