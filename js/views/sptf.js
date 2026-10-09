import { navigate } from '../router.js';
import { getDeviceId } from '../auth.js';
import { showToast } from '../modal.js';

export async function renderSPTF() {
  const el = document.getElementById('viewContainer');
  el.innerHTML = `<div style="padding:40px;text-align:center;"><i class="fas fa-spinner fa-spin"></i></div>`;

  const res = await fetch(`/api/users?action=sptf&deviceId=${encodeURIComponent(getDeviceId())}`);
  const data = await res.json();
  const users = data.users || [];

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h2 style="font-size:22px;font-weight:bold;">Suggested People To Follow</h2>
      <button id="closeSptf" class="wb-close"><i class="fas fa-close"></i></button>
    </div>
    ${users.length === 0 ? `<p style="text-align:center;color:var(--text-secondary);padding:40px;">${data.message || 'No Suggested People to Follow for now'}</p>` :
      `<div id="sptfList" style="display:flex;flex-direction:column;gap:8px;">
        ${users.map(u => `
          <div class="wb-card" style="display:flex;align-items:center;gap:12px;padding:14px;">
            <div style="width:44px;height:44px;border-radius:50%;background:#dbfedd;color:#1f2937;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:18px;">
              ${(u.username || 'U')[1]?.toUpperCase() || 'U'}
            </div>
            <div style="flex:1;">
              <p style="font-weight:600;font-size:14px;">${u.full_name}${u.badge_awarded ? ' ✓' : ''}</p>
              <p style="font-size:12px;color:var(--text-secondary);">${u.username}</p>
              ${u.referredYou ? '<p style="font-size:11px;color:var(--purple-light);font-weight:600;margin-top:2px;">Referred You</p>' : ''}
            </div>
            <button class="followBtn" data-username="${u.username}" style="padding:8px 16px;background:var(--green);color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:13px;">Follow</button>
          </div>
        `).join('')}
      </div>`
    }
  `;

  document.getElementById('closeSptf').onclick = () => history.back();

  document.querySelectorAll('.followBtn').forEach(btn => btn.onclick = async () => {
    const r = await fetch('/api/users?action=follow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: getDeviceId(), username: btn.dataset.username, action: 'follow' })
    });
    const d = await r.json();
    if (!r.ok) return showToast(d.error);
    showToast(d.message);
    btn.textContent = 'Following';
    btn.style.background = 'var(--bg-secondary)';
    btn.style.color = 'var(--text-primary)';
  });
}
