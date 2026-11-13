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
  profileSearchResults: [],
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

      <section id="reelSearchResults" aria-label="Reel search results" hidden style="position:absolute;inset:0;z-index:45;overflow-y:auto;background:#080808;padding:calc(78px + env(safe-area-inset-top)) 10px calc(20px + env(safe-area-inset-bottom));">
        <p id="reelSearchResultSummary" role="status" style="margin:0 4px 12px;color:#ccc;font-size:13px;"></p>
        <div id="reelSearchGrid" style="display:flex;flex-direction:column;gap:12px;"></div>
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
  const identity = new URLSearchParams({ deviceId });
  if (email) identity.set('email', email);
  try {
    const [reelsResponse, profilesResponse] = await Promise.all([
      fetch(`/api/reels?action=list&${identity}&q=${encodeURIComponent(query)}`),
      fetch(`/api/users?action=search&includeReels=1&${identity}&q=${encodeURIComponent(query)}`)
    ]);
    const [reelsData, profilesData] = await Promise.all([reelsResponse.json(), profilesResponse.json()]);
    if (requestId !== _state.searchRequestId) return;
    if (!reelsResponse.ok) throw new Error(reelsData.error || 'Reel search failed');
    if (!profilesResponse.ok) throw new Error(profilesData.error || 'Profile search failed');
    _state.searchResults = reelsData.reels || [];
    _state.profileSearchResults = profilesData.results || [];
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
  const profiles = _state.profileSearchResults;
  const matchingReels = _state.searchResults;
  const hasResults = profiles.length > 0 || matchingReels.length > 0;
  summary.style.color = '#ccc';
  summary.textContent = hasResults
    ? `${profiles.length} profile${profiles.length === 1 ? '' : 's'} · ${matchingReels.length} matching reel${matchingReels.length === 1 ? '' : 's'}`
    : `No profiles or reels found for “${_state.searchTerm}”. Try a name, username, caption, or description.`;

  const profileCards = profiles.map((profile, profileIndex) => {
    const reels = Array.isArray(profile.reels) ? profile.reels : [];
    const username = String(profile.username || '@user');
    const fullName = String(profile.full_name || username);
    const badge = profile.badge_awarded || profile.admin ? '<i class="fas fa-check-circle" aria-label="Verified" style="color:#60a5fa;margin-left:5px;"></i>' : '';
    return `
      <article style="padding:12px;border:1px solid #292929;border-radius:14px;background:#111;">
        <button type="button" class="reel-search-profile" data-profile-index="${profileIndex}" aria-label="Open ${escapeAttr(fullName)} profile" style="display:flex;align-items:center;gap:10px;width:100%;padding:0;border:0;background:none;color:white;text-align:left;cursor:pointer;">
          <span aria-hidden="true" style="width:40px;height:40px;flex:0 0 40px;border-radius:50%;background:linear-gradient(135deg,#dbfedd,#d8cfff);display:flex;align-items:center;justify-content:center;font-weight:700;color:#1f2937;">${escapeHtml(fullName.charAt(0).toUpperCase())}</span>
          <span style="min-width:0;flex:1;">
            <span style="display:block;font-size:14px;font-weight:700;">${escapeHtml(fullName)}${badge}</span>
            <span style="display:block;margin-top:2px;color:#aaa;font-size:12px;">${escapeHtml(username)}${profile.private ? ' · Private' : ''}</span>
          </span>
          <span style="font-size:12px;color:#aaa;">View profile</span>
        </button>
        ${reels.length ? `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin-top:12px;">${reels.map((reel, reelIndex) => `
          <button type="button" class="reel-search-profile-tile" data-profile-index="${profileIndex}" data-reel-index="${reelIndex}" aria-label="Play reel ${reelIndex + 1} from ${escapeAttr(username)}" style="position:relative;aspect-ratio:9/16;overflow:hidden;padding:0;border:0;border-radius:5px;background:#161616;color:white;cursor:pointer;">
            <video src="${escapeAttr(reel.cloudinary_secure_url)}" poster="${escapeAttr(getReelPoster(reel.cloudinary_secure_url))}" muted playsinline preload="none" aria-hidden="true" style="width:100%;height:100%;object-fit:cover;"></video>
            <span style="position:absolute;left:5px;bottom:5px;color:white;font-size:10px;text-shadow:0 1px 3px #000;"><i class="fas fa-play" aria-hidden="true"></i> ${compact(reel.views || 0)}</span>
          </button>
        `).join('')}</div>` : `<p style="margin:12px 0 0;color:#aaa;font-size:13px;">${profile.private ? 'This account is private.' : 'No reels yet.'}</p>`}
      </article>
    `;
  }).join('');

  const reelMatches = matchingReels.length ? `
    <section aria-label="Matching reels">
      <h3 style="margin:0 0 8px;font-size:14px;color:#ddd;">Matching reels</h3>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2px;">
        ${matchingReels.map((reel, index) => `
          <button type="button" class="reel-search-match-tile" data-index="${index}" aria-label="Open reel ${index + 1}${reel.caption ? `: ${escapeAttr(reel.caption)}` : ''}" style="position:relative;aspect-ratio:9/16;overflow:hidden;padding:0;border:0;background:#161616;color:white;cursor:pointer;">
            <video src="${escapeAttr(reel.cloudinary_secure_url)}" poster="${escapeAttr(getReelPoster(reel.cloudinary_secure_url))}" muted playsinline preload="none" aria-hidden="true" style="width:100%;height:100%;object-fit:cover;"></video>
            <span style="position:absolute;left:7px;bottom:7px;display:flex;align-items:center;gap:4px;color:white;font-size:12px;text-shadow:0 1px 3px #000;"><i class="fas fa-play" aria-hidden="true"></i>${compact(reel.views || 0)}</span>
          </button>
        `).join('')}
      </div>
    </section>
  ` : '';

  grid.innerHTML = `${profileCards}${reelMatches}`;
  grid.querySelectorAll('.reel-search-profile').forEach(button => {
    button.addEventListener('click', () => {
      const profile = profiles[Number(button.dataset.profileIndex)];
      if (profile?.username) navigate(`/profile/${encodeURIComponent(profile.username.replace(/^@/, ''))}`);
    });
  });
  grid.querySelectorAll('.reel-search-profile-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      const profile = profiles[Number(tile.dataset.profileIndex)];
      if (profile?.reels?.length) openReelSearchPlaylist(profile.reels, Number(tile.dataset.reelIndex));
    });
  });
  grid.querySelectorAll('.reel-search-match-tile').forEach(tile => {
    tile.addEventListener('click', () => openReelSearchPlaylist(matchingReels, Number(tile.dataset.index)));
  });
}

function openReelSearchPlaylist(reels, index) {
  _state.reels = reels;
  _state.index = index;
  _state.viewingSearchResult = true;
  _state.showingSearchGrid = false;
  document.getElementById('reelSearchResults').hidden = true;
  document.getElementById('reelSlide').style.display = 'block';
  document.getElementById('searchBar').style.display = 'none';
  document.getElementById('backToReelResults').hidden = false;
  renderSlide();
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
  const hadSearchResults = _state.searchResults.length > 0 || _state.profileSearchResults.length > 0;
  _state.searchResults = [];
  _state.profileSearchResults = [];
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
        <div class="reel-speed-indicator" aria-live="polite" style="display:none;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);padding:9px 14px;border-radius:999px;background:rgba(0,0,0,0.65);color:white;font-size:14px;font-weight:700;pointer-events:none;z-index:4;">2× speed</div>

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
    let holdTimer = null;
    let holdStartedAt = 0;
    let holdStartX = 0;
    let holdStartY = 0;
    let holdMoved = false;
    let skipNextSlideClick = false;
    const speedIndicator = slide.querySelector('.reel-speed-indicator');
    const resetHoldSpeed = () => {
      clearTimeout(holdTimer);
      holdTimer = null;
      video.playbackRate = 1;
      speedIndicator.style.display = 'none';
    };
    const cancelHold = () => {
      holdStartedAt = 0;
      holdMoved = false;
      resetHoldSpeed();
    };

    slide.addEventListener('pointerdown', event => {
      if (Number(slide.dataset.index) !== _state.index || event.target.closest('button, a, .reel-more')) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      holdStartedAt = Date.now();
      holdStartX = event.clientX;
      holdStartY = event.clientY;
      holdMoved = false;
      holdTimer = setTimeout(() => {
        if (!holdStartedAt || holdMoved) return;
        video.playbackRate = 2;
        speedIndicator.style.display = 'block';
      }, 160);
    });
    slide.addEventListener('pointermove', event => {
      if (!holdStartedAt || holdMoved) return;
      if (Math.hypot(event.clientX - holdStartX, event.clientY - holdStartY) > 14) {
        holdMoved = true;
        resetHoldSpeed();
      }
    });
    slide.addEventListener('pointerup', () => {
      if (!holdStartedAt) return;
      const heldFor = Date.now() - holdStartedAt;
      const shouldDownload = !holdMoved && heldFor >= 1000;
      holdStartedAt = 0;
      holdMoved = false;
      resetHoldSpeed();
      if (shouldDownload) {
        skipNextSlideClick = true;
        showDownloadConfirmation(_state.reels[Number(slide.dataset.index)]);
      }
    });
    slide.addEventListener('pointercancel', cancelHold);
    slide.addEventListener('pointerleave', cancelHold);

    slide.addEventListener('click', (e) => {
      if (skipNextSlideClick) {
        skipNextSlideClick = false;
        return;
      }
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

async function showDownloadConfirmation(reel) {
  if (!reel?.id) return showToast('This reel cannot be downloaded.');
  const confirmed = await showConfirm(
    'Continue to ask the server to verify access and start the browser download. Your browser or device controls where files are saved; this website cannot inspect or open system storage settings.',
    'Download reel?',
    'Continue'
  );
  if (!confirmed) return;

  const identity = new URLSearchParams({ id: String(reel.id), deviceId: getDeviceId() });
  const email = getCurrentUser()?.email;
  if (email) identity.set('email', email);
  const url = `/api/reels?action=download&${identity}`;
  try {
    const check = await fetch(url, { method: 'HEAD' });
    if (!check.ok) {
      const data = await check.json().catch(() => ({}));
      showToast(data.error || 'Could not verify access to this reel.');
      return;
    }
    const link = document.createElement('a');
    const safeId = String(reel.id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'video';
    link.href = url;
    link.download = `reel-${safeId}.mp4`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch {
    showToast('Could not start the download. Check your browser download settings and try again.');
  }
}

function getReelPoster(url) {
  return String(url || '').replace('/video/upload/', '/video/upload/so_0,f_jpg/').replace(/\.(?:mp4|mov|webm)(\?.*)?$/i, '.jpg$1');
}

function escapeHtml(s) { return (s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function escapeAttr(s) { return escapeHtml(s); }
