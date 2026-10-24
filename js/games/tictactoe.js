import { navigate } from '../router.js';
import { getDeviceId, setCurrentUser } from '../auth.js';
import { showToast } from '../modal.js';
import { money } from '../format.js';
import { apiFetch } from '../lib/api.js';

const COMPUTER_LOSS_PCT = 0.15;

let _state = {};

export async function renderTicTacToe() {
  const el = document.getElementById('viewContainer');
  el.innerHTML = `<div style="padding:40px;text-align:center;"><i class="fas fa-spinner fa-spin"></i></div>`;

  _state = {
    board: Array(9).fill(''),
    gameOver: false,
    userSymbol: 'X',
    computerSymbol: 'O',
    round: 1,
    difficulty: 'medium',
    boxValues: [],
    winLine: null
  };

  try {
    const oddsRes = await fetch('/api/games?action=odds', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: getDeviceId(), game: 'football' })
    });
    const oddsData = await oddsRes.json();
    _state.boxValues = oddsData.portions || Array.from({ length: 9 }, () => Math.floor(Math.random() * 61) + 120);
  } catch {
    _state.boxValues = Array.from({ length: 9 }, () => Math.floor(Math.random() * 61) + 120);
  }

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h3 style="font-size:20px;font-weight:bold;">Tic-Tac-Toe</h3>
      <button id="closeTTT" class="wb-close"><i class="fas fa-close"></i></button>
    </div>

    <div style="text-align:center;margin-bottom:16px;">
      <p style="font-size:14px;color:var(--text-secondary);">
        Round ${_state.round} · You are <strong>${_state.userSymbol}</strong>
      </p>
      <p style="font-size:12px;color:var(--text-secondary);margin-top:4px;">Win a row to claim the box amounts!</p>
    </div>

    <div style="position:relative;max-width:340px;margin:0 auto;">
      <div id="tttBoard" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;aspect-ratio:1;">
        ${_state.board.map((cell, i) => `
          <button class="tttCell" data-index="${i}" style="aspect-ratio:1;background:var(--bg-secondary);border:none;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:38px;font-weight:bold;cursor:pointer;position:relative;color:var(--text-primary);">
            <span class="cellSymbol">${cell}</span>
            <span style="position:absolute;bottom:6px;font-size:10px;color:var(--text-secondary);font-weight:600;">${money(_state.boxValues[i])}</span>
          </button>
        `).join('')}
      </div>
      <canvas id="tttCanvas" style="position:absolute;inset:0;pointer-events:none;"></canvas>
    </div>

    <p id="tttStatus" style="text-align:center;margin-top:20px;font-size:16px;font-weight:600;min-height:24px;"></p>

    <button id="resetTTT" class="wb-btn-primary" style="margin-top:20px;">New Game</button>
  `;

  document.getElementById('closeTTT').onclick = () => navigate('/games');
  document.getElementById('resetTTT').onclick = () => renderTicTacToe();

  document.querySelectorAll('.tttCell').forEach(cell => {
    cell.onclick = () => handleUserMove(Number(cell.dataset.index));
  });
}

async function handleUserMove(index) {
  if (_state.gameOver || _state.board[index]) return;
  _state.board[index] = _state.userSymbol;
  updateBoard();

  const w = checkWinner(_state.board);
  if (w) return endGame(w);
  if (_state.board.every(c => c)) return endGame('draw');

  await new Promise(r => setTimeout(r, 300));

  try {
    const data = await apiFetch('/api/games?action=odds', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: getDeviceId(), game: 'tictactoe',
        board: _state.board, computer: _state.computerSymbol,
        difficulty: _state.difficulty
      })
    });
    const idx = data.move;
    if (idx !== undefined && idx !== null) {
      _state.board[idx] = _state.computerSymbol;
      updateBoard();
      const w2 = checkWinner(_state.board);
      if (w2) return endGame(w2);
      if (_state.board.every(c => c)) return endGame('draw');
    }
  } catch {}
}

function updateBoard() {
  document.querySelectorAll('.tttCell').forEach((cell, i) => {
    cell.querySelector('.cellSymbol').textContent = _state.board[i];
    cell.style.color = _state.board[i] === 'X' ? '#3b82f6' : _state.board[i] === 'O' ? '#ef4444' : 'var(--text-primary)';
  });
}

function checkWinner(b) {
  const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const w of wins) {
    if (b[w[0]] && b[w[0]] === b[w[1]] && b[w[1]] === b[w[2]]) {
      _state.winLine = w;
      return b[w[0]];
    }
  }
  if (b.every(c => c)) return 'draw';
  return null;
}

async function endGame(result) {
  _state.gameOver = true;
  const status = document.getElementById('tttStatus');

  if (result === _state.userSymbol) {
    if (_state.winLine) await drawPencilLine(_state.winLine);
    const reward = _state.winLine.reduce((s, i) => s + _state.boxValues[i], 0);
    status.textContent = `You won! +${money(reward)}`;
    status.style.color = '#10b981';
    await fetch('/api/games?action=balance-op', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: getDeviceId(), amount: reward, operation: 'add',
        description: 'Tic-Tac-Toe win', gameName: 'tictactoe', isGameWin: true
      })
    });
    showToast(`+${money(reward)}`);
    reloadUser();
  } else if (result === _state.computerSymbol) {
    if (_state.winLine) await drawPencilLine(_state.winLine);
    const u = await fetch(`/api/users?action=me&deviceId=${encodeURIComponent(getDeviceId())}`).then(r => r.json());
    const penalty = Math.floor((u.balance || 0) * COMPUTER_LOSS_PCT);
    if (penalty > 0) {
      await fetch('/api/games?action=balance-op', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: getDeviceId(), amount: penalty, operation: 'subtract',
          description: 'Tic-Tac-Toe loss (15%)', gameName: 'tictactoe', isGameLoss: true
        })
      });
    }
    status.textContent = `Computer wins! -${money(penalty)}`;
    status.style.color = '#ef4444';
    showToast(`-${money(penalty)}`);
    reloadUser();
  } else {
    status.textContent = 'Draw!';
    status.style.color = 'var(--text-secondary)';
  }

  setTimeout(() => {
    _state.round++;
    _state.userSymbol = _state.userSymbol === 'X' ? 'O' : 'X';
    _state.computerSymbol = _state.computerSymbol === 'X' ? 'O' : 'X';
  }, 2000);
}

async function reloadUser() {
  const r = await fetch(`/api/users?action=me&deviceId=${encodeURIComponent(getDeviceId())}`);
  const u = await r.json();
  if (u && !u.error) setCurrentUser(u);
}

async function drawPencilLine(indices) {
  const canvas = document.getElementById('tttCanvas');
  const board = document.getElementById('tttBoard');
  if (!canvas || !board) return;

  const rect = board.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  await loadBabylon();

  const engine = new BABYLON.Engine(canvas, true);
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

  const camera = new BABYLON.FreeCamera('cam', new BABYLON.Vector3(0, 0, -10), scene);
  camera.setTarget(BABYLON.Vector3.Zero());
  camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
  camera.orthoLeft = -rect.width / 2;
  camera.orthoRight = rect.width / 2;
  camera.orthoTop = rect.height / 2;
  camera.orthoBottom = -rect.height / 2;

  const cells = indices.map(i => {
    const cellEl = document.querySelector(`.tttCell[data-index="${i}"]`);
    const r = cellEl.getBoundingClientRect();
    return new BABYLON.Vector3(
      r.left + r.width / 2 - rect.left - rect.width / 2,
      -(r.top + r.height / 2 - rect.top - rect.height / 2),
      0
    );
  });

  const start = cells[0];
  const end = cells[2];
  const points = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const x = start.x + (end.x - start.x) * t;
    const y = start.y + (end.y - start.y) * t;
    const wobble = Math.sin(t * Math.PI * 8) * 2 * (1 - Math.abs(t - 0.5) * 2);
    points.push(new BABYLON.Vector3(x + wobble, y + wobble * 0.5, 0));
  }

  const tube = BABYLON.MeshBuilder.CreateTube('pencil', {
    path: points, radius: 1.2, tessellation: 8, cap: BABYLON.Mesh.CAP_ALL
  }, scene);

  const mat = new BABYLON.StandardMaterial('pencilMat', scene);
  mat.diffuseColor = new BABYLON.Color3(0.9, 0.15, 0.15);
  mat.emissiveColor = new BABYLON.Color3(0.3, 0.05, 0.05);
  tube.material = mat;

  engine.runRenderLoop(() => scene.render());

  setTimeout(() => {
    engine.stopRenderLoop();
    scene.dispose();
    engine.dispose();
  }, 4000);
}

function loadBabylon() {
  return new Promise((resolve) => {
    if (window.BABYLON) return resolve();
    const s = document.createElement('script');
    s.src = 'https://cdn.babylonjs.com/babylon.js';
    s.onload = resolve;
    document.head.appendChild(s);
  });
}
