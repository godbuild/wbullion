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
import { apiFetch } from '../../lib/api.js';

let S = null;

function generateFallbackTakers() {
  // create 10 takers with 5 left-footed and 5 right-footed, random names
  const names = ['Ade', 'Bola', 'Chike', 'Dayo', 'Emeka', 'Femi', 'Gani', 'Hauwa', 'Ife', 'Jide'];
  const takers = names.map((n, i) => ({
    id: `local_${i}`,
    name: n,
    number: i + 1,
    dominant_foot: i % 2 === 0 ? 'L' : 'R',
    jersey_color: i % 2 === 0 ? '#3ba072' : '#7c3aed'
  }));
  return takers;
}

export async function renderFootball() {
  const el = document.getElementById('viewContainer');
  document.body.classList.add('football-active');
  el.classList.add('full-bleed-view');
  el.style.padding = '0';
  el.style.minHeight = '100dvh';
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
    // fallback: generate a minimal client config so UI still works
    const takers = generateFallbackTakers();
    config = {
      takers,
      wallet: { balance: 0 },
      objective: null,
      objectiveProgress: null
    };
    // log error but continue
    console.error('[football] failed to load config, using fallback', err);
  }

  // If takers still missing, use fallback
  if (!config.takers || config.takers.length === 0) {
    config.takers = generateFallbackTakers();
  }

  config.takers = config.takers.map((taker, index) => ({
    ...taker,
    id: taker.id || `fallback-${index + 1}`,
    name: taker.name || `Taker ${index + 1}`,
    number: Number.isFinite(Number(taker.number)) ? Number(taker.number) : index + 1,
    dominant_foot: String(taker.dominant_foot || 'R').toUpperCase() === 'L' ? 'L' : 'R',
    jersey_color: /^#[0-9a-f]{6}$/i.test(String(taker.jersey_color || '')) ? taker.jersey_color : '#3ba072'
  }));
  renderTakerSelect(config.takers, (taker) => startGame(config, taker));
}

