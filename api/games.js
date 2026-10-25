import { getAdminClient } from '../lib/supabase.js';
import { resolveUser, stripPassword } from '../lib/auth.js';

const SAVE_PCT = 0.15;

export default async function handler(req, res) {
  const action = req.query.action || req.body?.action;
  switch (action) {
    case 'odds':             return odds(req, res);
    case 'balance-op':       return balanceOp(req, res);
    case 'log':              return logAction(req, res);
    case 'leveller-cashout': return levellerCashout(req, res);
    case 'bet-ttt':          return betTTT(req, res);
    case 'football-config':  return footballConfig(req, res);
    case 'football-shot':    return footballShot(req, res);
    default: return res.status(400).json({ error: 'Unknown games action' });
  }
}

function rng(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// ---------- odds ----------
async function odds(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (!user.activated) return res.status(403).json({ error: 'Account not activated' });

  const { game } = req.body || {};
  switch (game) {
    case 'rps': {
      const opts = ['rock', 'paper', 'scissors'];
      return res.status(200).json({ computer: opts[rng(0, 2)] });
    }
    case 'tictactoe': {
      const { board, computer, difficulty = 'medium' } = req.body;
      if (!Array.isArray(board) || board.length !== 9) return res.status(400).json({ error: 'Invalid board' });
      return res.status(200).json({ move: pickTTTMove(board, computer, difficulty) });
    }
    case 'leveller': {
      const r = Math.random();
      let crash;
      if (r < 0.90) crash = 1.0 + Math.random() * 2.0;
      else if (r < 0.95) crash = 3.0 + Math.random() * 7.0;
      else if (r < 0.99) crash = 10 + Math.random() * 40;
      else crash = 50 + Math.random() * 100;
      return res.status(200).json({ crashPoint: Number(crash.toFixed(2)) });
    }
    case 'bettictactoe': {
      const x = Number((2 + Math.random() * 10).toFixed(1));
      const o = Number((2 + Math.random() * 10).toFixed(1));
      const draw = Number((2 + Math.random() * 10).toFixed(1));
      const roll = Math.random();
      const outcome = roll < 0.4 ? 'X' : roll < 0.6 ? 'draw' : 'O';
      return res.status(200).json({ odds: { X: x, O: o, draw }, outcome });
    }
    case 'football': {
      const portions = [];
      for (let i = 0; i < 9; i++) portions.push(rng(120, 180));
      for (let i = portions.length - 1; i > 0; i--) {
        const j = rng(0, i);
        [portions[i], portions[j]] = [portions[j], portions[i]];
      }
      return res.status(200).json({ portions });
    }
    default: return res.status(400).json({ error: 'Unknown game' });
  }
}

const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function winner(board) {
  for (const w of WINS) {
    if (board[w[0]] && board[w[0]] === board[w[1]] && board[w[1]] === board[w[2]]) return board[w[0]];
  }
  return board.every(c => c) ? 'draw' : null;
}
function empty(board) { return board.map((v, i) => v ? null : i).filter(v => v !== null); }
function minimax(board, player, aiPlayer, humanPlayer, depth) {
  const w = winner(board);
  if (w === aiPlayer) return { score: 10 - depth };
  if (w === humanPlayer) return { score: depth - 10 };
  if (w === 'draw') return { score: 0 };
  const moves = [];
  for (const idx of empty(board)) {
    const next = [...board];
    next[idx] = player;
    const result = minimax(next, player === aiPlayer ? humanPlayer : aiPlayer, aiPlayer, humanPlayer, depth + 1);
    moves.push({ idx, score: result.score });
  }
  return moves.reduce((best, m) => player === aiPlayer
    ? (m.score > best.score ? m : best)
    : (m.score < best.score ? m : best));
}
function pickTTTMove(board, computer, difficulty) {
  const human = computer === 'X' ? 'O' : 'X';
  const empties = empty(board);
  if (difficulty === 'easy' && Math.random() < 0.6) return empties[Math.floor(Math.random() * empties.length)];
  if (difficulty === 'medium' && Math.random() < 0.3) return empties[Math.floor(Math.random() * empties.length)];
  return minimax(board, computer, computer, human, 0).idx;
}

// ---------- balance-op ----------
async function balanceOp(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (!user.activated) return res.status(403).json({ error: 'Not activated' });

  const { amount, operation, description, gameName, isGameLoss, isGameWin } = req.body || {};
  const amt = Number(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'Amount required' });
  if (!['add', 'subtract'].includes(operation)) return res.status(400).json({ error: 'Invalid operation' });
  if (operation === 'subtract' && Number(user.balance || 0) < amt) return res.status(400).json({ error: 'Insufficient balance' });

  const sb = getAdminClient();
  const newBalance = operation === 'add' ? Number(user.balance || 0) + amt : Number(user.balance || 0) - amt;
  const { data: updated, error: updateError } = await sb.from('users').update({
    balance: newBalance, updated_at: new Date().toISOString()
  }).eq('id', user.id).select('*').single();
  if (updateError || !updated) return res.status(500).json({ error: 'Balance update failed' });

  const { error: transactionError } = await sb.from('transactions').insert({
    user_id: user.id, type: operation === 'add' ? 'credit' : 'debit', amount: amt,
    description: description || (operation === 'add' ? 'Game win' : 'Game play'),
    game_name: gameName || null
  });
  if (transactionError) return res.status(500).json({ error: 'Transaction could not be recorded' });
  await sb.from('action_logs').insert({
    user_id: user.id,
    action: isGameLoss ? 'game_loss' : (isGameWin ? 'game_win' : 'balance_op'),
    meta: { amount: amt, game: gameName || null }
  });

  res.status(200).json({ success: true, balance: newBalance, user: stripPassword(updated) });
}

