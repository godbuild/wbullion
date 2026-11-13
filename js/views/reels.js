import { navigate } from '../router.js';
import { getCurrentUser, getDeviceId } from '../auth.js';

function restoreAppTheme() {
  document.documentElement.removeAttribute('data-reels-theme');
  document.body.classList.remove('reels-active');
  document.body.style.cssText = '';
  const app = document.getElementById('app');
  const view = document.getElementById('viewContainer');
  if (app) app.style.background = '';
  if (view) {
    view.style.padding = '';
    view.style.minHeight = '';
    view.classList.remove('full-bleed-view');
  }
}
import { showToast, showConfirm } from '../modal.js';
import { compact } from '../format.js';

let _state = {
  reels: [],
  index: 0,
  touchStartY: null,
  touchEndY: null,
  searchRequestId: 0,
  searchTerm: '',
  searchResults: [],
  showingSearchGrid: false,
  viewingSearchResult: false,
  baseReels: [],
  baseIndex: 0
};
const pendingReactions = new Set();

function forceDark() {
  document.documentElement.setAttribute('data-reels-theme', 'dark');
}

export async function renderReels() {
  forceDark();
  const el = document.getElementById('viewContainer');
  el.style.padding = '0';
  el.innerHTML = `
    <div style="position:fixed;inset:0;background:#000;color:white;z-index:40;display:flex;flex-direction:column;">
      <div style="position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;align-items:center;padding:16px;z-index:50;padding-top:calc(16px + env(safe-area-inset-top));">
        <div style="display:flex;gap:8px;">
          <button id="reelsClose" aria-label="Close reels" style="background:rgba(0,0,0,0.4);border:none;color:white;width:40px;height:40px;border-radius:50%;font-size:18px;cursor:pointer;">
            <i class="fas fa-close"></i>
          </button>
          <button id="backToReelResults" aria-label="Back to reel search results" hidden style="background:rgba(0,0,0,0.4);border:none;color:white;width:40px;height:40px;border-radius:50%;font-size:16px;cursor:pointer;">
            <i class="fas fa-arrow-left"></i>
          </button>
        </div>
        <button id="reelsSearchBtn" aria-label="Search reels" style="background:rgba(0,0,0,0.4);border:none;color:white;width:40px;height:40px;border-radius:50%;font-size:16px;cursor:pointer;">
          <i class="fas fa-search"></i>
        </button>
      </div>

      <div id="searchBar" style="display:none;position:absolute;top:64px;left:16px;right:16px;z-index:55;padding-top:env(safe-area-inset-top);">
        <input id="reelSearchInput" aria-label="Search reels" placeholder="Search reels by caption or creator..." style="width:100%;padding:12px 16px;border-radius:12px;border:none;background:rgba(0,0,0,0.75);color:white;font-size:15px;outline:none;">
      </div>

      <section id="reelSearchResults" aria-label="Reel search results" hidden style="position:absolute;inset:0;z-index:45;overflow-y:auto;background:#080808;padding:calc(78px + env(safe-area-inset-top)) 2px calc(20px + env(safe-area-inset-bottom));">
        <p id="reelSearchResultSummary" role="status" style="margin:0 12px 12px;color:#ccc;font-size:13px;"></p>
        <div id="reelSearchGrid" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2px;"></div>
      </section>

      <div id="reelSlide" style="flex:1;position:relative;overflow:hidden;"></div>

      <button id="createReelBtn" style="position:absolute;bottom:calc(24px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);background:white;color:#2c0941;border:none;width:52px;height:52px;border-radius:16px;font-size:22px;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,0.5);z-index:55;">
        <i class="fas fa-plus"></i>
      </button>
    </div>
  `;

  document.getElementById('reelsClose').onclick = () => { restoreAppTheme(); navigate('/home'); };
  document.getElementById('createReelBtn').onclick = () => navigate('/reels/new/create');

  document.getElementById('reelsSearchBtn').onclick = () => {
    const bar = document.getElementById('searchBar');
    bar.style.display = bar.style.display === 'none' ? 'block' : 'none';
    if (bar.style.display === 'block') document.getElementById('reelSearchInput').focus();
  };
  document.getElementById('backToReelResults').onclick = () => showReelSearchResults();

  let searchTimer;
  document.getElementById('reelSearchInput').addEventListener('input', e => {
    const query = e.target.value.trim();
    clearTimeout(searchTimer);
    if (!query) {
      resetReelSearch();
      return;
    }
    const requestId = ++_state.searchRequestId;
    showReelSearchLoading(query);
    searchTimer = setTimeout(() => searchReels(query, requestId), 300);
  });

  setupSwipe();
  requestLocationPermission();
  await loadReels();
}

