import { navigate } from '../router.js';
import { getCurrentUser, getDeviceId, setCurrentUser } from '../auth.js';
import { showToast, showAlert } from '../modal.js';
import { money } from '../format.js';

const OPEN_DATE = new Date('2026-12-01T00:00:00Z');

export function renderWithdrawal() {
  const user = getCurrentUser();
  const el = document.getElementById('viewContainer');
  const isOpen = new Date() >= OPEN_DATE;

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h2 style="font-size:22px;font-weight:bold;">Withdraw Funds</h2>
      <button id="closeWd" class="wb-close"><i class="fas fa-close"></i></button>
    </div>

    <div class="wb-card" style="background:linear-gradient(135deg,#3ba072,#154c00);color:white;text-align:center;margin-bottom:16px;">
      <p style="font-size:13px;opacity:0.9;">Available Balance</p>
      <p style="font-size:32px;font-weight:bold;">${money(user?.balance || 0)}</p>
    </div>

    ${!isOpen ? `
      <div class="wb-card" style="background:#fef3c7;color:#92400e;margin-bottom:16px;">
        <p style="font-weight:600;"><i class="fas fa-lock"></i> Withdrawals are closed</p>
        <p style="font-size:13px;margin-top:6px;">Opens on December 1, 2026</p>
      </div>
    ` : ''}

    <div class="wb-card">
      <p style="font-weight:600;margin-bottom:12px;">Bank Details</p>
      <input id="wdAccNum" class="wb-input" placeholder="Account Number" inputmode="numeric" style="margin-bottom:10px;" ${!isOpen ? 'disabled' : ''}>
      <input id="wdBank" class="wb-input" placeholder="Bank Name" style="margin-bottom:10px;" ${!isOpen ? 'disabled' : ''}>
      <input id="wdAccName" class="wb-input" placeholder="Account Name" style="margin-bottom:10px;" ${!isOpen ? 'disabled' : ''}>
      <input id="wdAmount" class="wb-input" type="number" placeholder="Amount (min NGN 1,500)" style="margin-bottom:12px;" ${!isOpen ? 'disabled' : ''}>
      <button id="wdSubmit" class="wb-btn-primary" ${!isOpen ? 'disabled style="opacity:0.5;pointer-events:none;"' : ''}>Submit Withdrawal Request</button>
    </div>
  `;

  document.getElementById('closeWd').onclick = () => navigate('/settings');

  document.getElementById('wdSubmit')?.addEventListener('click', async () => {
    const payload = {
      deviceId: getDeviceId(),
      amount: Number(document.getElementById('wdAmount').value),
      accountNumber: document.getElementById('wdAccNum').value.trim(),
      bankName: document.getElementById('wdBank').value.trim(),
      accountName: document.getElementById('wdAccName').value.trim()
    };
    if (!payload.amount || !payload.accountNumber || !payload.bankName || !payload.accountName) {
      return showAlert('Please fill all fields');
    }
    const r = await fetch('/api/payments/withdrawal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const d = await r.json();
    if (!r.ok) return showAlert(d.error, 'Error');
    setCurrentUser(d.user);
    showToast('Withdrawal request submitted');
    navigate('/settings');
  });
}
