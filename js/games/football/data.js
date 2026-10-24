import { getDeviceId, getCurrentUser, setCurrentUser } from '../../auth.js';
import { apiFetch } from '../../lib/api.js';

let _config = null;

export async function loadFootballConfig() {
  const email = getCurrentUser()?.email;
  const identity = `deviceId=${encodeURIComponent(getDeviceId())}${email ? `&email=${encodeURIComponent(email)}` : ''}`;
  const r = await fetch(`/api/games?action=football-config&${identity}`);
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Failed to load config');
  _config = d;
  return d;
}

export async function refreshWallet() {
  const email = getCurrentUser()?.email;
  const identity = `deviceId=${encodeURIComponent(getDeviceId())}${email ? `&email=${encodeURIComponent(email)}` : ''}`;
  const r = await fetch(`/api/users?action=me&${identity}`);
  const u = await r.json();
  if (u && !u.error) setCurrentUser(u);
  return u.balance || 0;
}

export function getConfig() { return _config; }

export async function submitShot({ takerId, portion, amount, outcome }) {
  const d = await apiFetch('/api/games?action=football-shot', {
    method: 'POST',
    body: JSON.stringify({
      deviceId: getDeviceId(), takerId, portion, amount, outcome
    })
  });
  if (d.user) setCurrentUser(d.user);
  return d;
}
