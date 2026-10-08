import { getSupabase } from './supabase.js';
import { getCurrentUser, setCurrentUser, getDeviceId } from './auth.js';
import { showToast } from './modal.js';

let _client = null;
let _channels = [];

export async function initRealtime() {
  if (_client) return;
  _client = await getSupabase();
  if (!_client) return;

  const user = getCurrentUser();
  if (!user) return;

  // Balance changes
  const balanceChannel = _client
    .channel('balance:' + user.id)
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${user.id}` },
      (payload) => {
        const oldBal = Number(user.balance || 0);
        const newBal = Number(payload.new.balance || 0);
        if (oldBal !== newBal && newBal > oldBal) {
          showToast(`+NGN ${(newBal - oldBal).toLocaleString()}`, 2000);
        }
        setCurrentUser({ ...user, ...payload.new });
      }
    )
    .subscribe();
  _channels.push(balanceChannel);

  // Notifications
  const notifChannel = _client
    .channel('notifications:' + user.id)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
      (payload) => {
        const n = payload.new;
        showToast(`${n.title || 'Notification'}${n.body ? ' — ' + n.body.slice(0, 60) : ''}`, 3500);
        // Pulse bell icon
        document.querySelectorAll('.notifDot').forEach(el => el.style.display = 'block');
      }
    )
    .subscribe();
  _channels.push(notifChannel);
}

export function stopRealtime() {
  for (const ch of _channels) {
    try { ch.unsubscribe(); } catch {}
  }
  _channels = [];
}
