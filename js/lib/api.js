import { logout, getDeviceId, getCurrentUser } from '../auth.js';
import { showAlert } from '../modal.js';
import { navigate } from '../router.js';

export async function apiFetch(url, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});

  // Send both identifiers so requests remain valid after a browser clears or changes its device id.
  const currentUser = getCurrentUser();
  if (currentUser?.email && method !== 'GET' && opts.body) {
    try {
      const body = JSON.parse(opts.body);
      if (!body.email) { body.email = currentUser.email; opts.body = JSON.stringify(body); }
    } catch {}
  }

  // Add deviceId to GET URLs if not present
  if (method === 'GET' && !/deviceId=/.test(url)) {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}deviceId=${encodeURIComponent(getDeviceId())}`;
  }

  const res = await fetch(url, opts);

  if (res.status === 401) {
    try { await logout(); } catch (e) {}
    try { showAlert('Session expired. Please log in again.', 'Authentication'); } catch (e) {}
    try { navigate('/login', { replace: true }); } catch (e) {}
    throw new Error('Not authenticated');
  }

  let data = {};
  try { data = await res.json(); } catch (e) { /* ignore */ }

  if (!res.ok) {
    const err = data?.error || `Request failed (${res.status})`;
    throw new Error(err);
  }

  return data;
}
