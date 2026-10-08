import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { getConfig } from './config.js';

let _client = null;

export async function getSupabase() {
  if (_client) return _client;
  const cfg = await getConfig();
  if (!cfg.supabaseUrl || !cfg.supabasePublishableKey) {
    console.warn('Supabase credentials missing. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in Vercel.');
    return null;
  }
  _client = createClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
  return _client;
}