// ---------- log ----------
async function logAction(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { action, meta = {} } = req.body || {};
  const sb = getAdminClient();
  await sb.from('action_logs').insert({ user_id: user.id, action, meta });
  res.status(200).json({ success: true });
}

// ---------- leveller-cashout ----------
async function levellerCashout(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { bet, crashPoint, cashoutAt, cashedOut } = req.body || {};
  const b = Number(bet), cp = Number(crashPoint), ca = Number(cashoutAt);
  if (!b || b < 10) return res.status(400).json({ error: 'Minimum bet is NGN 10' });
  if (!cp || cp < 1) return res.status(400).json({ error: 'Invalid crash point' });

  const sb = getAdminClient();
  if (cashedOut && ca > 0) {
    if (ca >= cp) return res.status(400).json({ error: 'Cashout after crash' });
    const payout = Math.floor(b * ca);
    const nb = Number(user.balance || 0) + payout;
    const { data: updated } = await sb.from('users').update({
      balance: nb, updated_at: new Date().toISOString()
    }).eq('id', user.id).select('*').single();
    await sb.from('transactions').insert({
      user_id: user.id, type: 'credit', amount: payout,
      description: `Leveller cashout @ ${ca.toFixed(2)}x`, game_name: 'leveller'
    });
    await sb.from('leveller_history').insert({
      user_id: user.id, bet: b, crash_point: cp, cashed_out_at: ca, won: true, payout
    });
    await sb.from('action_logs').insert({
      user_id: user.id, action: 'game_win', meta: { game: 'leveller', amount: payout }
    });
    return res.status(200).json({ success: true, won: true, payout, user: stripPassword(updated) });
  }

  await sb.from('leveller_history').insert({
    user_id: user.id, bet: b, crash_point: cp, won: false, payout: 0
  });
  await sb.from('action_logs').insert({
    user_id: user.id, action: 'game_loss', meta: { game: 'leveller', amount: b }
  });
  await sb.from('transactions').insert({
    user_id: user.id, type: 'debit', amount: b,
    description: `Leveller crashed @ ${cp.toFixed(2)}x`, game_name: 'leveller'
  });
  res.status(200).json({ success: true, won: false, crashPoint: cp });
}

// ---------- bet-ttt ----------
async function betTTT(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (!user.activated) return res.status(403).json({ error: 'Not activated' });

  const { bet, choice } = req.body || {};
  const b = Number(bet);
  if (!Number.isFinite(b) || b < 10) return res.status(400).json({ error: 'Minimum bet is NGN 10' });
  if (!['X', 'O', 'draw'].includes(choice)) return res.status(400).json({ error: 'Invalid choice' });
  const balance = Number(user.balance || 0);
  if (!Number.isFinite(balance) || balance < b) return res.status(400).json({ error: 'Insufficient balance' });

  const x = Number((2 + Math.random() * 10).toFixed(1));
  const o = Number((2 + Math.random() * 10).toFixed(1));
  const draw = Number((2 + Math.random() * 10).toFixed(1));
  const roll = Math.random();
  const outcome = roll < 0.4 ? 'X' : roll < 0.6 ? 'draw' : 'O';
  const odds = { X: x, O: o, draw };
  const sb = getAdminClient();
  const afterBet = Number(user.balance || 0) - b;
  await sb.from('users').update({ balance: afterBet, updated_at: new Date().toISOString() }).eq('id', user.id);
  await sb.from('transactions').insert({
    user_id: user.id, type: 'debit', amount: b,
    description: `Predict TTT bet (${choice})`, game_name: 'bet_ttt'
  });

  const won = outcome === choice;
  const winOdds = Number(odds[choice]) || 2.5;
  const payout = won ? Math.floor(b * winOdds) : 0;
  let finalBalance = afterBet;

  if (won) {
    finalBalance = afterBet + payout;
    await sb.from('users').update({ balance: finalBalance, updated_at: new Date().toISOString() }).eq('id', user.id);
    await sb.from('transactions').insert({
      user_id: user.id, type: 'credit', amount: payout,
      description: `Predict TTT win @ ${winOdds}x`, game_name: 'bet_ttt'
    });
    await sb.from('action_logs').insert({
      user_id: user.id, action: 'game_win', meta: { game: 'bet_ttt', amount: payout }
    });
  } else {
    await sb.from('action_logs').insert({
      user_id: user.id, action: 'game_loss', meta: { game: 'bet_ttt', amount: b }
    });
  }

  await sb.from('bet_ttt_history').insert({
    user_id: user.id, bet: b, choice, outcome, odds: winOdds, won, payout
  });

  const { data: updated } = await sb.from('users').select('*').eq('id', user.id).single();
  res.status(200).json({
    success: true, won, payout, finalBalance, outcome, user: stripPassword(updated)
  });
}

