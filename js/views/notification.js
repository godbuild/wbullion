import { navigate } from '../router.js';
import { getDeviceId } from '../auth.js';
import { showToast } from '../modal.js';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'follow', label: 'Follows' },
  { key: 'profile_view', label: 'Profile Views' },
  { key: 'referral', label: 'Referrals' },
  { key: 'reel_view', label: 'Reel Views' },
  { key: 'reel_like', label: 'Reel Likes' },
  { key: 'reel_dislike', label: 'Reel Dislikes' },
  { key: 'bonus', label: 'Bonus' },
  { key: 'reel_earn', label: 'Reel Earnings' },
  { key: 'follower_earn', label: 'Follower Earnings' },
  { key: 'new_reel', label: 'New Reels' },
  { key: 'game', label: 'Games' },
  { key: 'activation', label: 'System' },
  { key: 'general', label: 'General' }
];

export async function renderNotifications(category = 'all') {
  const el = document.getElementById('viewContainer');
  el.innerHTML = `<div style="padding:40px;text-align:center;"><i class="fas fa-spinner fa-spin"></i></div>`;

  const deviceId = getDeviceId();
  try {
    const res = await fetch(`/api/notifications/list?deviceId=${encodeURIComponent(deviceId)}&category=${category}`);
    const data = await res.json();
    const list = data.notifications || [];
    const counts = data.counts || {};

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h2 style="font-size:22px;font-weight:bold;">Notifications</h2>
        <div style="display:flex;gap:8px;">
          <button id="markAllRead" class="wb-close" style="font-size:13px;font-weight:600;">Mark all read</button>
          <button id="closeNotif" class="wb-close"><i class="fas fa-close"></i></button>
        </div>
      </div>

      <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:10px;margin-bottom:14px;">
        ${CATEGORIES.map(c => {
          const unread = counts[c.key]?.unread || 0;
          const active = category === c.key;
          return `<button class="catTab" data-cat="${c.key}" style="flex-shrink:0;padding:8px 14px;border-radius:20px;border:none;background:${active ? 'var(--green)' : 'var(--bg-secondary)'};color:${active ? 'white' : 'var(--text-primary)'};font-weight:600;font-size:13px;cursor:pointer;position:relative;">
            ${c.label}
            ${unread > 0 ? `<span style="background:#ef4444;color:white;font-size:10px;padding:1px 6px;border-radius:8px;margin-left:6px;">${unread}</span>` : ''}
          </button>`;
        }).join('')}
      </div>

      <div id="notifList" style="display:flex;flex-direction:column;gap:8px;">
        ${list.length === 0 ? '<p style="text-align:center;color:var(--text-secondary);padding:40px;">No notifications</p>' :
          list.map(n => `
            <div class="wb-card" data-id="${n.id}" style="padding:14px;cursor:pointer;background:${n.read ? 'var(--bg-primary)' : 'linear-gradient(135deg,#e1fedb,var(--bg-primary))'};">
              <p style="font-weight:600;font-size:14px;">${n.title || ''}</p>
              <p style="font-size:13px;color:var(--text-secondary);margin-top:4px;">${n.body || ''}</p>
              <p style="font-size:11px;color:var(--text-secondary);margin-top:8px;">${new Date(n.created_at).toLocaleString()}</p>
            </div>
          `).join('')}
      </div>
    `;

    document.querySelectorAll('.catTab').forEach(t => {
      t.onclick = () => renderNotifications(t.dataset.cat);
    });

    document.getElementById('closeNotif').onclick = () => history.back();

    document.getElementById('markAllRead').onclick = async () => {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, all: true })
      });
      showToast('Marked all as read');
      renderNotifications(category);
    };

    document.querySelectorAll('#notifList [data-id]').forEach(el => {
      el.onclick = async () => {
        await fetch('/api/notifications/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId, id: el.dataset.id })
        });
        el.style.background = 'var(--bg-primary)';
      };
    });
  } catch {
    el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-secondary);">Failed to load</div>`;
  }
}
