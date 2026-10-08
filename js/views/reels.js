import { navigate } from '../router.js';
import { getCurrentUser, getDeviceId } from '../auth.js';
import { showToast, showConfirm } from '../modal.js';
import { compact } from '../format.js';

let _state = {
  reels: [],
  index: 0,
  muted: false,
  touchStartY: 0,
  touchEndY: 0
};

// Force dark theme on reels
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
        <button id="reelsClose" style="background:rgba(0,0,0,0.4);border:none;color:white;width:40px;height:40px;border-radius:50%;font-size:18px;cursor:pointer;">
          <i class="fas fa-close"></i>
        </button>
        <div style="display:flex;gap:8px;">
          <button id="reelsSearchBtn" style="background:rgba(0,0,0,0.4);border:none;color:white;width:40px;height:40px;border-radius:50%;font-size:16px;cursor:pointer;">
            <i class="fas fa-search"></i>
          </button>
        </div>
      </div>

      <div id="searchBar" style="display:none;position:absolute;top:64px;left:16px;right:16px;z-index:55;padding-top:env(safe-area-inset-top);">
        <input id="reelSearchInput" placeholder="Search captions or descriptions..." style="width:100%;padding:12px 16px;border-radius:12px;border:none;background:rgba(0,0,0,0.75);color:white;font-size:15px;outline:none;">
      </div>

      <div id="reelSlide" style="flex:1;position:relative;overflow:hidden;"></div>

      <button id="createReelBtn" style="position:absolute;bottom:calc(24px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);background:white;color:#2c0941;border:none;width:52px;height:52px;border-radius:16px;font-size:22px;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,0.5);z-index:55;">
        <i class="fas fa-plus"></i>
      </button>
    </div>
  `;

  document.getElementById('reelsClose').onclick = () => navigate('/home');
  document.getElementById('createReelBtn').onclick = () => navigate('/reels/new/create');

  document.getElementById('reelsSearchBtn').onclick = () => {
    const bar = document.getElementById('searchBar');
    bar.style.display = bar.style.display === 'none' ? 'block' : 'none';
    if (bar.style.display === 'block') document.getElementById('reelSearchInput').focus();
  };

  let searchTimer;
  document.getElementById('reelSearchInput').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadReels(e.target.value), 400);
  });

  setupSwipe();

  await loadReels();
}

async function loadReels(q = '') {
  const deviceId = getDeviceId();
  try {
    const res = await fetch(`/api/reels/list?deviceId=${encodeURIComponent(deviceId)}&q=${encodeURIComponent(q)}`);
    const data = await res.json();
    _state.reels = data.reels || [];
    _state.index = 0;
    renderSlide();
  } catch (err) {
    document.getElementById('reelSlide').innerHTML = `<div style="color:#888;text-align:center;padding-top:60px;">Failed to load reels</div>`;
  }
}

function renderSlide() {
  const wrap = document.getElementById('reelSlide');
  if (_state.reels.length === 0) {
    wrap.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#888;font-size:16px;">No Matching Results</div>`;
    return;
  }

  wrap.innerHTML = _state.reels.map((r, i) => {
    const user = getCurrentUser();
    const liked = (r.likes || []).includes(user?.id);
    const disliked = (r.dislikes || []).includes(user?.id);
    const isOwner = r.user_id === user?.id;
    const desc = r.description || '';
    const descShort = desc.length > 90 ? desc.slice(0, 90) + '…' : desc;

    return `
      <div class="reel-slide" data-index="${i}" style="position:absolute;inset:0;transform:translateY(${(i - _state.index) * 100}%);transition:transform 0.3s ease;background:#000;">
        <video src="${r.cloudinary_secure_url}" playsinline loop preload="metadata" style="width:100%;height:100%;object-fit:contain;background:#000;"></video>
        <div class="reel-play-icon" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0;transition:opacity 0.15s;">
          <i class="fas fa-play" style="font-size:60px;color:rgba(255,255,255,0.85);"></i>
        </div>

        <!-- Right-side actions -->
        <div style="position:absolute;right:12px;bottom:120px;display:flex;flex-direction:column;gap:18px;align-items:center;z-index:5;">
          <button class="reel-profile" data-username="${r.username}" style="background:none;border:none;color:white;cursor:pointer;text-align:center;">
            <div style="width:46px;height:46px;border-radius:50%;background:#dbfedd;color:#1f2937;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:20px;border:2px solid white;">
              ${(r.username || 'U')[1]?.toUpperCase() || 'U'}
            </div>
          </button>
          <button class="reel-like ${liked ? 'liked' : ''}" data-id="${r.id}" data-index="${i}" style="background:none;border:none;color:${liked ? '#3ba072' : 'white'};cursor:pointer;font-size:26px;display:flex;flex-direction:column;align-items:center;gap:2px;">
            <i class="fas fa-thumbs-up"></i>
            <span style="font-size:12px;">${compact((r.likes || []).length)}</span>
          </button>
          <button class="reel-dislike" data-id="${r.id}" data-index="${i}" style="background:none;border:none;color:${disliked ? '#ef4444' : 'white'};cursor:pointer;font-size:26px;">
            <i class="fas fa-thumbs-down"></i>
          </button>
          ${isOwner ? `<button class="reel-delete" data-id="${r.id}" style="background:none;border:none;color:white;cursor:pointer;font-size:22px;"><i class="fas fa-trash"></i></button>` : ''}
        </div>

        <!-- Bottom info -->
        <div style="position:absolute;left:12px;right:80px;bottom:100px;color:white;z-index:5;">
          <p style="font-weight:700;font-size:15px;">${r.username}</p>
          ${r.caption ? `<p style="font-weight:600;font-size:14px;margin-top:4px;">${escapeHtml(r.caption)}</p>` : ''}
          ${desc ? `<p style="font-size:13px;opacity:0.9;margin-top:4px;" class="reel-desc" data-full="${escapeAttr(desc)}" data-short="${escapeAttr(descShort)}">${escapeHtml(descShort)}${desc.length > 90 ? ' <span style="font-weight:600;cursor:pointer;" class="reel-more">more</span>' : ''}</p>` : ''}
        </div>

        <div style="position:absolute;right:12px;top:64px;color:white;font-size:12px;opacity:0.85;z-index:5;">
          <i class="fas fa-eye"></i> ${compact(r.views || 0)}
        </div>
      </div>
    `;
  }).join('');

  // Attach handlers
  wrap.querySelectorAll('.reel-slide').forEach(slide => {
    const video = slide.querySelector('video');
    const playIcon = slide.querySelector('.reel-play-icon');

    // Tap to play/pause
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

    // Autoplay when in view
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        video.play().catch(() => {});
        // Increment view once per session
        if (!slide.dataset.viewed) {
          slide.dataset.viewed = '1';
          const reelId = slide.querySelector('.reel-like')?.dataset.id;
          if (reelId) {
            fetch(`/api/reels/${reelId}/view`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {});
          }
        }
      } else {
        video.pause();
      }
    }, { threshold: 0.6 });
    io.observe(slide);
  });

  // Like/dislike/profile/delete
  wrap.querySelectorAll('.reel-like').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); toggleLike(btn); });
  wrap.querySelectorAll('.reel-dislike').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); toggleDislike(btn); });
  wrap.querySelectorAll('.reel-profile').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); navigate(`/profile/${btn.dataset.username}`); });
  wrap.querySelectorAll('.reel-delete').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); deleteReel(btn.dataset.id); });
  wrap.querySelectorAll('.reel-more').forEach(el => el.onclick = (e) => {
    e.stopPropagation();
    const p = el.closest('.reel-desc');
    const isShort = p.textContent.includes('more');
    if (isShort) {
      p.textContent = p.dataset.full;
    } else {
      p.textContent = p.dataset.short + ' ';
      const more = document.createElement('span');
      more.textContent = 'more';
      more.style.cssText = 'font-weight:600;cursor:pointer;';
      more.className = 'reel-more';
      more.onclick = (ev) => { ev.stopPropagation(); p.textContent = p.dataset.full; };
      p.appendChild(more);
    }
  });
}

