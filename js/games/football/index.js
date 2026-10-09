import { navigate } from '../../router.js';
import { getDeviceId, setCurrentUser } from '../../auth.js';
import { showToast, showAlert } from '../../modal.js';
import { money } from '../../format.js';
import { loadFootballConfig, submitShot, refreshWallet } from './data.js';
import { loadBabylon, createScene, createGoalpost, createBall } from './engine.js';
import { createKeeper } from './keeper.js';
import { createBallController } from './ball.js';
import { createTaker } from './taker.js';
import { createReplayController } from './replay.js';
import { renderTakerSelect, renderFootballUI, renderObjectiveBanner } from './ui.js';

let S = null;

export async function renderFootball() {
  const el = document.getElementById('viewContainer');
  el.style.padding = '0';
  el.innerHTML = `
    <div style="background:var(--purple);min-height:100dvh;display:flex;align-items:center;justify-content:center;color:white;">
      <div style="text-align:center;">
        <div style="font-size:60px;margin-bottom:16px;"><i class="fas fa-futbol fa-spin"></i></div>
        <p style="font-size:14px;opacity:0.85;">Loading shootout...</p>
      </div>
    </div>
  `;

  let config;
  try {
    config = await loadFootballConfig();
  } catch (err) {
    el.innerHTML = `<div style="padding:60px;text-align:center;color:#ef4444;">${err.message}</div>`;
    return;
  }

  if (!config.takers || config.takers.length === 0) {
    el.innerHTML = `<div style="padding:60px;text-align:center;color:#ef4444;">No takers configured</div>`;
    return;
  }

  renderTakerSelect(config.takers, (taker) => startGame(config, taker));
}

async function startGame(config, takerData) {
  const el = document.getElementById('viewContainer');
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  el.innerHTML = `
    <div style="position:fixed;inset:0;background:#000;overflow:hidden;">
      <canvas id="fbCanvas" style="width:100%;height:100%;display:block;touch-action:none;"></canvas>
      <div id="fbOverlay"></div>
    </div>
  `;

  await loadBabylon();

  const canvas = document.getElementById('fbCanvas');
  const { engine, scene, cameras } = createScene(canvas, { isDark });

  const goal = createGoalpost(scene, { logoTextureUrl: '/images/logo.png' });
  const ball = createBall(scene, '/images/logo.png');
  const keeper = createKeeper(scene);
  const taker = createTaker(scene, {
    name: takerData.name,
    number: takerData.number,
    dominantFoot: takerData.dominant_foot,
    jerseyColor: takerData.jersey_color || '#3ba072'
  });

  const ballCtrl = createBallController(scene, ball);
  const replay = createReplayController(scene, cameras, ball, taker, keeper, goal);

  const oddsRes = await fetch('/api/games?action=odds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: getDeviceId(), game: 'football' })
  });
  const oddsData = await oddsRes.json();
  const portions = oddsData.portions || Array.from({ length: 9 }, () => Math.floor(Math.random() * 61) + 120);

  S = {
    config, takerData, engine, scene, cameras, goal, ball, keeper, taker,
    ballCtrl, replay, portions,
    mode: 'TPT',
    showLines: true,
    currentShot: { taker: null, portion: -1, outcome: null, amount: 0 },
    lastShot: null,
    swipeStart: null,
    swipeEnd: null,
    swipePath: [],
    isAnimating: false,
    isReplaying: false,
    activeShot: null,
    objectives: {
      current: config.objective,
      progress: config.objectiveProgress
    }
  };

  document.getElementById('fbOverlay').innerHTML =
    renderFootballUI({ balance: config.wallet.balance }, {}) +
    renderObjectiveBanner(config.objective, config.objectiveProgress);

  attachHudHandlers();
  attachSwipeHandlers(canvas);
  showPortionsFlash();

  engine.runRenderLoop(() => {
    const dt = engine.getDeltaTime() / 1000;
    ballCtrl.update(dt);
    checkShotOutcome();
    scene.render();
  });

  window.addEventListener('resize', () => engine.resize());
}

