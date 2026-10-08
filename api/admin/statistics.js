import { getAdminClient } from '../_lib/supabase.js';
import { requireAdmin } from '../_lib/admin.js';

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;
  const sb = getAdminClient();
  const now = Date.now();
  const buckets = {
    hour: new Date(now - 3600_000).toISOString(),
    day: new Date(now - 86400_000).toISOString(),
    week: new Date(now - 7 * 86400_000).toISOString()
  };

  const { data: logs } = await sb.from('action_logs')
    .select('*')
    .gte('created_at', buckets.week)
    .order('created_at', { ascending: false });

  const all = logs || [];
  const within = (ts, cutoff) => ts >= cutoff;

  const summarize = (cutoff) => {
    const scoped = all.filter(l => within(l.created_at, cutoff));
    const byAction = {};
    const byGame = {};
    for (const l of scoped) {
      byAction[l.action] = (byAction[l.action] || 0) + 1;
      if (l.action === 'game_play' && l.meta?.game) {
        byGame[l.meta.game] = (byGame[l.meta.game] || 0) + 1;
      }
    }
    return { total: scoped.length, byAction, byGame };
  };

  const gameLosses = all
    .filter(l => l.action === 'game_loss')
    .reduce((s, l) => s + Number(l.meta?.amount || 0), 0);

  res.status(200).json({
    hour: summarize(buckets.hour),
    day: summarize(buckets.day),
    week: summarize(buckets.week),
    gameLosses: Math.round(gameLosses)
  });
}