async function startGame(config, takerData) {
  const el = document.getElementById('viewContainer');
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  el.innerHTML = `
    <div class="football-stage" style="position:fixed;inset:0;background:#000;overflow:hidden;">
      <canvas id="fbCanvas" style="width:100%;height:100%;display:block;touch-action:none;"></canvas>
      <div id="fbOverlay"></div>
    </div>
  `;

  try {
    await loadBabylon();
  } catch (err) {
    console.error('[football] Babylon load error', err);
    el.innerHTML = `
      <div style="min-height:100dvh;background:linear-gradient(160deg,#241044,#111827);color:white;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;">
        <div><i class="fas fa-triangle-exclamation" style="font-size:42px;color:#fbbf24;margin-bottom:16px;"></i><h3>Football shootout unavailable</h3><p style="opacity:.8;margin:10px 0 20px;">The 3D game engine could not load. Check your connection and try again.</p><button id="footballRetry" class="wb-btn-primary">Try again</button><button id="footballBack" class="wb-btn-secondary" style="margin-left:8px;">Back to games</button></div>
      </div>`;
    document.getElementById('footballRetry')?.addEventListener('click', renderFootball);
    document.getElementById('footballBack')?.addEventListener('click', () => navigate('/games'));
    return;
  }

  const canvas = document.getElementById('fbCanvas');
  let engine = null, scene = null, cameras = null;
  try {
    const sceneObj = createScene(canvas, { isDark });
    engine = sceneObj.engine;
    scene = sceneObj.scene;
    cameras = sceneObj.cameras;
  } catch (err) {
    console.error('[football] createScene error', err);
    el.innerHTML = `
      <div style="min-height:100dvh;background:linear-gradient(160deg,#241044,#111827);color:white;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;">
        <div><h3>Football shootout could not start</h3><p style="opacity:.8;margin:10px 0 20px;">Your device does not support the required 3D graphics mode.</p><button id="footballRetry" class="wb-btn-primary">Try again</button><button id="footballBack" class="wb-btn-secondary" style="margin-left:8px;">Back to games</button></div>
      </div>`;
    document.getElementById('footballRetry')?.addEventListener('click', () => startGame(config, takerData));
    document.getElementById('footballBack')?.addEventListener('click', () => navigate('/games'));
    return;
  }

  let goal, ball, keeper, taker;
  try {
    goal = createGoalpost(scene, { logoTextureUrl: '/images/logo.png' });
    ball = createBall(scene, '/images/logo.png');
    keeper = createKeeper(scene);
    const safeColor = /^#[0-9a-f]{6}$/i.test(String(takerData?.jersey_color || ''))
      ? takerData.jersey_color
      : '#3ba072';
    taker = createTaker(scene, {
      name: takerData?.name || 'Taker',
      number: Number.isFinite(Number(takerData?.number)) ? Number(takerData.number) : 9,
      dominantFoot: String(takerData?.dominant_foot || 'R').toUpperCase() === 'L' ? 'L' : 'R',
      jerseyColor: safeColor
    });
  } catch (err) {
    console.error('[football] object creation error', err?.stack || err);
    try { engine.stopRenderLoop(); engine.dispose(); } catch {}
    el.innerHTML = `
      <div style="min-height:100dvh;background:linear-gradient(160deg,#241044,#111827);color:white;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;">
        <div><h3>Football shootout could not start</h3><p style="opacity:.8;margin:10px 0 20px;">We could not load this taker. You can retry without losing your selection.</p><button id="footballRetry" class="wb-btn-primary">Retry taker</button><button id="footballBack" class="wb-btn-secondary" style="margin-left:8px;">Back to games</button></div>
      </div>`;
    document.getElementById('footballRetry')?.addEventListener('click', () => startGame(config, takerData));
    document.getElementById('footballBack')?.addEventListener('click', () => navigate('/games'));
    return;
  }

  const ballCtrl = createBallController(scene, ball);
  const replay = createReplayController(scene, cameras, ball, taker, keeper, goal);

  // Odds: use apiFetch to centralize auth/error handling
  let oddsData = {};
  try {
    oddsData = await apiFetch('/api/games?action=odds', {
      method: 'POST',
      body: JSON.stringify({ deviceId: getDeviceId(), game: 'football' })
    });
  } catch (err) {
    // fallback random portions
    oddsData = { portions: Array.from({ length: 9 }, () => Math.floor(Math.random() * 61) + 120) };
  }
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
      current: (config && config.objective) || null,
      progress: (config && config.objectiveProgress) || null
    },
    resizeHandler: () => { try { engine.resize(); } catch {} }
  };

  const overlayRoot = document.getElementById('fbOverlay');
  if (overlayRoot) {
    overlayRoot.innerHTML =
      renderFootballUI({ balance: (config && config.wallet && config.wallet.balance) || 0 }, {}) +
      renderObjectiveBanner(S.objectives.current, S.objectives.progress);
  }

  attachHudHandlers();
  attachSwipeHandlers(canvas);
  showPortionsFlash();

  try {
    engine.runRenderLoop(() => {
      try {
        const dt = engine.getDeltaTime() / 1000;
        ballCtrl.update(dt);
        checkShotOutcome();
        scene.render();
      } catch (e) {
        console.error('[football] render loop error', e);
      }
    });
  } catch (err) {
    console.error('[football] engine runRenderLoop error', err);
  }

  window.addEventListener('resize', S.resizeHandler);
}

function cleanupFootballEngine() {
  try {
    if (!S) return;
    if (S.engine) {
      try { S.engine.stopRenderLoop(); } catch {}
      try { S.engine.dispose(); } catch {}
      S.engine = null;
    }
    if (S.resizeHandler) window.removeEventListener('resize', S.resizeHandler);
    S = null;
  } catch (err) {
    console.error('[football] cleanup error', err);
  }
}

