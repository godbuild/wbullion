import { navigate } from '../router.js';
import { getDeviceId, setCurrentUser } from '../auth.js';
import { showToast } from '../modal.js';
import { money } from '../format.js';

const COMPUTER_LOSS_PCT = 0.15;

export function renderRPS() {
  const el = document.getElementById('viewContainer');
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h3 style="font-size:20px;font-weight:bold;">Rock Paper Scissors</h3>
      <button id="closeRPS" class="wb-close"><i class="fas fa-close"></i></button>
    </div>

    <p style="text-align:center;margin-bottom:24px;color:var(--text-secondary);font-size:14px;">Choose your weapon</p>

    <div style="display:flex;justify-content:center;gap:20px;margin-bottom:32px;">
      <button class="rpsChoice" data-choice="rock" style="font-size:50px;padding:20px;background:var(--bg-secondary);border-radius:16px;cursor:pointer;border:none;transition:transform 0.15s;">
        <i class="fas fa-fist-raised"></i>
      </button>
      <button class="rpsChoice" data-choice="paper" style="font-size:50px;padding:20px;background:var(--bg-secondary);border-radius:16px;cursor:pointer;border:none;transition:transform 0.15s;">
        <i class="fas fa-file"></i>
      </button>
      <button class="rpsChoice" data-choice="scissors" style="font-size:50px;padding:20px;background:var(--bg-secondary);border-radius:16px;cursor:pointer;border:none;transition:transform 0.15s;">
        <i class="fas fa-scissors"></i>
      </button>
    </div>

    <div id="rpsResult" style="text-align:center;font-size:18px;font-weight:600;min-height:60px;"></div>

    <div id="rpsStreak" style="text-align:center;color:var(--text-secondary);font-size:13px;margin-top:20px;"></div>
  `;

  let wins = 0, losses = 0;

  document.querySelectorAll('.rpsChoice').forEach(btn => {
    btn.onmouseenter = () => btn.style.transform = 'scale(1.08)';
    btn.onmouseleave = () => btn.style.transform = 'scale(1)';
    btn.onclick = async () => {
      const playerChoice = btn.dataset.choice;
      const res = await fetch('/api/games/odds', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: getDeviceId(), game: 'rps' })
      });
      const data = await res.json();
      const cc = data.computer;

      const result = determineWinner(playerChoice, cc);
      const el = document.getElementById('rpsResult');
      const icons = { rock: 'fa-fist-raised', paper: 'fa-file', scissors: 'fa-scissors' };

      if (result === 'win') {
        wins++;
        await creditWin(200, 'RPS win');
        el.innerHTML = `
          <div style="display:flex;justify-content:center;gap:20px;font-size:40px;margin-bottom:12px;">
            <i class="fas ${icons[playerChoice]}"></i>
            <i class="fas fa-vs" style="font-size:14px;align-self:center;">VS</i>
            <i class="fas ${icons[cc]}"></i>
          </div>
          <p style="color:#10b981;font-size:22px;">You Win! +${money(200)}</p>
        `;
      } else if (result === 'loss') {
        losses++;
        await deductLoss(200, 'RPS loss');
        el.innerHTML = `
          <div style="display:flex;justify-content:center;gap:20px;font-size:40px;margin-bottom:12px;">
            <i class="fas ${icons[playerChoice]}"></i>
            <i class="fas fa-vs" style="font-size:14px;align-self:center;">VS</i>
            <i class="fas ${icons[cc]}"></i>
          </div>
          <p style="color:#ef4444;font-size:22px;">Computer Wins · -${money(200)}</p>
        `;
      } else {
        el.innerHTML = `
          <div style="display:flex;justify-content:center;gap:20px;font-size:40px;margin-bottom:12px;">
            <i class="fas ${icons[playerChoice]}"></i>
            <i class="fas fa-vs" style="font-size:14px;align-self:center;">VS</i>
            <i class="fas ${icons[cc]}"></i>
          </div>
          <p style="color:var(--text-secondary);font-size:22px;">Draw!</p>
        `;
      }

      document.getElementById('rpsStreak').textContent = `Wins: ${wins} · Losses: ${losses}`;
    };
  });

  document.getElementById('closeRPS').onclick = () => navigate('/games');
}

function determineWinner(p, c) {
  if (p === c) return 'draw';
  if ((p === 'rock' && c === 'scissors') || (p === 'paper' && c === 'rock') || (p === 'scissors' && c === 'paper')) return 'win';
  return 'loss';
}

async function creditWin(amount, desc) {
  const res = await fetch('/api/games/balance-op', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: getDeviceId(), amount, operation: 'add', description: desc, gameName: 'rps', isGameWin: true })
  });
  const d = await res.json();
  if (d.user) setCurrentUser(d.user);
  showToast(`+${money(amount)}`);
}

async function deductLoss(amount, desc) {
  await fetch('/api/games/balance-op', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: getDeviceId(), amount, operation: 'subtract', description: desc, gameName: 'rps', isGameLoss: true })
  });
  // Reload user to reflect new balance
  const r = await fetch(`/api/users/me?deviceId=${encodeURIComponent(getDeviceId())}`);
  const u = await r.json();
  if (u && !u.error) setCurrentUser(u);
  showToast(`-${money(amount)}`);
}