function attachHudHandlers() {
  document.getElementById('fbClose')?.addEventListener('click', () => {
    S?.engine.stopRenderLoop();
    S = null;
    navigate('/games');
  });

  document.getElementById('fbMore')?.addEventListener('click', () => {
    const menu = document.getElementById('fbMoreMenu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  });

  document.querySelectorAll('.fbMenuBtn').forEach(btn => {
    btn.onclick = () => {
      const action = btn.dataset.action;
      const menu = document.getElementById('fbMoreMenu');
      menu.style.display = 'none';

      if (action === 'replay') {
        if (!S.lastShot) return showToast('No previous shot');
        playReplay(S.lastShot);
      } else if (action === 'toggleLines') {
        S.showLines = !S.showLines;
        document.getElementById('linesLabel').textContent = S.showLines ? "Don't Show Lines" : 'Show Lines';
      } else if (action === 'toggleMode') {
        S.mode = S.mode === 'TPT' ? 'FPT' : 'TPT';
        S.taker.root.setEnabled(S.mode === 'TPT');
        document.getElementById('modeLabel').textContent = S.mode === 'TPT' ? 'FPT Mode' : 'TPT Mode';
        S.scene.activeCamera = S.mode === 'TPT' ? S.cameras.tpt : S.cameras.fpt;
        showToast(`${S.mode} Mode`);
      } else if (action === 'exit') {
        S?.engine.stopRenderLoop();
        S = null;
        navigate('/games');
      }
    };
  });

  document.getElementById('replayPlayPause')?.addEventListener('click', (e) => {
    const icon = e.currentTarget.querySelector('i');
    if (icon.classList.contains('fa-pause')) {
      S.replay.stop();
      icon.classList.remove('fa-pause');
      icon.classList.add('fa-play');
    } else {
      S.replay.play(getActiveCam(), Number(document.getElementById('replaySpeed').value));
      icon.classList.remove('fa-play');
      icon.classList.add('fa-pause');
    }
  });
  document.getElementById('replaySkip')?.addEventListener('click', () => {
    S.replay.stop();
    hideReplayBar();
    setTimeout(resetForNextShot, 300);
  });
  document.getElementById('replaySpeed')?.addEventListener('change', (e) => {
    S.replay.setSpeed(Number(e.target.value));
  });
  document.getElementById('replayCamBtn')?.addEventListener('click', () => {
    const cams = S.replay.getAvailableCameras();
    const cur = cams.findIndex(c => c.key === getActiveCam());
    const next = cams[(cur + 1) % cams.length];
    S.replay.switchCamera(next.key);
    showToast(next.label);
  });

  document.getElementById('claimObjective')?.addEventListener('click', async () => {
    const r = await fetch('/api/bonus?action=objective', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: getDeviceId(),
        objectiveId: S.objectives.current.id,
        claim: true
      })
    });
    const d = await r.json();
    if (!r.ok) return showToast(d.error);
    if (d.user) setCurrentUser(d.user);
    showToast(`+${money(d.reward)}`);
    renderFootball();
  });
}

function getActiveCam() {
  const cam = S.scene.activeCamera;
  for (const [k, v] of Object.entries(S.cameras)) if (v === cam) return k;
  return 'tpt';
}

