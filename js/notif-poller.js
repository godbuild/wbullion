import { getDeviceId, getCurrentUser } from './auth.js';
import { showToast } from './modal.js';

let _intervalId = null;
let _lastCheck = null;

const STORAGE_KEY = 'wb_last_notif_check';

async function pollOnce() {
  const user = getCurrentUser();
  if (!user) return;
  try {
    const res = await fetch(`/api/notifications?action=list&deviceId=${encodeURIComponent(getDeviceId())}`);
    if (!res.ok) return;
    const data = await res.json();
    const list = data.notifications || [];
    const seenIds = new Set(JSON.parse(localStorage.getItem('wb_seen_notifs') || '[]'));

    for (const n of list) {
      if (seenIds.has(n.id)) continue;
      // First-time init: mark existing as seen without toasting
      if (_lastCheck === null) {
        seenIds.add(n.id);
        continue;
      }
      // New notification → toast
      const title = n.title || 'Notification';
      const body = n.body ? ' — ' + n.body.slice(0, 60) : '';
      showToast(`${title}${body}`, 4000);
      seenIds.add(n.id);
    }

    _lastCheck = Date.now();
    localStorage.setItem('wb_seen_notifs', JSON.stringify([...seenIds].slice(-200)));
  } catch {}
}

export function startNotifPolling() {
  if (_intervalId) return;
  // Mark baseline: suppress toasts for whatever exists now
  _lastCheck = null;
  pollOnce().then(() => { _lastCheck = Date.now(); });
  _intervalId = setInterval(pollOnce, 15000);
}

export function stopNotifPolling() {
  if (_intervalId) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
}
