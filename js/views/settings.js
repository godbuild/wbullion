import { navigate } from '../router.js';
import { applyTheme } from '../theme.js';
import { getCurrentUser, getDeviceId, setCurrentUser, logout } from '../auth.js';
import { showToast, showConfirm } from '../modal.js';

const THEME_CYCLE = ['light', 'dark', 'system'];
const THEME_ICONS = { light: 'fa-sun', dark: 'fa-moon', system: 'fa-adjust' };

export function renderSettings() {
  const user = getCurrentUser();
  const el = document.getElementById('viewContainer');
  const theme = localStorage.getItem('wb_theme') || 'system';

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h2 style="font-size:24px;font-weight:bold;">More</h2>
      <button id="closeSettings" class="wb-close"><i class="fas fa-close"></i></button>
    </div>

    <div class="wb-card" style="display:flex;justify-content:space-between;align-items:center;padding:16px;margin-bottom:10px;">
      <span style="font-weight:600;">Theme</span>
      <button id="themeBtn" style="background:var(--bg-secondary);border:none;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:16px;">
        <i class="fas ${THEME_ICONS[theme]}"></i>
      </button>
    </div>

    <button class="wb-card" id="visibilityBtn" style="display:flex;justify-content:space-between;align-items:center;padding:16px;margin-bottom:10px;background:var(--bg-primary);border:1px solid var(--border-color);width:100%;cursor:pointer;text-align:left;">
      <span style="font-weight:600;">Visibility</span>
      <i class="fas fa-chevron-down"></i>
    </button>
    <div id="visibilityPanel" style="display:none;padding:0 16px 16px;background:var(--bg-primary);border:1px solid var(--border-color);border-top:none;border-radius:0 0 16px 16px;margin-bottom:10px;">
      <p style="font-size:13px;margin-bottom:8px;">Choose who can view your profile</p>
      <label class="wb-switch" style="display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;">
        <span id="visibilityLabel">${user?.visibility !== false ? 'Public profile' : 'Private profile'}</span>
        <input type="checkbox" id="visToggle" ${user?.visibility !== false ? 'checked' : ''} aria-label="Make profile public" style="position:absolute;opacity:0;pointer-events:none;">
        <span class="wb-switch-track" aria-hidden="true"><span class="wb-switch-thumb"></span></span>
      </label>
    </div>

    <button class="wb-card" id="badgesBtn" style="display:flex;justify-content:space-between;align-items:center;padding:16px;margin-bottom:10px;background:var(--bg-primary);border:1px solid var(--border-color);width:100%;cursor:pointer;text-align:left;">
      <span style="font-weight:600;">Badges &amp; verification</span>
      <i class="fas fa-chevron-right"></i>
    </button>

    <button class="wb-card" id="hoepBtn" style="display:flex;justify-content:space-between;align-items:center;padding:16px;margin-bottom:10px;background:var(--bg-primary);border:1px solid var(--border-color);width:100%;cursor:pointer;text-align:left;">
      <span style="font-weight:600;">Help Others Earn Program</span>
      <i class="fas fa-chevron-right"></i>
    </button>

    <button class="wb-card" id="erBtn" style="display:flex;justify-content:space-between;align-items:center;padding:16px;margin-bottom:10px;background:var(--bg-primary);border:1px solid var(--border-color);width:100%;cursor:pointer;text-align:left;">
      <span style="font-weight:600;">Earning Records</span>
      <i class="fas fa-chevron-right"></i>
    </button>

    <button class="wb-card" id="referralBtn" style="display:flex;justify-content:space-between;align-items:center;padding:16px;margin-bottom:10px;background:var(--bg-primary);border:1px solid var(--border-color);width:100%;cursor:pointer;text-align:left;">
      <span style="font-weight:600;">Referral Tab</span>
      <i class="fas fa-chevron-right"></i>
    </button>

    <button class="wb-card" id="withdrawBtn" style="display:flex;justify-content:space-between;align-items:center;padding:16px;margin-bottom:10px;background:var(--bg-primary);border:1px solid var(--border-color);width:100%;cursor:pointer;text-align:left;">
      <span style="font-weight:600;">Withdraw Funds</span>
      <i class="fas fa-chevron-right"></i>
    </button>

    <button class="wb-card" id="permBtn" style="display:flex;justify-content:space-between;align-items:center;padding:16px;margin-bottom:10px;background:var(--bg-primary);border:1px solid var(--border-color);width:100%;cursor:pointer;text-align:left;">
      <span style="font-weight:600;">Permissions</span>
      <i class="fas fa-chevron-right"></i>
    </button>

    <button class="wb-card" id="termsBtn" style="display:flex;justify-content:space-between;align-items:center;padding:16px;margin-bottom:10px;background:var(--bg-primary);border:1px solid var(--border-color);width:100%;cursor:pointer;text-align:left;">
      <span style="font-weight:600;">Terms</span>
      <i class="fas fa-chevron-right"></i>
    </button>

    <button class="wb-card" id="helpBtn" style="display:flex;justify-content:space-between;align-items:center;padding:16px;margin-bottom:10px;background:var(--bg-primary);border:1px solid var(--border-color);width:100%;cursor:pointer;text-align:left;">
      <span style="font-weight:600;">Help</span>
      <i class="fas fa-chevron-right"></i>
    </button>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:20px;">
      <button id="logoutBtn" style="padding:14px;background:var(--bg-secondary);color:var(--text-primary);border:none;border-radius:12px;font-weight:600;cursor:pointer;">Logout</button>
      <button id="manageAccountBtn" style="padding:14px;background:var(--bg-secondary);color:var(--text-primary);border:none;border-radius:12px;font-weight:600;cursor:pointer;">Manage Account</button>
    </div>

    <div class="wb-footer" style="text-align:center;font-size:12px;color:var(--text-secondary);margin-top:30px;line-height:1.8;">
      &copy; ${new Date().getFullYear()} | Made In Nigeria 🇳🇬<br>
      <span style="opacity:0.6;">W Bullion — v1.0.1</span>
    </div>
  `;

  document.getElementById('closeSettings').onclick = () => navigate('/home');

  document.getElementById('themeBtn').onclick = () => {
    const cur = localStorage.getItem('wb_theme') || 'system';
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(cur) + 1) % THEME_CYCLE.length];
    applyTheme(next);
    document.querySelector('#themeBtn i').className = `fas ${THEME_ICONS[next]}`;
    showToast(`Theme: ${next}`);
  };

  document.getElementById('visibilityBtn').onclick = () => {
    const p = document.getElementById('visibilityPanel');
    p.style.display = p.style.display === 'none' ? 'block' : 'none';
  };

  document.getElementById('visToggle').onchange = async (e) => {
    const on = e.target.checked;
    if (!on) {
      const ok = await showConfirm('Your account will be private. No one can search you or view you. You will not be able to create reels, view profiles or follow them, like reels.', 'Confirm');
      if (!ok) { e.target.checked = true; return; }
    }
    const r = await fetch('/api/users?action=visibility', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: getDeviceId(), email: user?.email || undefined, visibility: on })
    });
    const d = await r.json();
    if (!r.ok) return showToast(d.error);
    setCurrentUser(d.user);
    document.getElementById('visibilityLabel').textContent = on ? 'Public profile' : 'Private profile';
    showToast(on ? 'Profile is public' : 'Profile is private');
  };

  document.getElementById('badgesBtn')?.addEventListener('click', () => navigate('/badges'));
  document.getElementById('hoepBtn').onclick = () => navigate('/hoep');
  document.getElementById('erBtn').onclick = () => navigate('/er');
  document.getElementById('referralBtn').onclick = () => navigate('/referral');
  document.getElementById('withdrawBtn').onclick = () => navigate('/withdrawal');
  document.getElementById('permBtn').onclick = () => navigate('/permissions');
  document.getElementById('termsBtn').onclick = () => navigate('/terms');
  document.getElementById('helpBtn').onclick = () => navigate('/help');

  document.getElementById('logoutBtn').onclick = async () => {
    const ok = await showConfirm('Logout of this device?', 'Logout');
    if (!ok) return;
    await logout();
    navigate('/login');
  };

  document.getElementById('manageAccountBtn').onclick = () => {
    const modalRoot = document.getElementById('modalRoot');
    modalRoot.innerHTML = `
      <div class="modal-backdrop" id="manageAccountBackdrop" role="presentation">
        <section class="modal-box" role="dialog" aria-modal="true" aria-labelledby="manageAccountTitle" style="width:min(92vw,420px);">
          <h2 id="manageAccountTitle" style="font-size:20px;font-weight:700;">Manage account</h2>
          <p style="margin:10px 0 18px;color:var(--text-secondary);line-height:1.5;">Deactivate temporarily and restore your account later, or permanently delete it.</p>
          <div style="display:grid;gap:10px;">
            <button id="deactivateAccountAction" class="wb-btn-primary" type="button">Deactivate account</button>
            <button id="deleteAccountAction" type="button" style="padding:12px;border:1px solid rgba(239,68,68,.4);border-radius:12px;background:rgba(239,68,68,.08);color:#ef4444;font-weight:700;cursor:pointer;">Delete account</button>
            <button id="cancelManageAccount" type="button" style="padding:11px;border:0;background:transparent;color:var(--text-secondary);cursor:pointer;">Cancel</button>
          </div>
        </section>
      </div>`;

    const backdrop = document.getElementById('manageAccountBackdrop');
    const close = () => modalRoot.replaceChildren();
    document.getElementById('cancelManageAccount').onclick = close;
    backdrop.addEventListener('click', event => {
      if (event.target === backdrop) close();
    });

    document.getElementById('deactivateAccountAction').onclick = async () => {
      close();
      const approved = await showConfirm(
        'Your profile will disappear from search and this device will be logged out. Your data will remain saved. Sign in later and confirm reactivation to restore access. No payment is required.',
        'Deactivate account',
        'Deactivate'
      );
      if (!approved) return;
      try {
        const response = await fetch('/api/users?action=deactivate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: getDeviceId() })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return showToast(data.error || 'Could not deactivate account.');
        await logout();
        navigate('/login');
      } catch {
        showToast('Could not reach the account service. Try again.');
      }
    };

    document.getElementById('deleteAccountAction').onclick = async () => {
      close();
      const approved = await showConfirm('Delete your account permanently? This cannot be undone.', 'Delete account', 'Continue');
      if (!approved) return;
      const finalApproval = await showConfirm('Final warning: all account data will be permanently removed.', 'Confirm deletion', 'Delete permanently');
      if (!finalApproval) return;
      try {
        const response = await fetch(`/api/users?action=delete&deviceId=${encodeURIComponent(getDeviceId())}`, { method: 'POST' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return showToast(data.error || 'Could not delete account.');
        await logout();
        navigate('/login');
      } catch {
        showToast('Could not reach the account service. Try again.');
      }
    };

    document.getElementById('deactivateAccountAction').focus();
  };
}
