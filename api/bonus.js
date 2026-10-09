import { getAdminClient } from '../lib/supabase.js';
import { resolveUser, stripPassword } from '../lib/auth.js';
import { rewardForDay, isDoubleDay } from '../lib/streak.js';

const TELEGRAM_LINK = 'https://t.me/cashoutupdate_ng';
const TELEGRAM_REWARD = 200;

export default async function handler(req, res) {
  const action = req.query.action || req.body?.action;
  switch (action) {
    case 'daily':     return daily(req, res);
    case 'telegram':  return telegram(req, res);
    case 'streak':    return streak(req, res);
    case 'claim-day': return claimDay(req, res);
    case 'objective': return objective(req, res);
    default: return res.status(400).json({ error: 'Unknown bonus action' });
  }
}

function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function dayDiff(a, b) { return Math.round((startOfDay(a) - startOfDay(b)) / 86400000); }

async function daily(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const now = new Date();
  const last = user.last_bonus_claim ? new Date(user.last_bonus_claim) : null;
  const diff = last ? dayDiff(now, last) : null;
  if (diff === 0) return res.status(400).json({ error: 'Already claimed today' });

  const sb = getAdminClient();
  let currentDay, streakStartedAt = user.streak_started_at;
  if (diff === 1) currentDay = (user.streak_day || 0) + 1;
  else { currentDay = 1; streakStartedAt = now.toISOString(); }

  const { data: existingRows } = await sb.from('streak_allowance').select('streak_day').eq('user_id', user.id);
  const existingDays = new Set((existingRows || []).map(r => r.streak_day));
  const toCreate = [];
  for (let d = 1; d <= currentDay; d++) {
    if (!existingDays.has(d)) {
      toCreate.push({
        user_id: user.id, streak_day: d,
        week_index: Math.floor((d - 1) / 7),
        base_reward: 150 + (d - 1) * 50,
        reward: rewardForDay(d), is_double_day: isDoubleDay(d), claimed: false
      });
    }
  }
  if (toCreate.length > 0) await sb.from('streak_allowance').insert(toCreate);

  const { data: todayRow } = await sb.from('streak_allowance').select('*')
    .eq('user_id', user.id).eq('streak_day', currentDay).maybeSingle();
  if (todayRow && todayRow.claimed) return res.status(400).json({ error: 'Already claimed today' });

  const reward = todayRow ? Number(todayRow.reward) : rewardForDay(currentDay);

  if (todayRow) {
    await sb.from('streak_allowance').update({ claimed: true, claimed_at: now.toISOString() }).eq('id', todayRow.id);
  } else {
    await sb.from('streak_allowance').insert({
      user_id: user.id, streak_day: currentDay,
      week_index: Math.floor((currentDay - 1) / 7),
      base_reward: 150 + (currentDay - 1) * 50,
      reward, is_double_day: isDoubleDay(currentDay), claimed: true, claimed_at: now.toISOString()
    });
  }

  const newBalance = Number(user.balance || 0) + reward;
  const { data: updated, error } = await sb.from('users').update({
    balance: newBalance, streak_day: currentDay, streak_started_at: streakStartedAt,
    last_bonus_claim: now.toISOString(), last_claim_date: now.toISOString().slice(0, 10),
    updated_at: now.toISOString()
  }).eq('id', user.id).select('*').single();
  if (error) return res.status(500).json({ error: error.message });

  await sb.from('transactions').insert({
    user_id: user.id, type: 'credit', amount: reward,
    description: `Daily bonus — Day ${currentDay}${isDoubleDay(currentDay) ? ' (doubled week)' : ''}`
  });
  await sb.from('bonus_claims').insert({
    user_id: user.id, bonus_type: 'daily', amount: reward, streak_day: currentDay
  });

  res.status(200).json({
    success: true, reward, streakDay: currentDay,
    isDoubleDay: isDoubleDay(currentDay), user: stripPassword(updated)
  });
}

async function telegram(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.telegram_bonus_claimed) return res.status(400).json({ error: 'Already claimed' });

  const sb = getAdminClient();
  const newBalance = Number(user.balance || 0) + TELEGRAM_REWARD;
  const { data: updated, error } = await sb.from('users').update({
    balance: newBalance, telegram_bonus_claimed: true, updated_at: new Date().toISOString()
  }).eq('id', user.id).select('*').single();
  if (error) return res.status(500).json({ error: error.message });

  await sb.from('transactions').insert({
    user_id: user.id, type: 'credit', amount: TELEGRAM_REWARD, description: 'Telegram bonus'
  });
  await sb.from('bonus_claims').insert({
    user_id: user.id, bonus_type: 'telegram', amount: TELEGRAM_REWARD
  });

  res.status(200).json({ success: true, reward: TELEGRAM_REWARD, link: TELEGRAM_LINK, user: stripPassword(updated) });
}