function showPortionsFlash() {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:15;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div id="portionGrid" style="display:grid;grid-template-columns:repeat(3,60px);grid-template-rows:repeat(3,45px);gap:4px;position:absolute;top:50%;left:50%;transform:translate(-50%,-70%);">
      ${Array.from({ length: 9 }, (_, i) => {
        const colors = ['#ef4444','#f59e0b','#eab308','#84cc16','#10b981','#06b6d4','#3b82f6','#8b5cf6','#ec4899'];
        return `<div class="portionCell" data-portion="${i}" style="background:${colors[i]}33;border:2px solid ${colors[i]};border-radius:6px;display:flex;align-items:center;justify-content:center;color:${colors[i]};font-weight:900;font-size:11px;opacity:0;">${money(S.portions[i])}</div>`;
      }).join('')}
    </div>
  `;
  document.getElementById('fbOverlay').appendChild(overlay);

  const cells = overlay.querySelectorAll('.portionCell');
  const startT = performance.now();
  const flashInterval = setInterval(() => {
    cells.forEach(c => c.style.opacity = '0');
    const idx = Math.floor(Math.random() * 9);
    cells[idx].style.opacity = '1';
    if (performance.now() - startT > 3000) {
      clearInterval(flashInterval);
      cells.forEach(c => c.style.opacity = '0.25');
      overlay.style.transition = 'opacity 0.5s';
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 600);
      document.getElementById('swipeHint').textContent = 'Swipe to shoot';
    }
  }, 250);
}

function attachSwipeHandlers(canvas) {
  canvas.addEventListener('pointerdown', (e) => {
    if (S.isAnimating || S.isReplaying) return;
    S.swipeStart = { x: e.clientX, y: e.clientY };
    S.swipePath = [{ x: e.clientX, y: e.clientY }];
    drawSwipeLine();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!S.swipeStart) return;
    S.swipePath.push({ x: e.clientX, y: e.clientY });
    drawSwipeLine();
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!S.swipeStart) return;
    S.swipeEnd = { x: e.clientX, y: e.clientY };
    const dx = S.swipeEnd.x - S.swipeStart.x;
    const dy = S.swipeEnd.y - S.swipeStart.y;

    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
      S.swipeStart = null;
      clearSwipeLine();
      return;
    }

    const idx = pickPortionFromSwipe(S.swipeEnd.x, S.swipeEnd.y);
    S.currentShot.portion = idx;
    S.currentShot.amount = S.portions[idx];
    const curve = detectCurve(S.swipePath);
    executeShot(dx, dy, curve);
    clearSwipeLine();
    S.swipeStart = null;
  });
}

function pickPortionFromSwipe(x, y) {
  const grid = document.getElementById('portionGrid');
  if (!grid) return 4;
  const rect = grid.getBoundingClientRect();
  const col = Math.min(2, Math.max(0, Math.floor((x - rect.left) / (rect.width / 3))));
  const row = Math.min(2, Math.max(0, Math.floor((y - rect.top) / (rect.height / 3))));
  return row * 3 + col;
}

function detectCurve(path) {
  if (path.length < 5) return 0;
  const mid = path[Math.floor(path.length / 2)];
  const start = path[0];
  const end = path[path.length - 1];
  const lineMidX = (start.x + end.x) / 2;
  const deviation = mid.x - lineMidX;
  if (Math.abs(deviation) < 30) return 0;
  return deviation > 0 ? 1 : -1;
}

function drawSwipeLine() {
  if (!S.showLines) return;
  clearSwipeLine();
  const overlay = document.getElementById('fbOverlay');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:14;';

  const path = S.swipePath;
  if (path.length < 2) return;
  const d = path.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  const outer = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  outer.setAttribute('d', d);
  outer.setAttribute('stroke', '#a855f7');
  outer.setAttribute('stroke-width', '6');
  outer.setAttribute('fill', 'none');
  outer.setAttribute('stroke-linecap', 'round');
  outer.setAttribute('opacity', '0.35');
  outer.setAttribute('filter', 'blur(4px)');

  const inner = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  inner.setAttribute('d', d);
  inner.setAttribute('stroke', '#c084fc');
  inner.setAttribute('stroke-width', '3');
  inner.setAttribute('fill', 'none');
  inner.setAttribute('stroke-linecap', 'round');

  svg.appendChild(outer);
  svg.appendChild(inner);
  svg.id = 'swipeLineSvg';
  overlay.appendChild(svg);
}

function clearSwipeLine() {
  document.getElementById('swipeLineSvg')?.remove();
}

async function executeShot(dx, dy, curve) {
  S.isAnimating = true;
  S.taker.root.setEnabled(S.mode === 'TPT');
  if (S.mode === 'FPT') S.taker.root.setEnabled(false);

  const power = Math.min(1, Math.hypot(dx, dy) / 250);
  const velZ = 10 + power * 10;
  const velX = (dx / 250) * 6;
  const velY = -(dy / 250) * 6;

  const curveVec = curve === 0 ? new BABYLON.Vector3(0, 0, 0)
                : new BABYLON.Vector3(curve * 3.5, 0, 0);

  const keeperChoice = chooseKeeperDive(S.currentShot.portion, curve);

  S.replay.capture();

  const onKick = () => {
    S.ballCtrl.applyShot(new BABYLON.Vector3(velX, velY + 2, velZ), { curve: curveVec });
    S.keeper.dive(keeperChoice.direction, keeperChoice.style);
  };

  if (S.mode === 'TPT') {
    S.taker.runup(onKick);
  } else {
    onKick();
  }

  S.activeShot = { dx, dy, curve, keeperChoice, recorded: false };
}

function chooseKeeperDive(portion, curve) {
  const col = portion % 3;
  const row = Math.floor(portion / 3);
  let direction;
  const r = Math.random();

  if (r < 0.6) {
    direction = col === 0 ? 'left' : col === 2 ? 'right' : 'center';
  } else {
    direction = col === 0 ? 'right' : col === 2 ? 'left' : (Math.random() < 0.5 ? 'left' : 'right');
  }

  let style;
  if (row === 0) style = 'high';
  else if (row === 2) style = 'low';
  else style = 'kneel';

  return { direction, style };
}

function checkShotOutcome() {
  if (!S.activeShot || !S.ballCtrl.isSpinning()) return;

  const b = S.ball.position;
  const v = S.ballCtrl.getVelocity();

  if (b.z > 0.3 && !S.activeShot.recorded) {
    S.activeShot.recorded = true;
    S.ballCtrl.stop();

    const W = 7.32 / 2, H = 2.44;
    const inX = b.x > -W && b.x < W;
    const inY = b.y > 0 && b.y < H;
    const keeperPos = S.keeper.root.position;
    const keeperDist = Math.hypot(b.x - keeperPos.x, b.y - (1.5 + keeperPos.y));

    let outcome = 'goal';
    if (!inX || !inY) outcome = 'miss';
    else if (keeperDist < 0.9) outcome = 'save';

    finalizeShot(outcome);
  }

  if (Math.abs(v.x) < 0.1 && Math.abs(v.y) < 0.1 && Math.abs(v.z) < 0.1 && S.activeShot && !S.activeShot.recorded) {
    S.activeShot.recorded = true;
    S.ballCtrl.stop();
    finalizeShot('miss');
  }
}

async function finalizeShot(outcome) {
  S.currentShot.outcome = outcome;

  if (outcome === 'goal') {
    const flash = document.getElementById('goalFlash');
    flash.style.opacity = '1';
    setTimeout(() => { flash.style.transition = 'opacity 0.5s'; flash.style.opacity = '0'; }, 900);
  } else {
    const flash = document.getElementById('missFlash');
    flash.textContent = outcome === 'save' ? 'SAVED' : 'MISSED';
    flash.style.opacity = '1';
    setTimeout(() => { flash.style.transition = 'opacity 0.5s'; flash.style.opacity = '0'; }, 1200);
  }

  try {
    const res = await submitShot({
      takerId: S.takerData.id,
      portion: S.currentShot.portion,
      amount: S.currentShot.amount,
      outcome
    });

    if (outcome === 'goal') {
      const banner = document.getElementById('footballHud');
      const float = document.createElement('div');
      float.textContent = `+${money(res.reward)}`;
      float.style.cssText = 'position:absolute;top:60px;right:20px;color:#10b981;font-weight:900;font-size:22px;text-shadow:0 2px 8px black;pointer-events:none;z-index:20;animation:floatUp 1.5s ease-out forwards;';
      banner.parentElement.appendChild(float);
      setTimeout(() => float.remove(), 1600);
      const b = await refreshWallet();
      const balanceEl = document.querySelector('#footballHud > div:first-child > div:nth-child(2)');
      if (balanceEl) balanceEl.innerHTML = `<i class="fas fa-wallet"></i> ${money(b)}`;
    } else if (outcome === 'save') {
      showToast(`-${money(res.penalty)}`);
    } else {
      showToast('Missed');
    }
  } catch (err) {
    showToast(err.message);
  }

  S.lastShot = { ...S.currentShot };

  setTimeout(() => {
    playReplay(S.lastShot);
  }, 800);
}

async function playReplay(shot) {
  S.isReplaying = true;
  const bar = document.getElementById('replayBar');
  bar.style.display = 'block';

  const icon = document.getElementById('replayPlayPause').querySelector('i');
  icon.classList.remove('fa-play');
  icon.classList.add('fa-pause');

  S.replay.play('tpt', 0.6, {
    onFinish: () => {
      icon.classList.remove('fa-pause');
      icon.classList.add('fa-play');
      S.isReplaying = false;
      hideReplayBar();
      setTimeout(resetForNextShot, 400);
    }
  });
}

function hideReplayBar() {
  const bar = document.getElementById('replayBar');
  if (bar) bar.style.display = 'none';
}

function resetForNextShot() {
  S.ballCtrl.reset();
  S.ball.position = new BABYLON.Vector3(0, 0.22, -5.5);
  S.taker.root.position = new BABYLON.Vector3(0, 0, -8);
  S.keeper.reset();
  S.scene.activeCamera = S.mode === 'TPT' ? S.cameras.tpt : S.cameras.fpt;
  S.taker.root.setEnabled(S.mode === 'TPT');
  S.isAnimating = false;
  S.activeShot = null;
  S.currentShot = { taker: null, portion: -1, outcome: null, amount: 0 };

  loadFootballConfig().then(c => {
    S.objectives.current = c.objective;
    S.objectives.progress = c.objectiveProgress;
    const existing = document.getElementById('objectiveBanner');
    if (existing) existing.outerHTML = renderObjectiveBanner(c.objective, c.objectiveProgress);
    attachObjectiveClaim();
  });

  showPortionsFlash();
}

function attachObjectiveClaim() {
  document.getElementById('claimObjective')?.addEventListener('click', async () => {
    const r = await fetch('/api/bonus?action=objective', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: getDeviceId(), objectiveId: S.objectives.current.id, claim: true })
    });
    const d = await r.json();
    if (!r.ok) return showToast(d.error);
    if (d.user) setCurrentUser(d.user);
    showToast(`+${money(d.reward)}`);
    resetForNextShot();
  });
}
