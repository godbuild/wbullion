import { getDeviceId, getCurrentUser } from '../auth.js';
import { showToast } from '../modal.js';
import { apiFetch } from '../lib/api.js';

export async function renderSearch() {
  const el = document.getElementById('viewContainer');
  el.innerHTML = `
    <div style="padding:20px 16px 24px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h2 style="font-size:22px;font-weight:700;">Search</h2>
        <button id="closeSearch" class="wb-close"><i class="fas fa-close"></i></button>
      </div>
      <div style="position:relative;margin-bottom:16px;">
        <i class="fas fa-search" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--text-secondary);"></i>
        <input id="searchInput" type="text" placeholder="Search @username or name" style="width:100%;padding:12px 14px 12px 40px;border:1px solid var(--border-color);border-radius:12px;background:var(--bg-primary);color:var(--text-primary);font-size:15px;outline:none;" />
      </div>
      <div id="searchResults" style="display:flex;flex-direction:column;gap:10px;min-height:120px;"></div>
    </div>
  `;

  const input = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');
  const me = getCurrentUser();

  const runSearch = async (q) => {
    const term = (q || '').trim();
    if (!term) {
      results.innerHTML = '<div style="padding:18px;text-align:center;color:var(--text-secondary);">Search people by @username or full name.</div>';
      return;
    }
    try {
      const data = await apiFetch(`/api/users?action=search&q=${encodeURIComponent(term)}`, { suppressAuthRedirect: true });
      const list = data.results || [];
      if (!list.length) {
        results.innerHTML = '<div style="padding:18px;text-align:center;color:var(--text-secondary);">No matching users found.</div>';
        return;
      }
      results.innerHTML = list.map(u => {
        const badge = u.badge_awarded || u.admin ? '<img src="/images/vbadge.png" alt="Verified" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-left:6px;" />' : '';
        const isMe = me && (me.username || '').toLowerCase() === (u.username || '').toLowerCase();
        const action = isMe ? '<span style="font-size:12px;color:var(--text-secondary);">You</span>' : (u.isFollowing ? '<span style="font-size:12px;color:var(--green);">Following</span>' : '<span style="font-size:12px;color:var(--text-secondary);">View</span>');
        return `
          <div class="wb-card" style="padding:12px 14px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;" data-user="${u.username}">
            <div style="display:flex;align-items:center;gap:10px;min-width:0; flex:1;">
              <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#dbfedd,#d8cfff);display:flex;align-items:center;justify-content:center;font-weight:700;color:#1f2937;">${(u.full_name || u.username || 'U').charAt(0).toUpperCase()}</div>
              <div style="min-width:0;overflow:hidden;">
                <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${u.full_name || u.username || 'User'}${badge}
                </div>
                <div style="font-size:12px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.username || '@user'}</div>
              </div>
            </div>
            <div style="font-size:12px;">${action}</div>
          </div>
        `;
      }).join('');

      results.querySelectorAll('[data-user]').forEach(node => {
        node.addEventListener('click', () => {
          const username = node.getAttribute('data-user');
          if (username) window.location.hash = `#/profile/${username.replace(/^@/, '')}`;
          window.location.href = `/profile/${username.replace(/^@/, '')}`;
        });
      });
    } catch (err) {
      results.innerHTML = `<div style="padding:18px;text-align:center;color:#ef4444;">${err.message || 'Search failed'}</div>`;
    }
  };

  input.addEventListener('input', (e) => {
    const value = e.target.value;
    clearTimeout(input._timer);
    input._timer = setTimeout(() => runSearch(value), 250);
  });

  document.getElementById('closeSearch').onclick = () => history.back();
  runSearch(input.value);
}