function requestLocationPermission() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    () => {
      const permissions = JSON.parse(localStorage.getItem('wb_perms') || '{}');
      permissions.location = true;
      localStorage.setItem('wb_perms', JSON.stringify(permissions));
    },
    () => {
      const permissions = JSON.parse(localStorage.getItem('wb_perms') || '{}');
      permissions.location = false;
      localStorage.setItem('wb_perms', JSON.stringify(permissions));
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
  );
}

async function loadReels(q = '') {
  const requestId = ++_state.searchRequestId;
  _state.searchTerm = q.trim();
  const deviceId = getDeviceId();
  const email = getCurrentUser()?.email;
  try {
    const res = await fetch(`/api/reels?action=list&deviceId=${encodeURIComponent(deviceId)}${email ? `&email=${encodeURIComponent(email)}` : ''}&q=${encodeURIComponent(_state.searchTerm)}`);
    const data = await res.json();
    if (requestId !== _state.searchRequestId) return;
    if (!res.ok) throw new Error(data.error || 'Failed to load reels');
    _state.reels = data.reels || [];
    _state.baseReels = _state.reels;
    _state.index = 0;
    _state.baseIndex = 0;
    _state.viewingSearchResult = false;
    renderSlide();
  } catch (err) {
    if (requestId !== _state.searchRequestId) return;
    document.getElementById('reelSlide').innerHTML = `<div style="color:#fca5a5;text-align:center;padding:60px 24px;">${escapeHtml(err.message || 'Failed to load reels')}</div>`;
  }
}

function showReelSearchLoading(query) {
  if (!_state.showingSearchGrid && !_state.viewingSearchResult) _state.baseIndex = _state.index;
  _state.showingSearchGrid = true;
  document.getElementById('reelSearchResults').hidden = false;
  document.getElementById('reelSearchResultSummary').textContent = `Searching reels for “${query}”…`;
  document.getElementById('reelSearchGrid').innerHTML = '';
  document.getElementById('reelSlide').style.display = 'none';
  document.getElementById('createReelBtn').hidden = true;
  document.getElementById('backToReelResults').hidden = true;
}