async function streak(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const sb = getAdminClient();
  const { data: rows } = await sb.from('streak_allowance').select('*')
    .eq('user_id', user.id).order('streak_day', { ascending: true });

  const allowances = rows || [];
  const currentDay = user.streak_day || 0;
  const weekMap = {};
  for (const r of allowances) {
    if (!weekMap[r.week_index]) weekMap[r.week_index] = [];
    weekMap[r.week_index].push(r);
  }
  const maxWeek = currentDay > 0 ? Math.floor((currentDay - 1) / 7) : 0;
  const weeks = [];
  for (let w = 0; w <= maxWeek; w++) {
    const days = [];
    for (let d = 1; d <= 7; d++) {
      const dayNumber = w * 7 + d;
      const found = (weekMap[w] || []).find(x => x.streak_day === dayNumber);
      const expected = rewardForDay(dayNumber);
      days.push({
        day: dayNumber, dayInWeek: d,
        amount: found ? Number(found.reward) : expected,
        claimed: found ? found.claimed : false,
        claimedAt: found?.claimed_at || null,
        isDoubleDay: expected !== (150 + (dayNumber - 1) * 50)
      });
    }
    const pendingCount = days.filter(x => !x.claimed).length;
    weeks.push({
      weekIndex: w, label: `Week ${w + 1}`, days,
      pendingCount, allClaimed: pendingCount === 0
    });
  }
  const totalEarned = allowances.filter(r => r.claimed).reduce((s, r) => s + Number(r.reward), 0);

  res.status(200).json({
    streakDay: currentDay, streakStartedAt: user.streak_started_at,
    lastBonusClaim: user.last_bonus_claim, totalEarned, weeks
  });
}

async function claimDay(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { streakDay } = req.body || {};
  const day = Number(streakDay);
  if (!day || day < 1) return res.status(400).json({ error: 'Invalid streak day' });
  if (day > (user.streak_day || 0)) return res.status(400).json({ error: 'That day has not been reached yet' });

  const sb = getAdminClient();
  const { data: row } = await sb.from('streak_allowance').select('*')
    .eq('user_id', user.id).eq('streak_day', day).maybeSingle();
  if (!row) return res.status(404).json({ error: 'No allowance for that day' });
  if (row.claimed) return res.status(400).json({ error: 'Already claimed' });

  const now = new Date();
  const reward = Number(row.reward);
  await sb.from('streak_allowance').update({ claimed: true, claimed_at: now.toISOString() }).eq('id', row.id);

  const newBalance = Number(user.balance || 0) + reward;
  const { data: updated } = await sb.from('users').update({
    balance: newBalance, updated_at: now.toISOString()
  }).eq('id', user.id).select('*').single();

  await sb.from('transactions').insert({
    user_id: user.id, type: 'credit', amount: reward,
    description: `Streak day ${day}${isDoubleDay(day) ? ' (doubled week)' : ''}`
  });
  await sb.from('bonus_claims').insert({
    user_id: user.id, bonus_type: 'daily', amount: reward, streak_day: day
  });

  res.status(200).json({ success: true, reward, user: stripPassword(updated) });
}

async function objective(req, res) {
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const sb = getAdminClient();

  if (req.method === 'GET') {
    const { game } = req.query;
    const { data: objectives } = await sb.from('game_objectives')
      .select('*').eq('game', game).eq('active', true);
    const { data: progress } = await sb.from('objective_progress').select('*').eq('user_id', user.id);
    const progMap = {};
    for (const p of progress || []) progMap[p.objective_id] = p;

    const tiers = ['easy', 'medium', 'hard', 'difficult'];
    const sorted = (objectives || []).sort((a, b) => tiers.indexOf(a.tier) - tiers.indexOf(b.tier));
    const active = sorted.find(o => !progMap[o.id]?.completed) || sorted[0];

    return res.status(200).json({
      objective: active || null,
      progress: active ? (progMap[active.id] || null) : null,
      all: objectives || []
    });
  }

  if (req.method === 'POST') {
    const { objectiveId, delta = 1, complete, fail, claim } = req.body || {};
    if (!objectiveId) return res.status(400).json({ error: 'objectiveId required' });

    const { data: obj } = await sb.from('game_objectives').select('*').eq('id', objectiveId).maybeSingle();
    if (!obj) return res.status(404).json({ error: 'Objective not found' });

    const { data: existing } = await sb.from('objective_progress').select('*')
      .eq('user_id', user.id).eq('objective_id', objectiveId).maybeSingle();

    let progress = existing?.progress || 0;
    let completed = existing?.completed || false;
    let failed = existing?.failed || false;
    let claimed = existing?.claimed || false;
    if (fail) failed = true;
    if (complete) completed = true;
    if (delta) progress += Number(delta);

    if (existing) {
      await sb.from('objective_progress').update({
        progress, completed, failed, claimed, updated_at: new Date().toISOString()
      }).eq('id', existing.id);
    } else {
      await sb.from('objective_progress').insert({
        user_id: user.id, objective_id: objectiveId, progress, completed, failed, claimed
      });
    }

    if (claim && completed && !claimed) {
      const reward = Number(obj.reward);
      const nb = Number(user.balance || 0) + reward;
      const { data: updated } = await sb.from('users').update({ balance: nb }).eq('id', user.id).select('*').single();
      await sb.from('transactions').insert({
        user_id: user.id, type: 'credit', amount: reward, description: `Objective: ${obj.title}`
      });
      await sb.from('objective_progress').update({ claimed: true })
        .eq('user_id', user.id).eq('objective_id', objectiveId);
      return res.status(200).json({ success: true, reward, user: stripPassword(updated) });
    }
    return res.status(200).json({ success: true, progress, completed, failed, claimed });
  }
  res.status(405).json({ error: 'Method not allowed' });
}
