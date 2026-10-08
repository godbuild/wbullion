import { navigate } from '../router.js';
import { showToast } from '../modal.js';

const PERMS = [
  { key: 'location', label: 'Location', desc: 'For weather & regional content' },
  { key: 'storage', label: 'Device Storage', desc: 'For uploading reels & screenshots' },
  { key: 'notifications', label: 'Notifications', desc: 'For activation & earning alerts' },
  { key: 'background', label: 'Run in background', desc: 'For W Waiter clipboard (mobile only)' }
];

export function renderPermissions() {
  const el = document.getElementById('viewContainer');
  const stored = JSON.parse(localStorage.getItem('wb_perms') || '{}');

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h2 style="font-size:22px;font-weight:bold;">Permissions</h2>
      <button id="closePerm" class="wb-close"><i class="fas fa-close"></i></button>
    </div>

    ${PERMS.map(p => `
      <div class="wb-card" style="display:flex;justify-content:space-between;align-items:center;padding:16px;margin-bottom:10px;">
        <div style="flex:1;">
          <p style="font-weight:600;">${p.label}</p>
          <p style="font-size:12px;color:var(--text-secondary);margin-top:2px;">${p.desc}</p>
        </div>
        <label class="switch">
          <input type="checkbox" class="permToggle" data-key="${p.key}" ${stored[p.key] ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>
    `).join('')}

    <p style="font-size:12px;color:var(--text-secondary);text-align:center;margin-top:20px;line-height:1.6;">
      Some permissions require browser-level approval.<br>
      We'll prompt you the first time each is needed.
    </p>
  `;

  document.getElementById('closePerm').onclick = () => navigate('/settings');

  document.querySelectorAll('.permToggle').forEach(t => {
    t.onchange = async (e) => {
      const key = e.target.dataset.key;
      const on = e.target.checked;

      // Request actual browser permission where applicable
      if (on) {
        try {
          if (key === 'notifications' && 'Notification' in window) {
            await Notification.requestPermission();
          }
          if (key === 'location' && navigator.geolocation) {
            await new Promise((resolve) => navigator.geolocation.getCurrentPosition(resolve, resolve));
          }
        } catch {}
      }

      const stored = JSON.parse(localStorage.getItem('wb_perms') || '{}');
      stored[key] = on;
      localStorage.setItem('wb_perms', JSON.stringify(stored));
      showToast(`${key}: ${on ? 'granted' : 'revoked'}`);
    };
  });
}
