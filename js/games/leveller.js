import { navigate } from '../router.js';
import { getDeviceId, setCurrentUser } from '../auth.js';
import { showToast, showAlert } from '../modal.js';
import { money } from '../format.js';
import { apiFetch } from '../lib/api.js';

let _state = {
  running: false,
  bet: 0,
  crashPoint: 0,
  currentOdds: 1.0,
  cashedOut: false,
  cashoutAt: 0,
  engine: null,
  scene: null,
  kite: null,
  crashHistory: [],
  intervalId: null,
  resizeHandler: null
};

const HISTORY_KEY = 'wb_leveller_history';

export async function renderLeveller() {
  const el = document.getElementById('viewContainer');
  el.innerHTML = `<div style="padding:40px;text-align:center;"><i class="fas fa-spinner fa-spin"></i></div>`;

  _state.crashHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]').slice(0, 20);

  const theme = document.documentElement.getAttribute('data-theme') || 'system';
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h3 style="font-size:20px;font-weight:bold;"><i class="fas fa-mountain"></i> Leveller</h3>
      <button id="closeLeveller" class="wb-close"><i class="fas fa-close"></i></button>
    </div>

    <div id="crashHistory" style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;margin-bottom:12px;">
      ${_state.crashHistory.length === 0 ? '<span style="color:var(--text-secondary);font-size:12px;">No crashes yet</span>' :
        _state.crashHistory.map(c => `
          <span style="flex-shrink:0;padding:4px 10px;border-radius:14px;font-size:12px;font-weight:600;${c >= 2 ? 'background:#d1fae5;color:#065f46;' : 'background:#fee2e2;color:#991b1b;'}">
            ${Number(c).toFixed(2)}x
          </span>
        `).join('')}
    </div>

    <div id="levellerStage" style="position:relative;height:340px;border-radius:16px;overflow:hidden;background:${isDark ? 'linear-gradient(180deg,#0f172a,#1e1b4b)' : 'linear-gradient(180deg,#87ceeb,#e0f2fe)'};margin-bottom:16px;">
      <canvas id="levellerCanvas" style="width:100%;height:100%;display:block;"></canvas>
      <div id="oddsOverlay" style="position:absolute;top:20px;left:50%;transform:translateX(-50%);font-size:38px;font-weight:900;color:${isDark ? '#f1f5f9' : '#0f172a'};text-shadow:0 2px 8px rgba(0,0,0,0.3);pointer-events:none;">1.00x</div>
      <div id="betOverlay" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);color:white;font-size:24px;font-weight:800;letter-spacing:2px;">PLACE BET</div>
      <div id="crashFlash" style="position:absolute;inset:0;background:radial-gradient(circle,rgba(220,38,38,0.4),rgba(220,38,38,0.85));display:none;align-items:center;justify-content:center;">
        <span id="crashText" style="color:white;font-size:60px;font-weight:900;text-shadow:0 4px 20px rgba(0,0,0,0.6);">2.00x</span>
      </div>
    </div>

    <div style="display:flex;gap:10px;margin-bottom:12px;">
      <input id="levellerBet" type="number" inputmode="decimal" placeholder="Bet amount (min 10)" class="wb-input" style="flex:1;">
    </div>

    <div id="levellerButtons" style="display:grid;grid-template-columns:1fr;gap:10px;">
      <button id="startLeveller" class="wb-btn-primary"><i class="fas fa-play"></i> Start Game</button>
    </div>
  `;

  document.getElementById('closeLeveller').onclick = () => {
    if (_state.running) return showAlert('Wait for the round to finish or crash');
    cleanup();
    navigate('/games');
  };

  document.getElementById('startLeveller').onclick = startRound;

  await initBabylon(isDark);
}

async function initBabylon(isDark) {
  try {
    await loadBabylon();
    const canvas = document.getElementById('levellerCanvas');
    if (!canvas) return;

    const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

    const camera = new BABYLON.ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 2.4, 12, new BABYLON.Vector3(0, 2, 0), scene);
    camera.inputs.clear();

    const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
    hemi.intensity = isDark ? 0.5 : 0.9;

    if (isDark) {
      const dir = new BABYLON.DirectionalLight('dir', new BABYLON.Vector3(-1, -1, 1), scene);
      dir.intensity = 0.6;
    }

    const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 20, height: 20 }, scene);
    const gm = new BABYLON.StandardMaterial('gmat', scene);
    gm.diffuseColor = isDark ? new BABYLON.Color3(0.1, 0.15, 0.25) : new BABYLON.Color3(0.55, 0.75, 0.35);
    ground.material = gm;

    createClouds(scene, isDark);
    _state.kite = createKite(scene);
    _state.kite.position = new BABYLON.Vector3(0, 1.5, 0);
    _state.tail = createTail(scene);

    _state.engine = engine;
    _state.scene = scene;

    engine.runRenderLoop(() => {
      updateKiteMotion();
      scene.render();
    });

    const resizeHandler = () => { try { engine.resize(); } catch {} };
    _state.resizeHandler = resizeHandler;
    window.addEventListener('resize', resizeHandler);
  } catch (err) {
    console.error('[leveller] init error', err);
    showAlert('Failed to initialize Leveller visuals', 'Error');
  }
}

function createKite(scene) {
  const root = new BABYLON.TransformNode('kiteRoot', scene);
  const kiteMat = new BABYLON.StandardMaterial('kiteMat', scene);
  kiteMat.diffuseColor = new BABYLON.Color3(1, 0.4, 0.2);
  kiteMat.emissiveColor = new BABYLON.Color3(0.3, 0.1, 0.05);

  const diamond = BABYLON.MeshBuilder.CreatePolyhedron('diamond', { type: 1, size: 1 }, scene);
  diamond.material = kiteMat;
  diamond.scaling = new BABYLON.Vector3(0.6, 1.4, 0.15);
  diamond.parent = root;

  const barMat = new BABYLON.StandardMaterial('barMat', scene);
  barMat.diffuseColor = new BABYLON.Color3(0.25, 0.15, 0.05);

  const barH = BABYLON.MeshBuilder.CreateBox('barH', { width: 1.6, height: 0.05, depth: 0.05 }, scene);
  barH.material = barMat; barH.parent = root;

  const barV = BABYLON.MeshBuilder.CreateBox('barV', { width: 0.05, height: 2.2, depth: 0.05 }, scene);
  barV.material = barMat; barV.parent = root;

  return root;
}

function createTail(scene) {
  const root = new BABYLON.TransformNode('tailRoot', scene);
  const mat = new BABYLON.StandardMaterial('tailMat', scene);
  mat.diffuseColor = new BABYLON.Color3(1, 0.9, 0.3);
  for (let i = 0; i < 6; i++) {
    const bow = BABYLON.MeshBuilder.CreateBox(`bow${i}`, { width: 0.15, height: 0.15, depth: 0.05 }, scene);
    bow.material = mat; bow.parent = root;
    bow.position = new BABYLON.Vector3(i % 2 === 0 ? -0.15 : 0.15, -i * 0.35, 0);
  }
  return root;
}

function createClouds(scene, isDark) {
  const cloudMat = new BABYLON.StandardMaterial('cloudMat', scene);
  cloudMat.diffuseColor = isDark ? new BABYLON.Color3(0.2, 0.2, 0.3) : new BABYLON.Color3(1, 1, 1);
  cloudMat.emissiveColor = isDark ? new BABYLON.Color3(0.15, 0.15, 0.2) : new BABYLON.Color3(0.9, 0.9, 0.9);
  cloudMat.alpha = isDark ? 0.7 : 0.9;

  for (let i = 0; i < 5; i++) {
    const cloud = BABYLON.MeshBuilder.CreateSphere(`cloud${i}`, { diameter: 2 + Math.random() * 1.5 }, scene);
    cloud.material = cloudMat;
    cloud.position = new BABYLON.Vector3(-8 + i * 4, 5 + Math.random() * 2, -6);
    cloud.scaling.y = 0.5;
    let x = cloud.position.x;
    scene.onBeforeRenderObservable.add(() => {
      x += 0.005;
      if (x > 10) x = -10;
      cloud.position.x = x;
    });
  }
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

async function startRound() {
  try {
    const betInput = document.getElementById('levellerBet');
    const bet = Number(betInput.value);
    if (!bet || bet < 10) return showAlert('Minimum bet is NGN 10');
    const bal = await currentBalance();
    if (bet > bal) return showAlert('Insufficient balance');

    const d = await apiFetch('/api/games?action=balance-op', {
      method: 'POST',
      body: JSON.stringify({ deviceId: getDeviceId(), amount: bet, operation: 'subtract', description: 'Leveller bet', gameName: 'leveller' })
    });
    if (d.user) setCurrentUser(d.user);

    const cd = await apiFetch('/api/games?action=odds', {
      method: 'POST',
      body: JSON.stringify({ deviceId: getDeviceId(), game: 'leveller' })
    });

    _state.running = true;
    _state.bet = bet;
    _state.crashPoint = Number(cd.crashPoint) || 2.0; // safe fallback
    _state.currentOdds = 1.0;
    _state.cashedOut = false;
    _state.cashoutAt = 0;

    document.getElementById('betOverlay').style.display = 'none';
    document.getElementById('crashFlash').style.display = 'none';
    document.getElementById('oddsOverlay').textContent = '1.00x';

    const buttons = document.getElementById('levellerButtons');
    buttons.style.gridTemplateColumns = '1fr 1fr';
    buttons.innerHTML = `
      <button id="startLeveller" class="wb-btn-primary" disabled style="opacity:0.5;">Running...</button>
      <button id="cashoutLeveller" class="wb-btn-primary" style="background:#f59e0b;"><i class="fas fa-hand-holding-usd"></i> Cashout</button>
    `;
    document.getElementById('cashoutLeveller').onclick = cashout;

    const startTime = performance.now();
    _state.intervalId = setInterval(() => {
      const elapsed = (performance.now() - startTime) / 1000;
      _state.currentOdds = Math.pow(1.15, elapsed * 3);
      const oddsEl = document.getElementById('oddsOverlay');
      if (oddsEl) oddsEl.textContent = _state.currentOdds.toFixed(2) + 'x';
      if (_state.currentOdds >= _state.crashPoint && !_state.cashedOut) triggerCrash();
    }, 60);
  } catch (err) {
    showAlert(err.message || 'Failed to start round', 'Error');
    // reset UI
    endRound();
  }
}

async function cashout() {
  try {
    if (!_state.running || _state.cashedOut) return;
    if (_state.currentOdds >= _state.crashPoint) return;
    _state.cashedOut = true;
    _state.cashoutAt = _state.currentOdds;
    if (_state.intervalId) clearInterval(_state.intervalId);

    const d = await apiFetch('/api/games?action=leveller-cashout', {
      method: 'POST',
      body: JSON.stringify({ deviceId: getDeviceId(), bet: _state.bet, crashPoint: _state.crashPoint, cashoutAt: _state.cashoutAt, cashedOut: true })
    });
    if (d.user) setCurrentUser(d.user);
    showToast(`Cashed out @ ${_state.cashoutAt.toFixed(2)}x · +${money(d.payout)}`);
    endRound();
  } catch (err) {
    showAlert(err.message || 'Cashout failed', 'Error');
    endRound();
  }
}

async function triggerCrash() {
  try {
    if (_state.intervalId) clearInterval(_state.intervalId);
    _state.running = false;

    const flash = document.getElementById('crashFlash');
    const text = document.getElementById('crashText');
    if (text) text.textContent = _state.crashPoint.toFixed(2) + 'x';
    if (flash) flash.style.display = 'flex';

    const hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    hist.unshift(_state.crashPoint);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(0, 20)));

    // notify server of loss
    await apiFetch('/api/games?action=leveller-cashout', {
      method: 'POST',
      body: JSON.stringify({ deviceId: getDeviceId(), bet: _state.bet, crashPoint: _state.crashPoint, cashedOut: false })
    }).catch(() => {});

    showToast(`Crashed @ ${_state.crashPoint.toFixed(2)}x · Lost ${money(_state.bet)}`);

    setTimeout(() => endRound(), 2500);
  } catch (err) {
    console.error('[leveller] crash error', err);
    setTimeout(() => endRound(), 2500);
  }
}

function endRound() {
  _state.running = false;
  _state.currentOdds = 1.0;
  setTimeout(() => {
    const oddsOverlay = document.getElementById('oddsOverlay');
    if (oddsOverlay) oddsOverlay.textContent = '1.00x';
    const flash = document.getElementById('crashFlash');
    if (flash) flash.style.display = 'none';
    const overlay = document.getElementById('betOverlay');
    if (overlay) overlay.style.display = 'flex';
    const buttons = document.getElementById('levellerButtons');
    if (buttons) {
      buttons.style.gridTemplateColumns = '1fr';
      buttons.innerHTML = `<button id="startLeveller" class="wb-btn-primary"><i class="fas fa-play"></i> Start Game</button>`;
      document.getElementById('startLeveller').onclick = startRound;
    }
    if (_state.kite) try { _state.kite.position.y = 1.5; } catch {}
  }, 1500);
}

function cleanup() {
  if (_state.intervalId) { clearInterval(_state.intervalId); _state.intervalId = null; }
  if (_state.engine) {
    try { _state.engine.stopRenderLoop(); } catch {}
    try { _state.engine.dispose(); } catch {}
    _state.engine = null;
  }
  if (_state.resizeHandler) { window.removeEventListener('resize', _state.resizeHandler); _state.resizeHandler = null; }
}

async function currentBalance() {
  try {
    const u = await apiFetch('/api/users?action=me');
    if (u && u.balance != null) return Number(u.balance);
    return 0;
  } catch {
    return 0;
  }
}
