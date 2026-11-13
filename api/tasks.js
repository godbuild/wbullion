import { getAdminClient } from '../lib/supabase.js';
import { resolveUser } from '../lib/auth.js';

const URL_REGEX = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
function linkify(html) {
  return html.replace(URL_REGEX, (url) => {
    const href = url.startsWith('http') ? url : 'https://' + url;
    return `<a href="${href}" target="_blank" rel="noopener" style="color:#3b82f6;text-decoration:underline;">${url}</a>`;
  });
}

export default async function handler(req, res) {
  const action = req.query.action || req.body?.action;
  switch (action) {
    case 'create':   return createTask(req, res);
    case 'list':     return listTasks(req, res);
    case 'complete': return completeTask(req, res);
    case 'delete':   return deleteTask(req, res);
    default: return res.status(400).json({ error: 'Unknown tasks action' });
  }
}

async function createTask(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (!user.hoep_enabled) return res.status(403).json({ error: 'Enable Help Others Earn Program first' });

  const { title, descriptionHtml, buttonLabel, buttonUrl, payPerClick, rewardClick } = req.body || {};
  if (!title || title.trim().length < 3) return res.status(400).json({ error: 'Title required' });

  const reward = rewardClick === undefined || rewardClick === null || rewardClick === '' ? 150 : Number(rewardClick);
  const clickCost = payPerClick === undefined || payPerClick === null || payPerClick === '' ? 0 : Number(payPerClick);
  if (!Number.isFinite(reward) || reward < 0 || !Number.isFinite(clickCost) || clickCost < 0) {
    return res.status(400).json({ error: 'Rewards must be valid non-negative amounts' });
  }

  const sb = getAdminClient();
  const { data, error } = await sb.from('tasks').insert({
    creator_id: user.id, title: title.trim().slice(0, 120),
    description_html: linkify(descriptionHtml || ''),
    button_label: buttonLabel ? String(buttonLabel).slice(0, 40) : null,
    button_url: buttonUrl || null,
    pay_per_click: clickCost,
    reward_click: reward
  }).select('*').single();
  if (error) return res.status(500).json({ error: error.message });

  const nb = Number(user.balance || 0) + 500;
  await sb.from('users').update({ balance: nb }).eq('id', user.id);
  await sb.from('transactions').insert({
    user_id: user.id, type: 'credit', amount: 500, description: 'Task creation bonus'
  });
  res.status(200).json({ success: true, task: data });
}

async function listTasks(req, res) {
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const sb = getAdminClient();
  const mode = req.query.mode || 'all';

  if (mode === 'mine') {
    const { data } = await sb.from('tasks').select('*').eq('creator_id', user.id).eq('deleted', false)
      .order('created_at', { ascending: false });
    return res.status(200).json({ tasks: data || [] });
  }

  const { data: completed } = await sb.from('task_completions').select('task_id').eq('user_id', user.id);
  const skipIds = new Set((completed || []).map(c => c.task_id));

  const { data } = await sb.from('tasks').select('*').eq('active', true).eq('deleted', false)
    .order('created_at', { ascending: false }).limit(30);
  const tasks = (data || []).filter(t => !skipIds.has(t.id) && t.creator_id !== user.id);
  res.status(200).json({ tasks });
}

async function deleteTask(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { taskId } = req.body || {};
  if (!taskId) return res.status(400).json({ error: 'taskId required' });
  const sb = getAdminClient();
  const { error } = await sb.from('tasks').update({ deleted: true, active: false }).eq('id', taskId).eq('creator_id', user.id);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}

async function completeTask(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { taskId } = req.body || {};
  if (!taskId) return res.status(400).json({ error: 'taskId required' });

  const sb = getAdminClient();
  const { data: task } = await sb.from('tasks').select('*').eq('id', taskId).maybeSingle();
  if (!task || task.deleted) return res.status(404).json({ error: 'Task not found' });
  if (task.creator_id === user.id) return res.status(400).json({ error: 'Cannot complete your own task' });

  const { data: existing } = await sb.from('task_completions').select('id')
    .eq('task_id', taskId).eq('user_id', user.id).maybeSingle();
  if (existing) return res.status(400).json({ error: 'Already completed' });

  const baseReward = task.reward_click === null || task.reward_click === undefined ? 150 : Number(task.reward_click);
  const payPerClick = Number(task.pay_per_click ?? 0);
  if (!Number.isFinite(baseReward) || baseReward < 0 || !Number.isFinite(payPerClick) || payPerClick < 0) {
    return res.status(500).json({ error: 'Task reward is invalid' });
  }
  const totalReward = baseReward + payPerClick;

  let creator = null;
  if (payPerClick > 0) {
    const { data, error } = await sb.from('users').select('balance').eq('id', task.creator_id).maybeSingle();
    if (error) return res.status(500).json({ error: 'Could not verify task funding' });
    creator = data;
    if (!creator) return res.status(404).json({ error: 'Task creator not found' });
    if (Number(creator.balance || 0) < payPerClick) {
      return res.status(400).json({ error: 'The task creator does not have enough balance to fund this reward' });
    }
  }

  const { error: completionError } = await sb.from('task_completions').insert({
    task_id: taskId, user_id: user.id, reward: totalReward
  });
  if (completionError) return res.status(409).json({ error: 'This task has already been completed or could not be claimed' });

  const nb = Number(user.balance || 0) + totalReward;
  const { error: balanceError } = await sb.from('users').update({ balance: nb }).eq('id', user.id);
  if (balanceError) return res.status(500).json({ error: 'Task was recorded, but the reward could not be credited' });
  const { error: creditError } = await sb.from('transactions').insert({
    user_id: user.id, type: 'credit', amount: totalReward, description: `Task reward — ${task.title}`
  });
  if (creditError) return res.status(500).json({ error: 'Task reward was credited, but its transaction record could not be saved' });

  if (payPerClick > 0 && creator) {
    const cb = Math.max(0, Number(creator.balance || 0) - payPerClick);
    const { error: debitError } = await sb.from('users').update({ balance: cb }).eq('id', task.creator_id);
    if (debitError) return res.status(500).json({ error: 'Task reward was credited, but the creator debit could not be completed' });
    const { error: debitRecordError } = await sb.from('transactions').insert({
      user_id: task.creator_id, type: 'debit', amount: payPerClick,
      description: `Task CPC — ${task.title}`
    });
    if (debitRecordError) return res.status(500).json({ error: 'Task reward was credited, but the creator debit record could not be saved' });
  }

  res.status(200).json({ success: true, reward: totalReward });
}
