// Fetches public env vars from the serverless /api/env endpoint.
// Cached in memory so it's only fetched once per session.

let _config = null;

export async function getConfig() {
  if (_config) return _config;
  try {
    const res = await fetch('/api/env');
    _config = await res.json();
  } catch (err) {
    console.error('Failed to load config:', err);
    _config = { supabaseUrl: '', supabasePublishableKey: '', siteVersion: 'v1.0.1' };
  }
  return _config;
}
