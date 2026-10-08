import { createClient } from '@supabase/supabase-js';

export function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Supabase server credentials missing');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
