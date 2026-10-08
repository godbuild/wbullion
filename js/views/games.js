import { navigate } from '../router.js';
import { getCurrentUser } from '../auth.js';
import { money } from '../format.js';

export function renderGames() {
  const user = getCurrentUser();
  const el = document.getElementById('viewContainer');
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
      <h2 style="font-size:28px;font-weight:bold;">Games</h2>
      <button id="closeGames" class="wb-close" style="font-size:20px;"><i class="fas fa-close"></i></button>
    </div>

    <div class="wb-card" style="background:linear-gradient(135deg,#1f2937,#374151);color:white;padding:16px;margin-bottom:20px;text-align:center;">
      <p style="font-size:12px;opacity:0.85;">Balance</p>
      <p style="font-size:26px;font-weight:bold;">${money(user?.balance || 0)}</p>
    </div>

    <div style="display:flex;flex-direction:column;gap:16px;">
      <div class="gameCard" data-game="football" style="background:linear-gradient(135deg,#10b981,#059669);padding:24px;border-radius:16px;color:white;cursor:pointer;">
        <div style="font-size:40px;margin-bottom:8px;"><i class="fas fa-futbol"></i></div>
        <h3 style="font-size:20px;font-weight:bold;">Football Shootout</h3>
        <p style="font-size:14px;opacity:0.9;">NGN 120–180 per goal</p>
      </div>

      <div class="gameCard" data-game="tictactoe" style="background:linear-gradient(135deg,#3b82f6,#2563eb);padding:24px;border-radius:16px;color:white;cursor:pointer;">
        <div style="font-size:40px;margin-bottom:8px;"><i class="fas fa-puzzle-piece"></i></div>
        <h3 style="font-size:20px;font-weight:bold;">Tic-Tac-Toe</h3>
        <p style="font-size:14px;opacity:0.9;">NGN 120–180 per win</p>
      </div>

      <div class="gameCard" data-game="rps" style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:24px;border-radius:16px;color:white;cursor:pointer;">
        <div style="font-size:40px;margin-bottom:8px;">
          <i class="fas fa-fist-raised"></i> <i class="fas fa-file"></i> <i class="fas fa-scissors"></i>
        </div>
        <h3 style="font-size:20px;font-weight:bold;">Rock Paper Scissors</h3>
        <p style="font-size:14px;opacity:0.9;">NGN 200 per win</p>
      </div>

      <div class="gameCard" data-game="leveller" style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);padding:24px;border-radius:16px;color:white;cursor:pointer;">
        <div style="font-size:40px;margin-bottom:8px;"><i class="fas fa-mountain"></i></div>
        <h3 style="font-size:20px;font-weight:bold;">Leveller</h3>
        <p style="font-size:14px;opacity:0.9;">Bet & Cashout • Min NGN 10</p>
      </div>

      <div class="gameCard" data-game="bettictactoe" style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:24px;border-radius:16px;color:white;cursor:pointer;">
        <div style="font-size:40px;margin-bottom:8px;"><i class="fas fa-dice"></i></div>
        <h3 style="font-size:20px;font-weight:bold;">Predict Tic-Tac-Toe</h3>
        <p style="font-size:14px;opacity:0.9;">Predict X, O, or Draw</p>
      </div>
    </div>
  `;

  document.getElementById('closeGames').onclick = () => navigate('/home');

  document.querySelectorAll('.gameCard').forEach(c => {
    c.onclick = () => {
      const g = c.dataset.game;
      if (g === 'football') navigate('/games/football');
      else if (g === 'tictactoe') navigate('/games/tictactoe');
      else if (g === 'rps') navigate('/games/rps');
      else if (g === 'leveller') navigate('/games/leveller');
      else if (g === 'bettictactoe') navigate('/games/bet-tictactoe');
    };
  });
}
