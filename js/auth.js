const KEY = 'wb_currentUser';
const DEVICE_KEY = 'wb_device_id';

let _user = null;

export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { localStorage.setItem(DEVICE_KEY, id); } catch (e) {}
  }
  return id;
}

export function getCurrentUser() { return _user; }

export function setCurrentUser(user) {
  _user = user;
  try {
    if (user) localStorage.setItem(KEY, JSON.stringify(user));
    else localStorage.removeItem(KEY);
  } catch (e) { try { localStorage.setItem(KEY, ''); } catch (e) {} }
}

export async function loadUserFromServer() {
  const deviceId = getDeviceId();
  try {
    const saved = (() => {
      try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
    })();
    const email = saved?.email ? `&email=${encodeURIComponent(saved.email)}` : '';
    const res = await fetch(`/api/users?action=me&deviceId=${encodeURIComponent(deviceId)}${email}`);
    if (!res.ok) return null;
    const user = await res.json();
    setCurrentUser(user);
    return user;
  } catch (err) {
    console.error('[auth] loadUserFromServer error', err);
    return null;
  }
}

export async function refreshUser() {
  return await loadUserFromServer();
}

export async function logout() {
  const deviceId = getDeviceId();
  try {
    await fetch('/api/users?action=logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId })
    });
  } catch {}
  setCurrentUser(null);
  try { localStorage.removeItem(KEY); } catch (e) {}
}

export function isBanned(user) { return user && user.banned === true; }
