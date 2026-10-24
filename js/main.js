import { getConfig } from './config.js';
import { getSupabase } from './supabase.js';
import { registerRoute, startRouter, navigate, onRouteChange, getCurrentPath } from './router.js';
import { updateNavbar } from './navbar.js';
import { runBoot } from './boot.js';
import { showAlert } from './modal.js';
import { initWWaiter, wwaiterCopy } from './wwaiter.js';
import { initRealtime, stopRealtime } from './realtime.js';
import { loadUserFromServer, getCurrentUser, isBanned } from './auth.js';
import { startNotifPolling, stopNotifPolling } from './notif-poller.js';

import { renderLogin } from './views/login.js';
import { renderSignup } from './views/signup.js';
import { renderTerms } from './views/terms.js';
import { renderActivation, stopActivationPolling } from './views/activation.js';
import { handleReferral } from './views/ref.js';

import { renderHome } from './views/home.js';
import { renderStreak } from './views/streak.js';
import { renderBalance } from './views/balance.js';

import { renderReels } from './views/reels.js';
import { renderReelsCreate } from './views/reels-create.js';
import { renderReelSingle } from './views/reels-single.js';

import { renderProfile } from './views/profile.js';
import { renderNotifications } from './views/notifications.js';
import { renderBadges } from './views/badges.js';
import { renderSPTF } from './views/sptf.js';
import { renderTasks } from './views/tasks.js';
import { renderSettings } from './views/settings.js';
import { renderSearch } from './views/search.js';

import { renderHoep } from './views/hoep.js';
import { renderER } from './views/er.js';
import { renderReferral } from './views/referral.js';
import { renderWithdrawal } from './views/withdrawal.js';
import { renderPermissions } from './views/permissions.js';
import { renderHelp } from './views/help.js';

import { renderGames } from './views/games.js';
import { renderRPS } from './games/rps.js';
import { renderTicTacToe } from './games/tictactoe.js';
import { renderLeveller } from './games/leveller.js';
import { renderBetTTT } from './games/bet-tictactoe.js';
import { renderFootball } from './games/football/index.js';

// ---------- Placeholder for later-phase routes ----------
function stub(name) {
  return () => {
    document.getElementById('viewContainer').innerHTML = `
      <div style="padding:40px 20px;text-align:center;">
        <h2 style="font-size:24px;font-weight:700;">${name}</h2>
        <p style="color:var(--text-secondary);margin-top:8px;">Coming in a later phase.</p>
      </div>`;
  };
}

// ---------- Auth guard ----------
function requireAuth() {
  const user = getCurrentUser();
  if (!user) { navigate('/login', { replace: true }); return false; }
  return true;
}

// ---------- Register routes ----------
registerRoute('/login',      renderLogin);
registerRoute('/signup',     renderSignup);
registerRoute('/terms',      renderTerms);
registerRoute('/activation', renderActivation);
registerRoute('/ref/:code',  ({ code }) => handleReferral(code));

