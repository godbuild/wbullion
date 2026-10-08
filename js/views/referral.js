import { navigate } from '../router.js';
import { getDeviceId } from '../auth.js';
import { showToast } from '../modal.js';
import { money, compact } from '../format.js';

export async function renderReferral() {
  const el = document.getElementById('viewContainer');
  el.innerHTML = `<div style="padding:40px;text-align:center;"><i class="fas fa-spinner fa-spin"></i></div>`;

  const res = await fetch(`/api/users/referral-info?deviceId=${encodeURIComponent(getDeviceId())}`);
  const data = await res.json();

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h2 style="font-size:22px;font-weight:bold;">Referrals</h2>
      <button id="closeRef" class="wb-close"><i class="fas fa-close"></i></button>
    </div>

    <div class="wb-card" style="margin-bottom:16px;">
      <p style="font-size:13px;color:var(--text-secondary);">Your Referral Code</p>
      <p style="font-size:24px;font-weight:bold;color:var(--green);margin-top:4px;">${data.code}</p>
      <div id="refLinkBox" style="margin-top:12px;padding:12px;background:var(--bg-secondary);border-radius:10px;font-weight:600;font-size:13px;color:var(--purple-light);word-break:break-all;cursor:pointer;">
        ${data.link}
      </div>
      <p style="font-size:11px;color:var(--text-secondary);margin-top:6px;">Tap to copy and share</p>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
      <div class="wb-card" style="text-align:center;">
        <p style="font-size:12px;color:var(--text-secondary);">Referred</p>
        <p style="font-size:22px;font-weight:bold;">${compact(data.referredCount)}</p>
      </div>
      <div class="wb-card" style="text-align:center;">
        <p style="font-size:12px;color:var(--text-secondary);">Total Earned</p>
        <p style="font-size:22px;font-weight:bold;color:#10b981;">${money(data.totalEarned)}</p>
      </div>
    </div>

    <div class="wb-card">
      <p style="font-weight:600;margin-bottom:12px;">Referred Users</p>
      ${data.referred.length === 0 ? '<p style="color:var(--text-secondary);">No referrals yet</p>' :
        data.referred.map(r => `
          <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-color);">
            <div>
              <p style="font-weight:600;font-size:14px;">${r.username}</p>
              <p style="font-size:11px;color:var(--text-secondary);">${new Date(r.created_at).toLocaleDateString()}</p>
            </div>
            <span style="font-weight:600;color:${r.activated ? '#10b981' : '#f59e0b'};font-size:12px;">
              ${r.activated ? '✓ Activated' : '⏳ Pending'}
            </span>
          </div>
        `).join('')}
    </div>
  `;

  document.getElementById('closeRef').onclick = () => navigate('/settings');

  document.getElementById('refLinkBox').onclick = async () => {
    try {
      await navigator.clipboard.writeText(data.link);
      showToast('Copied');
      if (navigator.share) {
        try { await navigator.share({ title: 'W Bullion', text: 'Join W Bullion', url: data.link }); } catch {}
      }
    } catch { showToast('Copy failed'); }
  };
}
