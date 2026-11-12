import { getCurrentUser } from '../auth.js';
import { showToast } from '../modal.js';
import { apiFetch } from '../lib/api.js';
import { navigate } from '../router.js';

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
  let requestId = 0;

  const runSearch = async (q, searchRequest = ++requestId) => {
    const currentRequest = searchRequest;
    const term = (q || '').trim();
    if (!term) {
      results.innerHTML = '<div style="padding:18px;text-align:center;color:var(--text-secondary);">Search people by @username or full name.</div>';
      return;
    }
    if (term.length < 2) {
      results.innerHTML = '<div style="padding:18px;text-align:center;color:var(--text-secondary);">Enter at least 2 characters to search.</div>';
      return;
    }
    results.innerHTML = '<div role="status" style="padding:18px;text-align:center;color:var(--text-secondary);">Searching…</div>';
    try {
      const data = await apiFetch(`/api/users?action=search&q=${encodeURIComponent(term)}`, { suppressAuthRedirect: true });
      if (currentRequest !== requestId) return;
      const list = data.results || [];
      if (!list.length) {
        results.innerHTML = '<div role="status" style="padding:18px;text-align:center;color:var(--text-secondary);">No matching users found.</div>';
        return;
      }
      results.innerHTML = list.map(u => {
        const username = String(u.username || '@user');
        const fullName = String(u.full_name || username);
        const badge = u.badge_awarded || u.admin ? '<i class="fas fa-check-circle" aria-label="Verified" title="Verified" style="color:#3b82f6;font-size:15px;display:inline-block;vertical-align:middle;margin-left:6px;"></i>' : '';
        const isMe = me && (me.username || '').toLowerCase() === username.toLowerCase();
        const action = isMe ? '<span style="font-size:12px;color:var(--text-secondary);">You</span>' : (u.isFollowing ? '<span style="font-size:12px;color:var(--green);">Following</span>' : '<span style="font-size:12px;color:var(--text-secondary);">View profile</span>');
        return `
          <div class="wb-card" role="button" tabindex="0" aria-label="Open ${escapeHtml(fullName)} profile" style="padding:12px 14px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;" data-user="${escapeHtml(username)}">
            <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1;">
              <div aria-hidden="true" style="width:36px;height:36px;flex:0 0 36px;border-radius:50%;background:linear-gradient(135deg,#dbfedd,#d8cfff);display:flex;align-items:center;justify-content:center;font-weight:700;color:#1f2937;">${escapeHtml(fullName.charAt(0).toUpperCase())}</div>
              <div style="min-width:0;overflow:hidden;">
                <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(fullName)}${badge}</div>
                <div style="font-size:12px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(username)}</div>
              </div>
            </div>
            <div style="font-size:12px;">${action}</div>
          </div>
        `;
      }).join('');

      results.querySelectorAll('[data-user]').forEach(node => {
        const openProfile = () => navigate(`/profile/${encodeURIComponent(node.dataset.user.replace(/^@/, ''))}`);
        node.addEventListener('click', openProfile);
        node.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openProfile();
          }
        });
      });
    } catch (err) {
      if (currentRequest !== requestId) return;
      results.innerHTML = `<div role="status" style="padding:18px;text-align:center;color:#ef4444;">${escapeHtml(err.message || 'Search failed')}</div>`;
    }
  };

  input.addEventListener('input', (e) => {
    const value = e.target.value;
    const currentRequest = ++requestId;
    clearTimeout(input._timer);
    input._timer = setTimeout(() => runSearch(value, currentRequest), 250);
  });

  document.getElementById('closeSearch').onclick = () => history.back();
  runSearch(input.value);
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}
