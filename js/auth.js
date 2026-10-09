const KEY = 'wb_currentUser';
const DEVICE_KEY = 'wb_device_id';

let _user = null;

export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function getCurrentUser() { return _user; }

export function setCurrentUser(user) {
  _user = user;
  if (user) localStorage.setItem(KEY, user.email);
  else localStorage.removeItem(KEY);
}

export async function loadUserFromServer() {
  const deviceId = getDeviceId();
  try {
    const res = await fetch(`/api/users?action=me&deviceId=${encodeURIComponent(deviceId)}`);
    if (!res.ok) return null;
    const user = await res.json();
    setCurrentUser(user);
    return user;
  } catch { return null; }
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
  localStorage.removeItem(KEY);
}

export function isBanned(user) { return user && user.banned === true; }
