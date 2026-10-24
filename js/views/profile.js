import { navigate } from '../router.js';
import { getCurrentUser, getDeviceId, setCurrentUser } from '../auth.js';
import { showToast, showAlert, showConfirm } from '../modal.js';
import { money, compact } from '../format.js';

export async function renderProfile(username) {
  const el = document.getElementById('viewContainer');
  el.style.padding = '0';
  el.innerHTML = `<div style="padding:40px;text-align:center;"><i class="fas fa-spinner fa-spin"></i></div>`;

  const deviceId = getDeviceId();
  const me = getCurrentUser();
  const target = username || '@' + (me?.username || '').replace(/^@/, '');
  const clean = target.startsWith('@') ? target.toLowerCase() : '@' + target.toLowerCase();

  if (clean !== (me?.username || '').toLowerCase()) {
    fetch('/api/users?action=track-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, username: target })
    }).catch(() => {});
  }

  try {
    const email = me?.email ? `&email=${encodeURIComponent(me.email)}` : '';
    const res = await fetch(`/api/users?action=profile&deviceId=${encodeURIComponent(deviceId)}${email}&username=${encodeURIComponent(clean)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load');

    const { user, counts, hoepInfo, reels } = data;
    const heading = user.isOwner ? 'My Profile' : 'Profile';

    el.innerHTML = `
      <div style="padding:20px;padding-top:calc(20px + env(safe-area-inset-top));padding-bottom:100px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h2 style="font-size:22px;font-weight:bold;">${heading}</h2>
          <div style="display:flex;gap:8px;align-items:center;">
            ${user.isOwner ? `
              <button id="editBtn" class="wb-close" style="font-size:18px;"><i class="fas fa-pencil"></i></button>
              <button id="notifBtn" class="wb-close" style="font-size:18px;position:relative;">
                <i class="fas fa-bell"></i>
              </button>
            ` : ''}
            <button id="closeProfile" class="wb-close" style="font-size:18px;"><i class="fas fa-close"></i></button>
          </div>
        </div>

        <div style="text-align:center;margin-bottom:24px;">
          <div style="width:80px;height:80px;border-radius:50%;background:#dbfedd;color:#1f2937;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:36px;margin:0 auto 12px;">
            ${(user.username || 'U')[1]?.toUpperCase() || 'U'}
          </div>
          <h3 style="font-size:18px;font-weight:700;">
            ${user.full_name}
            ${user.badge_awarded ? '<i class="fas fa-check-circle" aria-label="Verified" title="Verified" style="color:#3b82f6;font-size:16px;display:inline-block;vertical-align:middle;margin-left:4px;"></i>' : ''}
          </h3>
          <p style="color:var(--text-secondary);font-size:14px;">${user.username}${user.isAdmin ? ' <span style="background:#3ba072;color:white;font-size:10px;padding:2px 6px;border-radius:8px;">Admin</span>' : ''}</p>
        </div>

        <div style="display:flex;justify-content:center;gap:24px;margin-bottom:20px;">
          <div style="text-align:center;">
            <p style="font-weight:bold;font-size:16px;">${compact(counts.following)}</p>
            <p style="color:var(--text-secondary);font-size:12px;">Following</p>
          </div>
          <div style="width:1px;background:var(--border-color);"></div>
          <div style="text-align:center;">
            <p style="font-weight:bold;font-size:16px;">${compact(counts.followers)}</p>
            <p style="color:var(--text-secondary);font-size:12px;">Followers</p>
          </div>
          <div style="width:1px;background:var(--border-color);"></div>
          <div style="text-align:center;">
            <p style="font-weight:bold;font-size:16px;">${compact(counts.referred)}</p>
            <p style="color:var(--text-secondary);font-size:12px;">Referred</p>
          </div>
        </div>

        ${!user.isOwner ? `
          <button id="followBtn" class="wb-btn-primary" style="background:${user.following ? 'var(--bg-secondary)' : 'var(--green)'};color:${user.following ? 'var(--text-primary)' : 'white'};margin-bottom:16px;">
            ${user.following ? 'Following' : 'Follow'}
          </button>
        ` : ''}

        ${user.isOwner && user.hoep_enabled ? `
          <button id="hoepInfoBtn" class="wb-btn-primary" style="background:var(--purple);margin-bottom:16px;">Help Others Earn Info</button>
          <div id="hoepInfo" style="display:none;" class="wb-card">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>People who helped me earn</span><strong>${compact(hoepInfo?.helpedMeCount || 0)}</strong></div>
            <div style="display:flex;justify-content:space-between;"><span>People I helped earn</span><strong>${compact(hoepInfo?.iHelpedCount || 0)}</strong></div>
          </div>
        ` : ''}

        <h3 style="font-size:16px;font-weight:600;margin:24px 0 12px;">Reels (${reels.length})</h3>
        <div id="reelsGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;">
          ${reels.length === 0 ? '<p style="grid-column:span 3;text-align:center;color:var(--text-secondary);padding:20px;">No reels yet</p>' : ''}
        </div>
      </div>
    `;

    const grid = document.getElementById('reelsGrid');
    for (const r of reels) {
      const tile = document.createElement('div');
      tile.style.cssText = 'aspect-ratio:9/16;background:#000;border-radius:4px;cursor:pointer;position:relative;overflow:hidden;';
      tile.innerHTML = `
        <video src="${r.cloudinary_secure_url}" muted playsinline preload="metadata" style="width:100%;height:100%;object-fit:cover;"></video>
        <div style="position:absolute;bottom:4px;left:4px;color:white;font-size:11px;text-shadow:0 1px 2px black;">
          <i class="fas fa-eye"></i> ${compact(r.views || 0)}
        </div>
        ${user.isOwner ? `<button class="tileDel" data-id="${r.id}" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.6);border:none;color:white;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:11px;"><i class="fas fa-trash"></i></button>` : ''}
      `;
      tile.onclick = (e) => {
        if (e.target.closest('.tileDel')) return;
        navigate(`/reels/${r.id}`);
      };
      grid.appendChild(tile);
    }

    document.getElementById('closeProfile').onclick = () => history.back();

    document.getElementById('followBtn')?.addEventListener('click', async () => {
      const action = user.following ? 'unfollow' : 'follow';
      const res2 = await fetch('/api/users?action=follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, email: me?.email || undefined, username: user.username, action })
      });
      const d = await res2.json();
      if (!res2.ok) return showToast(d.error || 'Error');
      showToast(d.message);
      renderProfile(user.username);
    });

    document.getElementById('hoepInfoBtn')?.addEventListener('click', () => {
      const box = document.getElementById('hoepInfo');
      box.style.display = box.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('notifBtn')?.addEventListener('click', () => navigate('/profile/notifications'));
    document.getElementById('editBtn')?.addEventListener('click', () => showEditModal(user));

    document.querySelectorAll('.tileDel').forEach(b => b.onclick = async (e) => {
      e.stopPropagation();
      const ok = await showConfirm('Delete this reel?', 'Delete');
      if (!ok) return;
      await fetch(`/api/reels?action=single&id=${b.dataset.id}&deviceId=${encodeURIComponent(deviceId)}`, { method: 'DELETE' });
      showToast('Deleted');
      renderProfile(user.username);
    });
  } catch (err) {
    el.innerHTML = `<div style="padding:60px 20px;text-align:center;color:var(--text-secondary);">${err.message}</div>`;
  }
}

function showEditModal(user) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-box">
      <h3 style="margin-bottom:16px;">Edit Profile</h3>
      <input id="edName" class="wb-input" placeholder="Full Name" value="${user.full_name}" style="margin-bottom:10px;">
      <input id="edUsername" class="wb-input" placeholder="@username" value="${user.username}" style="margin-bottom:10px;">
      <input id="edEmail" class="wb-input" placeholder="email" value="${user.email || ''}" style="margin-bottom:10px;">
      <textarea id="edBio" class="wb-input" placeholder="Bio (200 chars)" maxlength="200" style="margin-bottom:10px;min-height:60px;">${user.bio || ''}</textarea>

      <hr style="margin:16px 0;">
      <h4 style="font-size:14px;margin-bottom:10px;">Change Password</h4>
      <input id="edCurrent" type="password" class="wb-input" placeholder="Current password" style="margin-bottom:8px;">
      <input id="edNew" type="password" class="wb-input" placeholder="New password" style="margin-bottom:8px;">
      <input id="edConfirm" type="password" class="wb-input" placeholder="Confirm new password" style="margin-bottom:12px;">

      <div class="modal-actions">
        <button class="modal-btn ghost" id="cancelEdit">Cancel</button>
        <button class="modal-btn primary" id="saveEdit">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#cancelEdit').onclick = () => modal.remove();
  modal.querySelector('#saveEdit').onclick = async () => {
    const deviceId = getDeviceId();
    const name = document.getElementById('edName').value.trim();
    const uname = document.getElementById('edUsername').value.trim();
    const email = document.getElementById('edEmail').value.trim();
    const bio = document.getElementById('edBio').value.trim();

    const r1 = await fetch('/api/users?action=update-me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, fullName: name, username: uname, email, bio })
    });
    const d1 = await r1.json();
    if (!r1.ok) return showAlert(d1.error, 'Error');
    setCurrentUser(d1.user);

    const cp = document.getElementById('edCurrent').value;
    const np = document.getElementById('edNew').value;
    const cf = document.getElementById('edConfirm').value;
    if (cp || np || cf) {
      const r2 = await fetch('/api/users?action=change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, currentPassword: cp, newPassword: np, confirmPassword: cf })
      });
      const d2 = await r2.json();
      if (!r2.ok) return showAlert(d2.error, 'Password Error');
      showToast('Password updated');
    }

    showToast('Profile saved');
    modal.remove();
    renderProfile(d1.user.username);
  };
}