registerRoute('/home', () => { if (requireAuth()) renderHome(); });
registerRoute('/home/streak', () => { if (requireAuth()) renderStreak(); });
registerRoute('/home/balance', () => { if (requireAuth()) renderBalance('all'); });
registerRoute('/home/balance/credits', () => { if (requireAuth()) renderBalance('credit'); });
registerRoute('/home/balance/debits', () => { if (requireAuth()) renderBalance('debit'); });
registerRoute('/home/sptf', () => { if (requireAuth()) renderSPTF(); });
registerRoute('/home/tasks', () => { if (requireAuth()) renderTasks(); });
registerRoute('/reels', () => { if (requireAuth()) renderReels(); });
registerRoute('/reels/new/create', () => { if (requireAuth()) renderReelsCreate(); });
registerRoute('/reels/:id', ({ id }) => { if (requireAuth()) renderReelSingle(id); });
registerRoute('/reels/:id/create', () => { if (requireAuth()) renderReelsCreate(); });
registerRoute('/games', () => { if (requireAuth()) renderGames(); });
registerRoute('/games/rps', () => { if (requireAuth()) renderRPS(); });
registerRoute('/games/tictactoe', () => { if (requireAuth()) renderTicTacToe(); });  
registerRoute('/games/leveller', () => { if (requireAuth()) renderLeveller(); });
registerRoute('/games/bet-tictactoe', () => { if (requireAuth()) renderBetTTT(); });
registerRoute('/games/football', () => { if (requireAuth()) renderFootball(); });
registerRoute('/profile', () => { if (requireAuth()) renderProfile(); });
registerRoute('/search', () => { if (requireAuth()) renderSearch(); });
// Register the static notifications route before the dynamic username route.
registerRoute('/profile/notifications', () => { if (requireAuth()) renderNotifications(); });
registerRoute('/profile/:username', ({ username }) => { if (requireAuth()) renderProfile(username); });
registerRoute('/more', () => { if (requireAuth()) renderSettings(); });
registerRoute('/settings', () => { if (requireAuth()) renderSettings(); });
registerRoute('/hoep', () => { if (requireAuth()) renderHoep(); });
registerRoute('/er', () => { if (requireAuth()) renderER(); });
registerRoute('/withdrawal', () => { if (requireAuth()) renderWithdrawal(); });
registerRoute('/permissions', () => { if (requireAuth()) renderPermissions(); });
registerRoute('/help', () => { if (requireAuth()) renderHelp(); });
registerRoute('/terms', renderTerms); 
registerRoute('/badges', () => { if (requireAuth()) renderBadges(); });
registerRoute('/referral', () => { if (requireAuth()) renderReferral(); });

// ---------- Theme ----------
function applyTheme(theme) {
  localStorage.setItem('wb_theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
}

onRouteChange(() => { updateNavbar(); window.scrollTo(0, 0); });

// ---------- Boot ----------
(async () => {
  const configPromise = getConfig();
  const supabasePromise = getSupabase();

  const { isNigeria, hasDevice, theme } = await runBoot();
  applyTheme(theme);

  if (!isNigeria) {
    document.getElementById('viewContainer').innerHTML =
      '<div style="padding:60px 20px;text-align:center;color:var(--text-secondary);">This site can only be accessed in Nigeria.</div>';
    document.getElementById('viewContainer').classList.remove('hidden');
    return;
  }

  try {
    await configPromise;
    await supabasePromise;
  } catch (err) {
    console.error('[startup] Service initialisation failed:', err);
  }

  document.getElementById('viewContainer').classList.remove('hidden');

  // Try to load existing user by device
  await loadUserFromServer();
  if (getCurrentUser()) startNotifPolling();

  initWWaiter();
if (getCurrentUser()) initRealtime();

// Hook global copy interceptor — every `navigator.clipboard.writeText` goes through W Waiter
const originalClipboardWrite = navigator.clipboard?.writeText?.bind(navigator.clipboard);
if (originalClipboardWrite && isWWaiterSupported()) {
  navigator.clipboard.writeText = async (text) => {
    try { await originalClipboardWrite(text); } catch {}
    wwaiterCopy(text, detectSource(text));
    return Promise.resolve();
  };
}

function isWWaiterSupported() {
  try {
    const perms = JSON.parse(localStorage.getItem('wb_perms') || '{}');
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && perms.background === true;
  } catch {
    return false;
  }
}

function detectSource(text) {
  if (/^(http|www)/i.test(text)) return 'Link';
  if (/^\d{10}$/.test(text)) return 'Account Number';
  if (/^\d+$/.test(text)) return 'Amount';
  return 'Text';
}

  startRouter();

  const path = window.location.pathname;
  if (path === '/' || path === '/index.html') {
    const user = getCurrentUser();
    if (user && isBanned(user)) {
      await showBanScreen(user);
    } else {
      navigate(user ? (user.activated ? '/home' : '/activation') : '/login', { replace: true });
    }
  }
})();

async function showBanScreen(user) {
  document.getElementById('viewContainer').innerHTML = `
    <div style="background:var(--purple);min-height:100dvh;padding:60px 30px;color:white;text-align:center;">
      <i class="fas fa-ban" style="font-size:60px;margin-bottom:20px;color:#ff6b6b;"></i>
      <h2 style="font-size:22px;margin-bottom:16px;">Account Banned</h2>
      <p style="font-size:15px;line-height:1.6;">Your account has been banned from operation due to ${user.ban_reason || 'violation of terms'}.</p>
    </div>`;
  document.getElementById('bottomNav').classList.add('hidden');
}