function attachHudHandlers() {
  document.getElementById('fbClose')?.addEventListener('click', () => {
    cleanupFootballEngine();
    navigate('/games');
  });

  document.getElementById('fbMore')?.addEventListener('click', () => {
    const menu = document.getElementById('fbMoreMenu');
    if (!menu) return;
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  });

  document.querySelectorAll('.fbMenuBtn').forEach(btn => {
    btn.onclick = () => {
      const action = btn.dataset.action;
      const menu = document.getElementById('fbMoreMenu');
      if (menu) menu.style.display = 'none';

      if (action === 'replay') {
        if (!S.lastShot) return showToast('No previous shot');
        playReplay(S.lastShot);
      } else if (action === 'toggleLines') {
        S.showLines = !S.showLines;
        const label = document.getElementById('linesLabel');
        if (label) label.textContent = S.showLines ? "Don't Show Lines" : 'Show Lines';
      } else if (action === 'toggleMode') {
        S.mode = S.mode === 'TPT' ? 'FPT' : 'TPT';
        try { S.taker.root.setEnabled(S.mode === 'TPT'); } catch {}
        const modeLabel = document.getElementById('modeLabel');
        if (modeLabel) modeLabel.textContent = S.mode === 'TPT' ? 'FPT Mode' : 'TPT Mode';
        try { S.scene.activeCamera = S.mode === 'TPT' ? S.cameras.tpt : S.cameras.fpt; } catch {}
        showToast(`${S.mode} Mode`);
      } else if (action === 'exit') {
        cleanupFootballEngine();
        navigate('/games');
      }
    };
  });

  document.getElementById('replayPlayPause')?.addEventListener('click', (e) => {
    const icon = e.currentTarget.querySelector('i');
    if (!icon) return;
    if (icon.classList.contains('fa-pause')) {
      S.replay.stop();
      icon.classList.remove('fa-pause');
      icon.classList.add('fa-play');
    } else {
      S.replay.play(getActiveCam(), Number(document.getElementById('replaySpeed')?.value || 1));
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
    try {
      const data = await apiFetch('/api/bonus?action=objective', {
        method: 'POST',
        body: JSON.stringify({
          deviceId: getDeviceId(),
          objectiveId: S.objectives.current?.id,
          claim: true
        })
      });
      if (data.user) setCurrentUser(data.user);
      showToast(`+${money(data.reward)}`);
      // update objective banner
      const c = await loadFootballConfig();
      S.objectives.current = c.objective;
      S.objectives.progress = c.objectiveProgress;
      const existing = document.getElementById('objectiveBanner');
      if (existing) existing.outerHTML = renderObjectiveBanner(c.objective, c.objectiveProgress);
    } catch (err) {
      showAlert(err.message || 'Objective claim failed', 'Error');
    }
  });
}

function getActiveCam() {
  const cam = S.scene?.activeCamera;
  for (const [k, v] of Object.entries(S.cameras || {})) if (v === cam) return k;
  return 'tpt';
}

function showPortionsFlash() {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:15;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div id="portionGrid" style="display:grid;grid-template-columns:repeat(3,60px);grid-template-rows:repeat(3,45px);gap:4px;position:absolute;top:50%;left:50%;transform:translate(-50%,-70%);">
      ${Array.from({ length: 9 }, (_, i) => {
        const colors = ['#ef4444','#f59e0b','#eab308','#84cc16','#10b981','#06b6d4','#3b82f6','#8b5cf6','#ec4899'];
        return `<div class="portionCell" data-portion="${i}" style="background:${colors[i]}33;border:2px solid ${colors[i]};border-radius:6px;display:flex;align-items:center;justify-content:center;width:60px;height:45px;"></div>`;
      }).join('')}
    </div>
  `;
  document.getElementById('fbOverlay')?.appendChild(overlay);

  const cells = overlay.querySelectorAll('.portionCell');
  const startT = performance.now();
  const flashInterval = setInterval(() => {
    cells.forEach(c => c.style.opacity = '0');
    const idx = Math.floor(Math.random() * 9);
    if (cells[idx]) cells[idx].style.opacity = '1';
    if (performance.now() - startT > 3000) {
      clearInterval(flashInterval);
      cells.forEach(c => c.style.opacity = '0.25');
      overlay.style.transition = 'opacity 0.5s';
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 600);
      const hint = document.getElementById('swipeHint');
      if (hint) hint.textContent = 'Swipe to shoot';
    }
  }, 250);
}

function attachSwipeHandlers(canvas) {
  canvas.addEventListener('pointerdown', (e) => {
    if (!S || S.isAnimating || S.isReplaying) return;
    S.swipeStart = { x: e.clientX, y: e.clientY };
    S.swipePath = [{ x: e.clientX, y: e.clientY }];
    drawSwipeLine();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!S || !S.swipeStart) return;
    S.swipePath.push({ x: e.clientX, y: e.clientY });
    drawSwipeLine();
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!S || !S.swipeStart) return;
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
  if (!S || !S.showLines) return;
  clearSwipeLine();
  const overlay = document.getElementById('fbOverlay');
  if (!overlay) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:14;';

  const path = S.swipePath || [];
  if (path.length < 2) return;
  const d = path.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  const outer = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  outer.setAttribute('d', d);
  outer.setAttribute('stroke', '#a855f7');
  outer.setAttribute('stroke-width', '6');
  outer.setAttribute('fill', 'none');
  outer.setAttribute('stroke-linecap', 'round');
  outer.setAttribute('opacity', '0.35');

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
  if (!S) return;
  S.isAnimating = true;
  try {
    S.taker.root.setEnabled(S.mode === 'TPT');
  } catch {}
  if (S.mode === 'FPT') try { S.taker.root.setEnabled(false); } catch {}

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
    try { S.keeper.dive(keeperChoice.direction, keeperChoice.style); } catch {}
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
  if (!S || !S.activeShot || !S.ballCtrl.isSpinning()) return;

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
  if (!S) return;
  S.currentShot.outcome = outcome;

  try {
    if (outcome === 'goal') {
      const flash = document.getElementById('goalFlash');
      if (flash) {
        flash.style.opacity = '1';
        setTimeout(() => { flash.style.transition = 'opacity 0.5s'; flash.style.opacity = '0'; }, 900);
      }
    } else {
      const flash = document.getElementById('missFlash');
      if (flash) {
        flash.textContent = outcome === 'save' ? 'SAVED' : 'MISSED';
        flash.style.opacity = '1';
        setTimeout(() => { flash.style.transition = 'opacity 0.5s'; flash.style.opacity = '0'; }, 1200);
      }
    }

    const res = await submitShot({
      takerId: S.takerData.id,
      portion: S.currentShot.portion,
      amount: S.currentShot.amount,
      outcome
    });

    if (outcome === 'goal') {
      const banner = document.getElementById('footballHud');
      if (banner) {
        const float = document.createElement('div');
        float.textContent = `+${money(res.reward)}`;
        float.style.cssText = 'position:absolute;top:60px;right:20px;color:#10b981;font-weight:900;font-size:22px;text-shadow:0 2px 8px black;pointer-events:none;z-index:20;animation:floatUp 1.5s ease;';
        banner.parentElement.appendChild(float);
        setTimeout(() => float.remove(), 1600);
      }
      const b = await refreshWallet();
      const balanceEl = document.querySelector('#footballHud > div:first-child > div:nth-child(2)');
      if (balanceEl) balanceEl.innerHTML = `<i class="fas fa-wallet"></i> ${money(b)}`;
    } else if (outcome === 'save') {
      showToast(`-${money(res.penalty)}`);
    } else {
      showToast('Missed');
    }
  } catch (err) {
    showToast(err.message || 'Shot submission failed');
  }

  S.lastShot = { ...S.currentShot };

  setTimeout(() => {
    playReplay(S.lastShot);
  }, 800);
}

async function playReplay(shot) {
  if (!S) return;
  S.isReplaying = true;
  const bar = document.getElementById('replayBar');
  if (bar) bar.style.display = 'block';

  const icon = document.getElementById('replayPlayPause')?.querySelector('i');
  if (icon) {
    icon.classList.remove('fa-play');
    icon.classList.add('fa-pause');
  }

  S.replay.play('tpt', 0.6, {
    onFinish: () => {
      const icon2 = document.getElementById('replayPlayPause')?.querySelector('i');
      if (icon2) {
        icon2.classList.remove('fa-pause');
        icon2.classList.add('fa-play');
      }
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
  if (!S) return;
  try { S.ballCtrl.reset(); } catch {}
  try { S.ball.position = new BABYLON.Vector3(0, 0.22, -5.5); } catch {}
  try { S.taker.root.position = new BABYLON.Vector3(0, 0, -8); } catch {}
  try { S.keeper.reset(); } catch {}
  try { S.scene.activeCamera = S.mode === 'TPT' ? S.cameras.tpt : S.cameras.fpt; } catch {}
  try { S.taker.root.setEnabled(S.mode === 'TPT'); } catch {}
  S.isAnimating = false;
  S.activeShot = null;
  S.currentShot = { taker: null, portion: -1, outcome: null, amount: 0 };

  loadFootballConfig().then(c => {
    if (!S) return;
    S.objectives.current = c.objective;
    S.objectives.progress = c.objectiveProgress;
    const existing = document.getElementById('objectiveBanner');
    if (existing) existing.outerHTML = renderObjectiveBanner(c.objective, c.objectiveProgress);
    attachObjectiveClaim();
  }).catch(() => { /* ignore */ });

  showPortionsFlash();
}

function attachObjectiveClaim() {
  document.getElementById('claimObjective')?.addEventListener('click', async () => {
    try {
      const d = await apiFetch('/api/bonus?action=objective', {
        method: 'POST',
        body: JSON.stringify({ deviceId: getDeviceId(), objectiveId: S.objectives.current?.id, claim: true })
      });
      if (d.user) setCurrentUser(d.user);
      showToast(`+${money(d.reward)}`);
      resetForNextShot();
    } catch (err) {
      showAlert(err.message || 'Objective claim failed', 'Error');
    }
  });
}
