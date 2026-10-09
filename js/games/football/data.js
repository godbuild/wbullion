import { getDeviceId, setCurrentUser } from '../../auth.js';

let _config = null;

export async function loadFootballConfig() {
  const r = await fetch(`/api/games?action=football-config&deviceId=${encodeURIComponent(getDeviceId())}`);
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Failed to load config');
  _config = d;
  return d;
}

export async function refreshWallet() {
  const r = await fetch(`/api/users?action=me&deviceId=${encodeURIComponent(getDeviceId())}`);
  const u = await r.json();
  if (u && !u.error) setCurrentUser(u);
  return u.balance || 0;
}

export function getConfig() { return _config; }

export async function submitShot({ takerId, portion, amount, outcome }) {
  const r = await fetch('/api/games?action=football-shot', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: getDeviceId(), takerId, portion, amount, outcome
    })
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Shot submission failed');
  if (d.user) setCurrentUser(d.user);
  return d;
}