async function searchReels(query, requestId) {
  _state.searchTerm = query;
  const deviceId = getDeviceId();
  const email = getCurrentUser()?.email;
  try {
    const res = await fetch(`/api/reels?action=list&deviceId=${encodeURIComponent(deviceId)}${email ? `&email=${encodeURIComponent(email)}` : ''}&q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (requestId !== _state.searchRequestId) return;
    if (!res.ok) throw new Error(data.error || 'Search failed');
    _state.searchResults = data.reels || [];
    renderReelSearchGrid();
  } catch (error) {
    if (requestId !== _state.searchRequestId) return;
    const summary = document.getElementById('reelSearchResultSummary');
    summary.textContent = error.message || 'Could not search reels. Try again.';
    summary.style.color = '#fca5a5';
  }
}

function renderReelSearchGrid() {
  const summary = document.getElementById('reelSearchResultSummary');
  const grid = document.getElementById('reelSearchGrid');
  summary.style.color = '#ccc';
  summary.textContent = _state.searchResults.length
    ? `${_state.searchResults.length} reel${_state.searchResults.length === 1 ? '' : 's'} found`
    : `No reels found for “${_state.searchTerm}”. Try a caption, description, or creator username.`;
  grid.innerHTML = _state.searchResults.map((reel, index) => `
    <button type="button" class="reel-search-tile" data-index="${index}" aria-label="Open reel ${index + 1}${reel.caption ? `: ${escapeAttr(reel.caption)}` : ''}" style="position:relative;aspect-ratio:9/16;overflow:hidden;padding:0;border:0;background:#161616;color:white;cursor:pointer;">
      <video src="${escapeAttr(reel.cloudinary_secure_url)}" poster="${escapeAttr(getReelPoster(reel.cloudinary_secure_url))}" muted playsinline preload="none" aria-hidden="true" style="width:100%;height:100%;object-fit:cover;"></video>
      <span style="position:absolute;left:7px;bottom:7px;display:flex;align-items:center;gap:4px;color:white;font-size:12px;text-shadow:0 1px 3px #000;"><i class="fas fa-play" aria-hidden="true"></i>${compact(reel.views || 0)}</span>
    </button>
  `).join('');
  grid.querySelectorAll('.reel-search-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      _state.reels = _state.searchResults;
      _state.index = Number(tile.dataset.index);
      _state.viewingSearchResult = true;
      document.getElementById('reelSearchResults').hidden = true;
      document.getElementById('reelSlide').style.display = 'block';
      document.getElementById('searchBar').style.display = 'none';
      document.getElementById('backToReelResults').hidden = false;
      renderSlide();
    });
  });
}

function showReelSearchResults() {
  _state.showingSearchGrid = true;
  _state.viewingSearchResult = false;
  document.getElementById('reelSearchResults').hidden = false;
  document.getElementById('reelSlide').style.display = 'none';
  document.getElementById('createReelBtn').hidden = true;
  document.getElementById('backToReelResults').hidden = true;
}

function resetReelSearch() {
  _state.searchRequestId++;
  _state.searchTerm = '';
  const hadSearchResults = _state.searchResults.length > 0;
  _state.searchResults = [];
  _state.showingSearchGrid = false;
  if (hadSearchResults || _state.viewingSearchResult) {
    _state.reels = _state.baseReels;
    _state.index = _state.baseIndex;
    renderSlide();
  }
  _state.viewingSearchResult = false;
  document.getElementById('reelSearchResults').hidden = true;
  document.getElementById('reelSlide').style.display = 'block';
  document.getElementById('createReelBtn').hidden = false;
  document.getElementById('backToReelResults').hidden = true;
}

function renderSlide() {
  const wrap = document.getElementById('reelSlide');
  if (_state.reels.length === 0) {
    const message = _state.searchTerm
      ? `No reels found for “${escapeHtml(_state.searchTerm)}”. Try a caption, description, or creator username.`
      : 'No reels are available right now.';
    wrap.innerHTML = `<div role="status" style="display:flex;align-items:center;justify-content:center;height:100%;padding:24px;text-align:center;color:#b8b8b8;font-size:16px;">${message}</div>`;
    return;
  }

  wrap.innerHTML = _state.reels.map((r, i) => {
    const user = getCurrentUser();
    const liked = (r.likes || []).includes(user?.id);
    const isOwner = r.user_id === user?.id;
    const desc = r.description || '';
    const descShort = desc.length > 90 ? desc.slice(0, 90) + '…' : desc;

    return `
      <div class="reel-slide" data-index="${i}" style="position:absolute;inset:0;transform:translateY(${(i - _state.index) * 100}%);transition:transform 0.3s ease;background:#000;">
        <video src="${r.cloudinary_secure_url}" playsinline loop preload="metadata" style="width:100%;height:100%;object-fit:contain;background:#000;"></video>
        <div class="reel-play-icon" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0;transition:opacity 0.15s;">
          <i class="fas fa-play" style="font-size:60px;color:rgba(255,255,255,0.85);"></i>
        </div>

        <div style="position:absolute;right:12px;bottom:120px;display:flex;flex-direction:column;gap:18px;align-items:center;z-index:5;">
          <button class="reel-profile" data-username="${r.username}" style="background:none;border:none;color:white;cursor:pointer;text-align:center;">
            <div style="width:46px;height:46px;border-radius:50%;background:#dbfedd;color:#1f2937;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:20px;border:2px solid white;">
              ${(r.username || 'U')[1]?.toUpperCase() || 'U'}
            </div>
          </button>
          <button class="reel-like ${liked ? 'liked' : ''}" aria-label="${liked ? 'Unlike reel' : 'Like reel'}" data-id="${r.id}" data-index="${i}" style="background:none;border:none;color:${liked ? '#3ba072' : 'white'};cursor:pointer;font-size:26px;display:flex;flex-direction:column;align-items:center;gap:2px;">
            <i class="fas fa-thumbs-up"></i>
            <span style="font-size:12px;">${compact((r.likes || []).length)}</span>
          </button>
          ${isOwner ? `<button class="reel-delete" data-id="${r.id}" style="background:none;border:none;color:white;cursor:pointer;font-size:22px;"><i class="fas fa-trash"></i></button>` : ''}
        </div>

        <div style="position:absolute;left:12px;right:80px;bottom:100px;color:white;z-index:5;">
          <p style="font-weight:700;font-size:15px;">${r.username}</p>
          ${r.caption ? `<p style="font-weight:600;font-size:14px;margin-top:4px;">${escapeHtml(r.caption)}</p>` : ''}
          ${desc ? `<p style="font-size:13px;opacity:0.9;margin-top:4px;" class="reel-desc" data-full="${escapeAttr(desc)}" data-short="${escapeAttr(descShort)}">${escapeHtml(descShort)}${desc.length > 90 ? ' <button type="button" class="reel-more" aria-expanded="false" style="font-weight:600;background:none;border:0;padding:0;color:inherit;cursor:pointer;">more</button>' : ''}</p>` : ''}
        </div>

        <div style="position:absolute;right:12px;top:64px;color:white;font-size:12px;opacity:0.85;z-index:5;">
          <i class="fas fa-eye"></i> ${compact(r.views || 0)}
        </div>
      </div>
    `;
  }).join('');

  wrap.querySelectorAll('.reel-slide').forEach(slide => {
    const video = slide.querySelector('video');
    const playIcon = slide.querySelector('.reel-play-icon');
    slide.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('.reel-more')) return;
      if (video.paused) {
        video.play();
        playIcon.querySelector('i').className = 'fas fa-play';
        playIcon.style.opacity = '1';
        setTimeout(() => playIcon.style.opacity = '0', 500);
      } else {
        video.pause();
        playIcon.querySelector('i').className = 'fas fa-pause';
        playIcon.style.opacity = '1';
        setTimeout(() => playIcon.style.opacity = '0', 500);
      }
    });

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        video.play().catch(() => {});
        const reelId = slide.querySelector('.reel-like')?.dataset.id;
        const viewerKey = getCurrentUser()?.id || getDeviceId();
        const viewKey = `wb_reel_viewed:${viewerKey}:${reelId}`;
        if (reelId && !localStorage.getItem(viewKey)) {
          slide.dataset.viewed = '1';
          localStorage.setItem(viewKey, '1');
          const reel = _state.reels[Number(slide.dataset.index)];
          if (reel) reel.views = Number(reel.views || 0) + 1;
          const counter = slide.querySelector('.fa-eye')?.parentElement;
          if (counter && reel) counter.innerHTML = `<i class="fas fa-eye"></i> ${compact(reel.views)}`;
          fetch(`/api/reels?action=view&id=${reelId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId: getDeviceId(), viewerKey })
          }).catch(() => {});
        }
      } else {
        video.pause();
      }
    }, { threshold: 0.6 });
    io.observe(slide);
  });

  wrap.querySelectorAll('.reel-like').forEach(btn => btn.onclick = (e) => {
    e.stopPropagation();
    if (e.detail > 1) return;
    toggleLike(btn);
  });
  wrap.querySelectorAll('.reel-profile').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); navigate(`/profile/${btn.dataset.username}`); });
  wrap.querySelectorAll('.reel-delete').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); deleteReel(btn.dataset.id); });
  wrap.querySelectorAll('.reel-desc').forEach(p => p.addEventListener('click', e => {
    const button = e.target.closest('.reel-more');
    if (!button) return;
    e.stopPropagation();
    const expanded = button.getAttribute('aria-expanded') === 'true';
    const text = expanded ? p.dataset.short : p.dataset.full;
    const moreButton = expanded ? 'more' : 'less';
    p.innerHTML = `${escapeHtml(text)} <button type="button" class="reel-more" aria-expanded="${!expanded}" style="font-weight:600;background:none;border:0;padding:0;color:inherit;cursor:pointer;">${moreButton}</button>`;
  }));
  wrap.querySelectorAll('button').forEach(button => {
    ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(type => {
      button.addEventListener(type, event => event.stopPropagation(), { passive: true });
    });
  });
}