// ---------- football-config ----------
async function footballConfig(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (!user.activated) return res.status(403).json({ error: 'Not activated' });

  const sb = getAdminClient();
  const [{ data: takers }, { data: objectives }, { data: progress }] = await Promise.all([
    sb.from('football_takers').select('*').eq('active', true).order('sort_order'),
    sb.from('game_objectives').select('*').eq('game', 'football').eq('active', true),
    sb.from('objective_progress').select('*').eq('user_id', user.id)
  ]);

  const tiers = ['easy', 'medium', 'hard', 'difficult'];
  const progMap = {};
  for (const p of progress || []) progMap[p.objective_id] = p;
  const sorted = (objectives || []).sort((a, b) => tiers.indexOf(a.tier) - tiers.indexOf(b.tier));
  const currentObjective = sorted.find(o => !progMap[o.id]?.completed) || sorted[0] || null;

  res.status(200).json({
    takers: takers || [],
    objective: currentObjective,
    objectiveProgress: currentObjective ? progMap[currentObjective.id] || null : null,
    wallet: { balance: Number(user.balance || 0) }
  });
}

// ---------- football-shot ----------
async function footballShot(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { takerId, portion, outcome } = req.body || {};
  if (!['goal', 'save', 'miss'].includes(outcome)) return res.status(400).json({ error: 'Invalid outcome' });

  const sb = getAdminClient();
  if (outcome === 'goal') {
    if (typeof portion !== 'number' || portion < 0 || portion > 8) return res.status(400).json({ error: 'Invalid portion' });
    const amount = Number(req.body.amount);
    if (!amount || amount < 120 || amount > 180) return res.status(400).json({ error: 'Invalid amount' });

    const nb = Number(user.balance || 0) + amount;
    const { data: updated } = await sb.from('users').update({
      balance: nb, updated_at: new Date().toISOString()
    }).eq('id', user.id).select('*').single();
    await sb.from('transactions').insert({
      user_id: user.id, type: 'credit', amount,
      description: `Football goal — Portion ${portion + 1}`, game_name: 'football'
    });
    await sb.from('action_logs').insert({
      user_id: user.id, action: 'game_win', meta: { game: 'football', amount, portion }
    });
    await sb.from('football_shots').insert({
      user_id: user.id, taker_id: takerId || null, portion, amount, outcome
    });
    return res.status(200).json({ success: true, outcome, reward: amount, user: stripPassword(updated) });
  }

  if (outcome === 'save') {
    const penalty = Math.floor(Number(user.balance || 0) * SAVE_PCT);
    const nb = Math.max(0, Number(user.balance || 0) - penalty);
    const { data: updated } = await sb.from('users').update({
      balance: nb, updated_at: new Date().toISOString()
    }).eq('id', user.id).select('*').single();
    await sb.from('transactions').insert({
      user_id: user.id, type: 'debit', amount: penalty,
      description: 'Football save penalty', game_name: 'football'
    });
    await sb.from('action_logs').insert({
      user_id: user.id, action: 'game_loss', meta: { game: 'football', amount: penalty }
    });
    await sb.from('football_shots').insert({
      user_id: user.id, taker_id: takerId || null, portion: null, amount: 0, outcome
    });
    return res.status(200).json({ success: true, outcome, penalty, user: stripPassword(updated) });
  }

  await sb.from('football_shots').insert({
    user_id: user.id, taker_id: takerId || null, portion: null, amount: 0, outcome: 'miss'
  });
  await sb.from('action_logs').insert({
    user_id: user.id, action: 'game_play', meta: { game: 'football', outcome: 'miss' }
  });
  res.status(200).json({ success: true, outcome: 'miss' });
}
