import { navigate, getCurrentPath } from '../router.js';
import { getCurrentUser, setCurrentUser, getDeviceId } from '../auth.js';
import { showAlert, showToast } from '../modal.js';
import { money, compact } from '../format.js';
import { apiFetch } from '../lib/api.js';

let _pullActive = false;
let _homeRequest = 0;

export function renderHome() {
  const user = getCurrentUser();
  const el = document.getElementById('viewContainer');

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const claimedToday = user?.last_claim_date === todayStr;
  const bonusAmount = user?.streak_day ? 150 + ((user.streak_day || 0)) * 50 : 150;
  const balanceText = money(user?.balance || 0);

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h2 id="helloBtn" style="font-size:20px;font-weight:bold;cursor:pointer;">
        Hello, ${(user?.full_name || 'User').split(' ')[0]}
      </h2>
      <button id="searchPeopleBtn" aria-label="Search people" style="width:38px;height:38px;border-radius:50%;border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-primary);cursor:pointer;font-size:16px;">
        <i class="fas fa-search"></i>
      </button>
    </div>

    <section class="home-balance-card" aria-labelledby="homeBalanceLabel">
      <div>
        <p id="homeBalanceLabel" class="home-balance-label">Available balance</p>
        <p id="homeBalanceValue" class="home-balance-value">${balanceText}</p>
      </div>
      <div class="home-balance-actions">
        <button id="toggleBalanceBtn" type="button" aria-label="Hide balance" aria-pressed="false"><i class="fas fa-eye"></i></button>
        <button id="balanceBtn" type="button" aria-label="View balance history"><i class="fas fa-clock-rotate-left" aria-hidden="true"></i></button>
      </div>
    </section>

    ${!claimedToday ? `
      <div style="background:linear-gradient(177deg,#000,#3ba072);padding:20px;border-radius:16px;color:white;margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <p style="font-size:16px;font-weight:bold;">Daily Bonus Available!</p>
            <p style="font-size:32px;font-weight:bold;">${money(bonusAmount)}</p>
          </div>
          <button id="claimBonusBtn" style="background:white;color:#3ba072;padding:12px 24px;border-radius:12px;font-weight:bold;border:none;cursor:pointer;">Claim</button>
        </div>
      </div>
    ` : ''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
      <button id="goGames" type="button" style="background:linear-gradient(145deg,#f8fafc,#cbd5e1);color:#1f2937;padding:20px;border-radius:16px;cursor:pointer;border:1px solid #94a3b8;box-shadow:0 8px 24px rgba(15,23,42,.12);text-align:left;">
        <span style="display:block;font-size:32px;margin-bottom:8px;"><i class="fas fa-gamepad"></i></span>
        <span style="display:block;font-weight:600;">Play Games</span>
        <span style="display:block;font-size:12px;color:#475569;margin-top:4px;">Earn NGN per win</span>
      </button>
      <button id="goReels" type="button" style="background:linear-gradient(145deg,#f8fafc,#cbd5e1);color:#1f2937;padding:20px;border-radius:16px;cursor:pointer;border:1px solid #94a3b8;box-shadow:0 8px 24px rgba(15,23,42,.12);text-align:left;">
        <span style="display:block;font-size:32px;margin-bottom:8px;"><i class="fas fa-video"></i></span>
        <span style="display:block;font-weight:600;">Watch Reels</span>
        <span style="display:block;font-size:12px;color:#475569;margin-top:4px;">Watch Videos Here</span>
      </button>
    </div>

    <button id="tgBtn" style="width:100%;color:white;padding:16px;border-radius:16px;font-weight:600;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:12px;background:${user?.telegram_bonus_claimed ? '#6b8070' : 'linear-gradient(135deg,#0088cc,#006699)'};" ${user?.telegram_bonus_claimed ? 'disabled' : ''}>
      <i class="fab fa-telegram-plane" style="font-size:24px;"></i>
      <span>${user?.telegram_bonus_claimed ? '✓ Telegram Bonus Claimed' : 'Follow and Claim NGN 200'}</span>
    </button>

    <div class="wb-card" style="margin-top:20px;">
      <h3 style="font-size:18px;">Your Referral Link!</h3>
      <p style="font-size:12px;color:var(--text-secondary);margin-top:4px;">Earn NGN 500 when someone signs up with your code! Tap to copy and share.</p>
      <div id="refLink" style="margin-top:10px;font-weight:bold;color:var(--purple-light);cursor:pointer;font-size:14px;word-break:break-all;">
        ${window.location.origin}/ref/${user?.unique_id || 'N/A'}
      </div>
    </div>

    <div class="wb-card" style="margin-top:16px;">
      <p style="font-weight:600;margin-bottom:12px;">Suggested People To Follow</p>
      <div id="suggestedPeople"><p style="font-size:14px;color:var(--text-secondary);">Loading suggestions...</p></div>
    </div>

    <div style="margin-top:26px;">
      <p style="font-weight:600;margin-bottom:12px;"><u>Tasks</u></p>
      <div id="homeTasks"><p style="font-size:14px;color:var(--text-secondary);">Loading tasks...</p></div>
    </div>

    <div id="pullIndicator" style="display:none;text-align:center;padding:20px;">
      <i class="fas fa-spinner fa-spin" style="font-size:22px;color:var(--green);"></i>
      <p style="font-size:13px;color:var(--text-secondary);margin-top:8px;">Refreshing...</p>
    </div>
  `;

  document.getElementById('helloBtn').addEventListener('click', () => navigate('/home/streak'));
  document.getElementById('balanceBtn').addEventListener('click', () => navigate('/home/balance'));
  document.getElementById('toggleBalanceBtn').addEventListener('click', (event) => {
    const hidden = event.currentTarget.getAttribute('aria-pressed') === 'true';
    event.currentTarget.setAttribute('aria-pressed', String(!hidden));
    event.currentTarget.setAttribute('aria-label', hidden ? 'Hide balance' : 'Reveal balance');
    event.currentTarget.innerHTML = `<i class="fas fa-eye${hidden ? '' : '-slash'}"></i>`;
    document.getElementById('homeBalanceValue').textContent = hidden ? balanceText : '••••••';
  });
  document.getElementById('searchPeopleBtn').addEventListener('click', () => navigate('/search'));
  document.getElementById('goGames').addEventListener('click', () => navigate('/games'));
  document.getElementById('goReels').addEventListener('click', () => navigate('/reels'));

  document.getElementById('claimBonusBtn')?.addEventListener('click', handleClaimBonus);
  document.getElementById('tgBtn')?.addEventListener('click', handleTelegramBonus);

  document.getElementById('refLink')?.addEventListener('click', async () => {
    const link = document.getElementById('refLink').textContent.trim();
    try {
      await navigator.clipboard.writeText(link);
      showToast('Copied');
      if (navigator.share) {
        try { await navigator.share({ title: 'W Bullion', text: 'Join W Bullion', url: link }); } catch {}
      }
    } catch { showToast('Copy failed'); }
  });

  setupPullToRefresh();
  loadHomeSections();
}

async function loadHomeSections() {
  const requestId = ++_homeRequest;
  const deviceId = getDeviceId();
  try {
    const [suggestions, tasks] = await Promise.all([
      apiFetch('/api/users?action=sptf'),
      apiFetch('/api/tasks?action=list')
    ]);
    if (requestId !== _homeRequest) return;
    const people = suggestions.users || [];
    const peopleEl = document.getElementById('suggestedPeople');
    if (peopleEl) peopleEl.innerHTML = people.length ? people.slice(0, 4).map(person => `
      <button class="wb-card suggested-person" data-username="${person.username}" style="width:100%;display:flex;align-items:center;gap:10px;padding:10px;margin-bottom:8px;background:var(--bg-primary);border:1px solid var(--border-color);cursor:pointer;text-align:left;">
        <span style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#dbfedd;font-weight:700;color:#1f2937;">${(person.username || 'U')[1]?.toUpperCase() || 'U'}</span>
        <span><strong style="color:var(--text-primary);">${person.full_name || person.username}</strong><small style="display:block;color:var(--text-secondary);">${person.username}${person.badge_awarded ? ' ✓' : ''}</small></span>
      </button>`).join('') : '<p style="font-size:14px;color:var(--text-secondary);">No Suggested People To Follow for now.</p>';
    document.querySelectorAll('.suggested-person').forEach(btn => btn.onclick = () => navigate(`/profile/${encodeURIComponent(btn.dataset.username)}`));

    const taskEl = document.getElementById('homeTasks');
    const available = tasks.tasks || [];
    if (taskEl) taskEl.innerHTML = available.length ? available.slice(0, 3).map(task => `
      <button class="wb-card home-task" data-task-id="${task.id}" style="display:block;width:100%;padding:12px;margin-bottom:8px;background:var(--bg-primary);border:1px solid var(--border-color);cursor:pointer;text-align:left;">
        <strong>${task.title}</strong><small style="display:block;color:var(--text-secondary);margin-top:4px;">Earn ${money(task.reward_click || 150)}</small>
      </button>`).join('') : '<p style="font-size:14px;color:var(--text-secondary);">No Tasks to show for now.</p>';
    document.querySelectorAll('.home-task').forEach(btn => btn.onclick = () => navigate('/home/tasks'));
  } catch (err) {
    const peopleEl = document.getElementById('suggestedPeople');
    const taskEl = document.getElementById('homeTasks');
    if (peopleEl) peopleEl.innerHTML = '<p style="font-size:14px;color:var(--text-secondary);">Suggestions unavailable right now.</p>';
    if (taskEl) taskEl.innerHTML = '<p style="font-size:14px;color:var(--text-secondary);">Tasks unavailable right now.</p>';
  }
}

async function handleClaimBonus() {
  const deviceId = getDeviceId();
  try {
    const data = await apiFetch(`/api/bonus?action=daily`, {
      method: 'POST',
      body: JSON.stringify({ deviceId })
    });
    setCurrentUser(data.user);
    showToast(`+${money(data.reward)} (Day ${data.streakDay})`);
    renderHome();
  } catch (err) { showAlert(err.message, 'Error'); }
}

async function handleTelegramBonus() {
  const deviceId = getDeviceId();
  try {
    const data = await apiFetch(`/api/bonus?action=telegram`, {
      method: 'POST',
      body: JSON.stringify({ deviceId })
    });
    window.open(data.link, '_blank');
    if (data.user) setCurrentUser(data.user);
    showToast(`+${money(data.reward)}`);
    renderHome();
  } catch (err) { showAlert(err.message, 'Error'); }
}

function setupPullToRefresh() {
  const el = document.getElementById('viewContainer');
  if (!el) return;

  // viewContainer is reused between routes, so remove the previous home-only
  // listeners before attaching new ones after a refresh.
  el.ontouchstart = (e) => {
    if (getCurrentPath() !== '/home') return;
    el.dataset.pullStartY = String(e.touches[0].clientY);
  };
  el.ontouchmove = (e) => {
    if (getCurrentPath() !== '/home' || window.scrollY > 0 || el.scrollTop > 0) return;
    const startY = Number(el.dataset.pullStartY);
    const dy = e.touches[0].clientY - startY;
    if (dy > 70 && !_pullActive) {
      _pullActive = true;
      const ind = document.getElementById('pullIndicator');
      if (ind) ind.style.display = 'block';
      setTimeout(() => {
        _pullActive = false;
        if (getCurrentPath() === '/home') {
          renderHome();
          window.scrollTo(0, 0);
        }
      }, 700);
    }
  };
}
