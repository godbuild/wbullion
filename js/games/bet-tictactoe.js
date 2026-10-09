import { navigate } from '../router.js';
import { getDeviceId, setCurrentUser } from '../auth.js';
import { showToast, showAlert } from '../modal.js';
import { money } from '../format.js';

export function renderBetTTT() {
  const el = document.getElementById('viewContainer');
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h3 style="font-size:20px;font-weight:bold;"><i class="fas fa-dice"></i> Predict Tic-Tac-Toe</h3>
      <button id="closeBetTTT" class="wb-close"><i class="fas fa-close"></i></button>
    </div>

    <p style="text-align:center;font-size:14px;color:var(--text-secondary);margin-bottom:20px;">Predict the winner. Fresh odds each round.</p>

    <div id="oddsRow" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px;">
      <div style="text-align:center;padding:16px;background:#dbeafe;border-radius:12px;">
        <p style="font-size:12px;color:#1e40af;">X wins</p>
        <p id="oddX" style="font-size:22px;font-weight:900;color:#1e3a8a;">—</p>
      </div>
      <div style="text-align:center;padding:16px;background:#f3f4f6;border-radius:12px;">
        <p style="font-size:12px;color:#374151;">Draw</p>
        <p id="oddDraw" style="font-size:22px;font-weight:900;color:#111827;">—</p>
      </div>
      <div style="text-align:center;padding:16px;background:#fee2e2;border-radius:12px;">
        <p style="font-size:12px;color:#991b1b;">O wins</p>
        <p id="oddO" style="font-size:22px;font-weight:900;color:#7f1d1d;">—</p>
      </div>
    </div>

    <p style="font-size:14px;font-weight:600;margin-bottom:8px;">Choose your bet</p>
    <div id="choiceRow" style="display:flex;gap:10px;margin-bottom:16px;">
      <button class="betChoice" data-choice="X" style="flex:1;padding:14px;border:2px solid var(--border-color);border-radius:12px;background:var(--bg-primary);color:var(--text-primary);font-weight:700;cursor:pointer;">X</button>
      <button class="betChoice" data-choice="draw" style="flex:1;padding:14px;border:2px solid var(--border-color);border-radius:12px;background:var(--bg-primary);color:var(--text-primary);font-weight:700;cursor:pointer;">Draw</button>
      <button class="betChoice" data-choice="O" style="flex:1;padding:14px;border:2px solid var(--border-color);border-radius:12px;background:var(--bg-primary);color:var(--text-primary);font-weight:700;cursor:pointer;">O</button>
    </div>

    <input id="betTTTAmount" type="number" inputmode="decimal" placeholder="Bet amount (min NGN 10)" class="wb-input" style="margin-bottom:12px;">

    <button id="placeBetBtn" class="wb-btn-primary">Place Bet</button>

    <div id="betTTTResult" style="display:none;text-align:center;margin-top:20px;padding:16px;border-radius:12px;font-size:18px;font-weight:700;"></div>

    <button id="refreshOddsBtn" class="wb-btn-primary" style="background:var(--bg-secondary);color:var(--text-primary);margin-top:16px;">New Round</button>
  `;

  let selected = null;
  let currentOdds = null;
  let _outcome = null;

  document.querySelectorAll('.betChoice').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.betChoice').forEach(b => {
        b.style.border = '2px solid var(--border-color)';
        b.style.background = 'var(--bg-primary)';
        b.style.color = 'var(--text-primary)';
      });
      btn.style.border = '3px solid var(--green)';
      btn.style.background = 'var(--green)';
      btn.style.color = 'white';
      selected = btn.dataset.choice;
    };
  });

  async function fetchOdds() {
    const r = await fetch('/api/games?action=odds', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: getDeviceId(), game: 'bettictactoe' })
    });
    const d = await r.json();
    currentOdds = d.odds;
    _outcome = d.outcome;
    document.getElementById('oddX').textContent = d.odds.X + 'x';
    document.getElementById('oddO').textContent = d.odds.O + 'x';
    document.getElementById('oddDraw').textContent = d.odds.draw + 'x';
  }

  document.getElementById('refreshOddsBtn').onclick = () => {
    document.getElementById('betTTTResult').style.display = 'none';
    document.getElementById('betTTTAmount').value = '';
    selected = null;
    document.querySelectorAll('.betChoice').forEach(b => {
      b.style.border = '2px solid var(--border-color)';
      b.style.background = 'var(--bg-primary)';
      b.style.color = 'var(--text-primary)';
    });
    fetchOdds();
  };

  document.getElementById('placeBetBtn').onclick = async () => {
    if (!selected) return showAlert('Choose X, O, or Draw');
    const amount = Number(document.getElementById('betTTTAmount').value);
    if (!amount || amount < 10) return showAlert('Minimum bet is NGN 10');

    const betOdds = currentOdds[selected];
    const r = await fetch('/api/games?action=bet-ttt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: getDeviceId(), bet: amount,
        choice: selected, odds: betOdds, outcome: _outcome
      })
    });
    const d = await r.json();
    if (!r.ok) return showAlert(d.error);
    if (d.user) setCurrentUser(d.user);

    const resultEl = document.getElementById('betTTTResult');
    resultEl.style.display = 'block';
    if (d.won) {
      resultEl.innerHTML = `🎉 Winner: <strong>${_outcome}</strong><br>You won +${money(d.payout)}`;
      resultEl.style.background = '#d1fae5';
      resultEl.style.color = '#065f46';
      showToast(`+${money(d.payout)}`);
    } else {
      resultEl.innerHTML = `😢 Winner: <strong>${_outcome}</strong><br>You lost ${money(amount)}`;
      resultEl.style.background = '#fee2e2';
      resultEl.style.color = '#991b1b';
      showToast(`-${money(amount)}`);
    }
  };

  document.getElementById('closeBetTTT').onclick = () => navigate('/games');

  fetchOdds();
}