function setupSwipe() {
  const wrap = document.getElementById('reelSlide');
  wrap.addEventListener('touchstart', (e) => {
    _state.touchStartY = e.touches[0].clientY;
    _state.touchEndY = e.touches[0].clientY;
  }, { passive: true });
  wrap.addEventListener('touchmove', (e) => {
    if (_state.touchStartY !== null) _state.touchEndY = e.touches[0].clientY;
  }, { passive: true });
  const finishTouch = () => {
    const startY = _state.touchStartY;
    const endY = _state.touchEndY;
    _state.touchStartY = null;
    _state.touchEndY = null;
    if (startY === null || endY === null) return;
    const dy = startY - endY;
    if (Math.abs(dy) > 50) dy > 0 ? nextReel() : prevReel();
  };
  wrap.addEventListener('touchend', finishTouch);
  wrap.addEventListener('touchcancel', () => {
    _state.touchStartY = null;
    _state.touchEndY = null;
  });
}

function nextReel() {
  if (_state.index < _state.reels.length - 1) {
    _state.index++;
    updatePositions();
  }
}
function prevReel() {
  if (_state.index > 0) {
    _state.index--;
    updatePositions();
  }
}
function updatePositions() {
  document.querySelectorAll('.reel-slide').forEach(s => {
    s.style.transform = `translateY(${(Number(s.dataset.index) - _state.index) * 100}%)`;
  });
  document.querySelectorAll('.reel-slide video').forEach(v => v.pause());
  const cur = document.querySelector(`.reel-slide[data-index="${_state.index}"] video`);
  cur?.play().catch(() => {});
}

