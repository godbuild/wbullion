import { getDeviceId, setCurrentUser } from '../auth.js';
import { showToast } from '../modal.js';

export async function renderBadges() {
  const el = document.getElementById('viewContainer');
  const deviceId = getDeviceId();

  const res = await fetch(`/api/notifications?action=badges-list&deviceId=${encodeURIComponent(deviceId)}`);
  const data = await res.json();

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h2 style="font-size:22px;font-weight:bold;">Badges</h2>
      <button id="closeBadges" class="wb-close"><i class="fas fa-close"></i></button>
    </div>

    <div class="wb-card" style="text-align:center;padding:30px;">
      ${data.hasBadge ? `
        <img src="/images/vbadge.png" alt="Verified" style="width:80px;height:80px;" onerror="this.style.display='none'">
        <h3 style="font-size:18px;margin-top:12px;">W Bullion Verified</h3>
        <p style="color:var(--text-secondary);font-size:14px;margin-top:6px;">You are a verified member.</p>
      ` : `
        <i class="fas fa-award" style="font-size:60px;color:var(--text-secondary);"></i>
        <p style="color:var(--text-secondary);margin-top:12px;">No badges awarded yet</p>
      `}
    </div>

    ${data.pending?.length ? `
      <div class="wb-card" style="margin-top:16px;background:linear-gradient(135deg,#e1fedb,var(--bg-primary));">
        <h3 style="font-size:15px;">You have been awarded the W Bullion Verified Badge.</h3>
        <button id="claimBadge" class="wb-btn-primary" style="margin-top:12px;">Claim Badge</button>
      </div>
    ` : ''}
  `;

  document.getElementById('closeBadges').onclick = () => history.back();

  document.getElementById('claimBadge')?.addEventListener('click', async () => {
    const r = await fetch('/api/notifications?action=badges-claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId })
    });
    const d = await r.json();
    if (!r.ok) return showToast(d.error || 'Error');
    setCurrentUser(d.user);
    showToast('Badge claimed!');
    renderBadges();
  });
}
