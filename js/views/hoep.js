import { navigate } from '../router.js';
import { getCurrentUser, getDeviceId, setCurrentUser } from '../auth.js';
import { apiFetch } from '../lib/api.js';
import { showToast, showAlert } from '../modal.js';

const PERCENTAGES = [5, 10, 15, 20, 25, 30];

export function renderHoep() {
  const user = getCurrentUser();
  const el = document.getElementById('viewContainer');

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h2 style="font-size:22px;font-weight:bold;">Help Others Earn Program</h2>
      <button id="closeHoep" class="wb-close"><i class="fas fa-close"></i></button>
    </div>

    <div class="wb-card" style="margin-bottom:16px;">
      <p style="font-size:14px;line-height:1.6;color:var(--text-secondary);">
        When you enable HOEP, other users can find you in Suggested People To Follow. Followers earn NGN 1000, and you earn a percentage of it.
      </p>
    </div>

    <div class="wb-card" style="display:flex;justify-content:space-between;align-items:center;padding:16px;margin-bottom:12px;">
      <span style="font-weight:600;">Enable Program</span>
      <label class="switch">
        <input type="checkbox" id="hoepToggle" ${user?.hoep_enabled ? 'checked' : ''}>
        <span class="slider"></span>
      </label>
    </div>

    <div id="hoepExtra" style="display:${user?.hoep_enabled ? 'block' : 'none'};">
      <button id="paramsBtn" class="wb-card" style="display:flex;justify-content:space-between;align-items:center;padding:16px;margin-bottom:12px;background:var(--bg-primary);border:1px solid var(--border-color);width:100%;cursor:pointer;text-align:left;">
        <span style="font-weight:600;">Set Parameters</span>
        <i class="fas fa-chevron-down"></i>
      </button>

      <div id="paramsPanel" style="display:none;padding:16px;background:var(--bg-primary);border:1px solid var(--border-color);border-top:none;border-radius:0 0 16px 16px;margin-top:-13px;margin-bottom:12px;">
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">
          Choose your percentage. Followers get the remaining amount; you earn the selected percentage.
        </p>
        <div id="pctRow" style="display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap;">
          ${PERCENTAGES.map(p => `
            <button class="pctBtn" data-pct="${p}" style="flex:1;min-width:44px;padding:10px 6px;border-radius:10px;border:2px solid ${user?.hoep_percentage === p ? 'var(--green)' : 'var(--border-color)'};background:${user?.hoep_percentage === p ? 'var(--green)' : 'transparent'};color:${user?.hoep_percentage === p ? 'white' : 'var(--text-primary)'};font-weight:700;cursor:pointer;font-size:13px;">${p}%</button>
          `).join('')}
        </div>
      </div>

      <button id="createTaskBtn" class="wb-card" style="display:flex;justify-content:space-between;align-items:center;padding:16px;margin-bottom:12px;background:var(--bg-primary);border:1px solid var(--border-color);width:100%;cursor:pointer;text-align:left;">
        <span style="font-weight:600;">Create Tasks</span>
        <i class="fas fa-chevron-right"></i>
      </button>
    </div>
  `;

  document.getElementById('closeHoep').onclick = () => navigate('/settings');

  document.getElementById('hoepToggle').onchange = async (e) => {
    const enabled = e.target.checked;
    const r = await apiFetch('/api/users?action=hoep', {
      method: 'POST',
      body: JSON.stringify({ deviceId: getDeviceId(), enabled })
    });
    const d = await r.json();
    if (!r.ok) {
      e.target.checked = !enabled;
      return showAlert(d.error, 'Error');
    }
    // Keep the server response locally so HOEP remains enabled after navigation.
    setCurrentUser(d.user);
    showToast(enabled ? 'HOEP enabled' : 'HOEP disabled');
    renderHoep();
  };

  document.getElementById('paramsBtn').onclick = () => {
    const p = document.getElementById('paramsPanel');
    p.style.display = p.style.display === 'none' ? 'block' : 'none';
  };

  document.querySelectorAll('.pctBtn').forEach(btn => {
    btn.onclick = async () => {
      const pct = Number(btn.dataset.pct);
      const r = await apiFetch('/api/users?action=hoep', {
        method: 'POST',
        body: JSON.stringify({ deviceId: getDeviceId(), percentage: pct })
      });
      const d = await r.json();
      if (!r.ok) return showToast(d.error);
      setCurrentUser(d.user);
      showToast(`Set to ${pct}%`);
      renderHoep();
    };
  });

  document.getElementById('createTaskBtn')?.addEventListener('click', () => navigate('/home/tasks'));
}
