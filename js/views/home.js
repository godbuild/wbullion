import { navigate } from '../router.js';
import { getCurrentUser, setCurrentUser, getDeviceId } from '../auth.js';
import { showAlert, showToast } from '../modal.js';
import { money, compact } from '../format.js';
import { apiFetch } from '../lib/api.js';

let _pullActive = false;

export function renderHome() {
  const user = getCurrentUser();
  const el = document.getElementById('viewContainer');

  const todayStr = new Date().toISOString().slice(0, 10);
  const claimedToday = user?.last_claim_date === todayStr;
  const bonusAmount = user?.streak_day ? 150 + ((user.streak_day || 0)) * 50 : 150;

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h2 id="helloBtn" style="font-size:20px;font-weight:bold;cursor:pointer;">
        Hello, ${(user?.full_name || 'User').split(' ')[0]}
      </h2>
      <button id="balanceBtn" style="background:linear-gradient(135deg,#1f2937,#374151);color:white;padding:8px 16px;border-radius:20px;font-weight:bold;font-size:14px;cursor:pointer;border:none;">
        ${money(user?.balance || 0)}
      </button>
    </div>

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
      <div id="goGames" style="background:#dbfedc;color:#1f2937;padding:20px;border-radius:16px;cursor:pointer;">
        <div style="font-size:32px;margin-bottom:8px;"><i class="fas fa-gamepad"></i></div>
        <p style="font-weight:600;">Play Games</p>
        <p style="font-size:12px;color:#6b8070;">Earn NGN per win</p>
      </div>
      <div id="goReels" style="background:#d8cfff;color:#1f2937;padding:20px;border-radius:16px;cursor:pointer;">
        <div style="font-size:32px;margin-bottom:8px;"><i class="fas fa-video"></i></div>
        <p style="font-weight:600;">Watch Reels</p>
        <p style="font-size:12px;color:#6b8070;">Watch Videos Here</p>
      </div>
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
      <p style="font-size:16px;color:var(--text-secondary);">No Suggested People To Follow for now.</p>
    </div>

    <div style="margin-top:26px;">
      <p style="font-weight:600;margin-bottom:12px;"><u>Tasks</u></p>
      <p style="font-size:16px;color:var(--text-secondary);">No Tasks to show for now</p>
    </div>

    <div id="pullIndicator" style="display:none;text-align:center;padding:20px;">
      <i class="fas fa-spinner fa-spin" style="font-size:22px;color:var(--green);"></i>
      <p style="font-size:13px;color:var(--text-secondary);margin-top:8px;">Refreshing...</p>
    </div>
  `;

  document.getElementById('helloBtn').addEventListener('click', () => navigate('/home/streak'));
  document.getElementById('balanceBtn').addEventListener('click', () => navigate('/home/balance'));
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
  let startY = 0;
  el.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    // Check container scrollTop rather than window.scrollY so we allow inner scrolling
    if (el.scrollTop > 0) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 80 && !_pullActive) {
      _pullActive = true;
      const ind = document.getElementById('pullIndicator');
      if (ind) ind.style.display = 'block';
      setTimeout(() => { _pullActive = false; renderHome(); }, 1200);
    }
  }, { passive: true });
}