function setupSwipe() {
  const wrap = document.getElementById('reelSlide');
  wrap.addEventListener('touchstart', (e) => { _state.touchStartY = e.touches[0].clientY; }, { passive: true });
  wrap.addEventListener('touchmove', (e) => { _state.touchEndY = e.touches[0].clientY; }, { passive: true });
  wrap.addEventListener('touchend', () => {
    const dy = _state.touchStartY - _state.touchEndY;
    if (Math.abs(dy) > 50) {
      if (dy > 0) nextReel();
      else prevReel();
    }
  });
  wrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY > 0) nextReel();
    else prevReel();
  }, { passive: false });
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
  // Pause all and play current
  document.querySelectorAll('.reel-slide video').forEach(v => v.pause());
  const cur = document.querySelector(`.reel-slide[data-index="${_state.index}"] video`);
  cur?.play().catch(() => {});
}

async function toggleLike(btn) {
  const id = btn.dataset.id;
  const index = Number(btn.dataset.index);
  const user = getCurrentUser();
  const reel = _state.reels[index];
  const wasLiked = (reel.likes || []).includes(user.id);

  const action = wasLiked ? 'unlike' : 'like';
  const res = await fetch(`/api/reels/${id}/like`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: getDeviceId(), action })
  });
  const data = await res.json();
  if (!res.ok) return showToast(data.error || 'Error');

  // Update state
  if (action === 'like') {
    reel.likes = [...(reel.likes || []), user.id];
    reel.dislikes = (reel.dislikes || []).filter(x => x !== user.id);
  } else {
    reel.likes = (reel.likes || []).filter(x => x !== user.id);
  }
  showToast(action === 'like' ? 'Liked' : 'Unliked');
  renderSlide();
}

async function toggleDislike(btn) {
  const id = btn.dataset.id;
  const index = Number(btn.dataset.index);
  const user = getCurrentUser();
  const reel = _state.reels[index];
  const wasDisliked = (reel.dislikes || []).includes(user.id);

  if (wasDisliked) return showToast('Already disliked');

  const res = await fetch(`/api/reels/${id}/like`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: getDeviceId(), action: 'dislike' })
  });
  const data = await res.json();
  if (!res.ok) return showToast(data.error || 'Error');

  reel.dislikes = [...(reel.dislikes || []), user.id];
  reel.likes = (reel.likes || []).filter(x => x !== user.id);
  showToast('Disliked');
  renderSlide();
}

async function deleteReel(id) {
  const ok = await showConfirm('Delete this reel permanently?', 'Delete Reel');
  if (!ok) return;
  const res = await fetch(`/api/reels/${id}?deviceId=${encodeURIComponent(getDeviceId())}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) return showToast(data.error || 'Error');
  showToast('Reel deleted');
  _state.reels = _state.reels.filter(r => r.id !== id);
  if (_state.index >= _state.reels.length) _state.index = Math.max(0, _state.reels.length - 1);
  renderSlide();
}

function escapeHtml(s) { return (s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function escapeAttr(s) { return escapeHtml(s); }
