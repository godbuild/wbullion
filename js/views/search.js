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
        const action = isMe ? 'You' : u.isFollowing ? 'Following' : 'View profile';
        const reels = Array.isArray(u.reels) ? u.reels : [];
        const reelGrid = u.private
          ? '<p style="margin:12px 0 2px;color:var(--text-secondary);font-size:13px;">This account is private.</p>'
          : reels.length
            ? `<div aria-label="Latest reels by ${escapeHtml(username)}" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3px;margin-top:12px;">${reels.map((reel, index) => `
                <button type="button" class="search-reel-tile" data-reel="${escapeHtml(reel.id)}" aria-label="Open reel ${index + 1} from ${escapeHtml(username)}" style="position:relative;aspect-ratio:9/16;overflow:hidden;padding:0;border:0;border-radius:3px;background:#111;color:white;cursor:pointer;">
                  <video src="${escapeHtml(reel.cloudinary_secure_url)}" poster="${escapeHtml(getReelPoster(reel.cloudinary_secure_url))}" muted playsinline preload="none" aria-hidden="true" style="width:100%;height:100%;object-fit:cover;"></video>
                  <span style="position:absolute;left:4px;bottom:4px;color:white;font-size:10px;text-shadow:0 1px 3px #000;"><i class="fas fa-play" aria-hidden="true"></i> ${Number(reel.views || 0).toLocaleString()}</span>
                </button>
              `).join('')}</div>`
            : '<p style="margin:12px 0 2px;color:var(--text-secondary);font-size:13px;">No reels yet.</p>';
        return `
          <article class="wb-card" style="padding:12px 14px;">
            <div class="search-profile-link" role="button" tabindex="0" aria-label="View ${escapeHtml(fullName)} profile" style="display:flex;justify-content:space-between;align-items:center;gap:12px;cursor:pointer;" data-user="${escapeHtml(username)}">
              <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1;">
                <div aria-hidden="true" style="width:40px;height:40px;flex:0 0 40px;border-radius:50%;background:linear-gradient(135deg,#dbfedd,#d8cfff);display:flex;align-items:center;justify-content:center;font-weight:700;color:#1f2937;">${escapeHtml(fullName.charAt(0).toUpperCase())}</div>
                <div style="min-width:0;overflow:hidden;">
                  <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(fullName)}${badge}</div>
                  <div style="font-size:12px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(username)}</div>
                </div>
              </div>
              <span style="flex:0 0 auto;padding:7px 11px;border-radius:9px;background:var(--bg-secondary);color:var(--text-primary);font-size:12px;font-weight:600;">${action}</span>
            </div>
            ${reelGrid}
          </article>
        `;
      }).join('');

      results.querySelectorAll('.search-profile-link').forEach(node => {
        const openProfile = () => navigate(`/profile/${encodeURIComponent(node.dataset.user.replace(/^@/, ''))}`);
        node.addEventListener('click', openProfile);
        node.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openProfile();
          }
        });
      });
      results.querySelectorAll('.search-reel-tile').forEach(node => {
        node.addEventListener('click', () => navigate(`/reels/${encodeURIComponent(node.dataset.reel)}`));
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

function getReelPoster(url) {
  return String(url || '').replace('/video/upload/', '/video/upload/so_0,f_jpg/').replace(/\.(?:mp4|mov|webm)(\?.*)?$/i, '.jpg$1');
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}
