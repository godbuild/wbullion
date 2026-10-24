import { getDeviceId, setCurrentUser } from '../auth.js';
import { showToast } from '../modal.js';

export async function renderBadges() {
  const el = document.getElementById('viewContainer');
  const deviceId = getDeviceId();

  const res = await fetch(`/api/notifications?action=badges-list&deviceId=${encodeURIComponent(deviceId)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    el.innerHTML = `<div class="wb-card" style="text-align:center;padding:32px 20px;"><i class="fas fa-award" style="font-size:42px;color:var(--green);"></i><h2 style="margin-top:12px;">Badges unavailable</h2><p style="color:var(--text-secondary);margin:8px 0 18px;">${data.error || 'Please try again.'}</p><button id="closeBadges" class="wb-btn-primary">Back</button></div>`;
    document.getElementById('closeBadges').onclick = () => history.back();
    return;
  }

  const earnedBadges = data.badges || [];
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h2 style="font-size:22px;font-weight:bold;">Badges</h2>
      <button id="closeBadges" class="wb-close"><i class="fas fa-close"></i></button>
    </div>

    <div class="wb-card" style="text-align:center;padding:30px;">
      ${data.hasBadge ? `
        <div class="badge-mark" aria-label="Verified badge"><i class="fas fa-check"></i></div>
        <h3 style="font-size:18px;margin-top:12px;">W Bullion Verified</h3>
        <p style="color:var(--text-secondary);font-size:14px;margin-top:6px;">${data.badge?.admin ? 'Administrator verified badge' : 'You are a verified member.'}</p>
      ` : `
        <i class="fas fa-award" style="font-size:60px;color:var(--text-secondary);"></i>
        <p style="color:var(--text-secondary);margin-top:12px;">No badges awarded yet</p>
      `}
    </div>
    ${earnedBadges.length ? `<div class="wb-card" style="margin-top:16px;"><h3 style="font-size:15px;margin-bottom:10px;">Badge history</h3>${earnedBadges.map((badge) => `<div style="display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-color);"><span style="font-weight:600;">${badge.category || 'W Bullion badge'}</span><span style="color:var(--text-secondary);font-size:12px;">${badge.awarded_at ? new Date(badge.awarded_at).toLocaleDateString() : 'Awarded'}</span></div>`).join('')}</div>` : ''}

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
