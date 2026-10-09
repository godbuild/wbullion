import { navigate } from '../router.js';
import { getCurrentUser, getDeviceId } from '../auth.js';
import { showAlert, showToast } from '../modal.js';

let _checkInterval = null;

export function renderActivation() {
  const user = getCurrentUser();
  const el = document.getElementById('viewContainer');
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h3 style="font-size:20px;font-weight:bold;">Activate Account</h3>
      <button id="actClose" class="wb-close"><i class="fas fa-close"></i></button>
    </div>
    <div class="wb-card" style="background:linear-gradient(179deg,#154c00,#2c0941);color:white;text-align:center;margin-bottom:20px;">
      <p style="font-size:14px;font-weight:bold;">Activation Fee</p>
      <p style="font-size:36px;font-weight:bold;">NGN 500</p>
    </div>
    <div class="wb-card">
      <div style="display:flex;flex-direction:column;gap:12px;">
        <input id="actName" placeholder="Your Full Name" class="wb-input" value="${user?.full_name || ''}">
        <input id="actEmail" placeholder="Your Email" class="wb-input" value="${user?.email || ''}" readonly style="background:#e5e7eb;color:#000;">
        <input id="actAccNum" placeholder="Account Number" class="wb-input" inputmode="numeric">
        <input id="actBank" placeholder="Bank Name" class="wb-input">
      </div>
      <button id="proceedBtn" class="wb-btn-primary" style="margin-top:16px;opacity:0.5;pointer-events:none;">Proceed Payment</button>

      <div id="payDetails" style="display:none;margin-top:16px;background:var(--bg-secondary);padding:16px;border-radius:12px;">
        <p style="margin-bottom:8px;font-weight:bold;">Pay to:</p>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-color);">
          <span><strong>Account:</strong> 8105617311</span>
          <button class="copy-btn" data-copy="8105617311" style="background:none;border:none;color:var(--green);cursor:pointer;font-size:18px;"><i class="fas fa-copy"></i></button>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;">
          <span><strong>Bank:</strong> MOMO PSB</span>
          <button class="copy-btn" data-copy="MOMO PSB" style="background:none;border:none;color:var(--green);cursor:pointer;font-size:18px;"><i class="fas fa-copy"></i></button>
        </div>
        <p style="font-size:13px;color:var(--text-secondary);margin-top:8px;">Set description to: <strong>W Bullion Activation Fees</strong></p>
        <button id="uploadBtn" class="wb-btn-primary" style="margin-top:16px;background:var(--purple);">Upload Payment Screenshots</button>

        <div id="uploadSection" style="display:none;margin-top:16px;">
          <label class="wb-label">SMS Debit Alert Screenshot</label>
          <input type="file" accept="image/*" id="smsShot" class="wb-input">
          <label class="wb-label" style="margin-top:12px;">Payment Receipt Screenshot</label>
          <input type="file" accept="image/*" id="receiptShot" class="wb-input">
          <button id="submitPay" class="wb-btn-primary" style="margin-top:16px;background:var(--purple);">Submit Payment</button>
        </div>
      </div>
    </div>

    <div style="text-align:center;margin-top:20px;color:var(--text-secondary);font-size:13px;">
      <i class="fas fa-sync-alt fa-spin"></i> Checking activation status...
    </div>
  `;

  attachActivationListeners();
  startActivationPolling();
}

function attachActivationListeners() {
  const fields = ['actName', 'actAccNum', 'actBank'].map(id => document.getElementById(id));
  const proceed = document.getElementById('proceedBtn');

  function check() {
    const ok = fields.every(f => f.value.trim());
    proceed.style.opacity = ok ? '1' : '0.5';
    proceed.style.pointerEvents = ok ? 'auto' : 'none';
  }
  fields.forEach(f => f.addEventListener('input', check));

  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy;
      try {
        await navigator.clipboard.writeText(text);
        showToast('Copied');
      } catch {
        showToast('Copy failed');
      }
    });
  });

  proceed.addEventListener('click', () => {
    document.getElementById('payDetails').style.display = 'block';
    proceed.style.display = 'none';
  });

  document.getElementById('uploadBtn').addEventListener('click', () => {
    document.getElementById('uploadSection').style.display = 'block';
  });

  document.getElementById('submitPay').addEventListener('click', handleSubmitPayment);

  document.getElementById('actClose').addEventListener('click', () => {
    stopActivationPolling();
    navigate('/login');
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function handleSubmitPayment() {
  const sms = document.getElementById('smsShot').files[0];
  const receipt = document.getElementById('receiptShot').files[0];
  if (!sms || !receipt) return showAlert('Please upload both screenshots');

  if (sms.size > 2 * 1024 * 1024 || receipt.size > 2 * 1024 * 1024) {
    return showAlert('Each screenshot must be under 2 MB');
  }

  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }

  showToast('Submitting payment...');
  try {
    const payload = {
      email: document.getElementById('actEmail').value,
      name: document.getElementById('actName').value,
      accountNumber: document.getElementById('actAccNum').value,
      bankName: document.getElementById('actBank').value,
      smsScreenshot: await fileToBase64(sms),
      receiptScreenshot: await fileToBase64(receipt)
    };
    const res = await fetch('/api/payments?action=submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Submit failed');
    await showAlert('Payment submitted! Admin will review shortly.', 'Submitted');
    document.getElementById('uploadSection').style.display = 'none';
  } catch (err) {
    showAlert(err.message, 'Error');
  }
}

export function startActivationPolling() {
  stopActivationPolling();
  _checkInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api/users?action=me&deviceId=${encodeURIComponent(getDeviceId())}`);
      if (!res.ok) return;
      const user = await res.json();
      if (user.activated) {
        stopActivationPolling();
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('W Bullion', {
            body: 'Your account has been activated. Your earning journey begins now'
          });
        }
        await showAlert('Your account has been activated. Your earning journey begins now', 'Activated!');
        navigate('/home');
      }
    } catch {}
  }, 3000);
}

export function stopActivationPolling() {
  if (_checkInterval) {
    clearInterval(_checkInterval);
    _checkInterval = null;
  }
}