async function toggleLike(btn) {
  const id = btn.dataset.id;
  const index = Number(btn.dataset.index);
  const user = getCurrentUser();
  if (!user?.id) return showToast('Please log in to react to reels');
  const requestKey = `${id}:${user.id}`;
  if (pendingReactions.has(requestKey)) return;
  const reel = _state.reels[index];
  if (!reel) return;
  pendingReactions.add(requestKey);
  btn.disabled = true;
  const action = (reel.likes || []).includes(user.id) ? 'unlike' : 'like';

  try {
    const res = await fetch(`/api/reels?action=like&id=${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: getDeviceId(), action })
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'Error');

    if (action === 'like') {
      if (!(reel.likes || []).includes(user.id)) reel.likes = [...(reel.likes || []), user.id];
    } else {
      reel.likes = (reel.likes || []).filter(x => x !== user.id);
    }
    showToast(action === 'like' ? 'Liked' : 'Unliked');
    renderSlide();
  } catch {
    showToast('Could not update reaction. Please try again.');
  } finally {
    pendingReactions.delete(requestKey);
    btn.disabled = false;
  }
}


async function deleteReel(id) {
  const ok = await showConfirm('Delete this reel permanently?', 'Delete Reel');
  if (!ok) return;
  const email = getCurrentUser()?.email;
  const identity = `deviceId=${encodeURIComponent(getDeviceId())}${email ? `&email=${encodeURIComponent(email)}` : ''}`;
  const res = await fetch(`/api/reels?action=single&id=${id}&${identity}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) return showToast(data.error || 'Error');
  showToast('Reel deleted');
  _state.reels = _state.reels.filter(r => r.id !== id);
  if (_state.index >= _state.reels.length) _state.index = Math.max(0, _state.reels.length - 1);
  renderSlide();
}

function getReelPoster(url) {
  return String(url || '').replace('/video/upload/', '/video/upload/so_0,f_jpg/').replace(/\.(?:mp4|mov|webm)(\?.*)?$/i, '.jpg$1');
}

function escapeHtml(s) { return (s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function escapeAttr(s) { return escapeHtml(s); }
