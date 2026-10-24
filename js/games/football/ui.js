import { money } from '../../format.js';

export function renderTakerSelect(takers, onSelect) {
  const el = document.getElementById('viewContainer');
  el.style.padding = '0';
  el.innerHTML = `
    <div style="background:var(--purple);min-height:100dvh;padding:20px;padding-top:calc(20px + env(safe-area-inset-top));color:white;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <h2 style="font-size:22px;font-weight:bold;">Select your Taker</h2>
        <button id="closeSelect" style="background:none;border:none;color:white;font-size:22px;cursor:pointer;"><i class="fas fa-close"></i></button>
      </div>
      <div id="takersGrid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;"></div>
    </div>
  `;

  const grid = document.getElementById('takersGrid');
  takers.forEach(t => {
    const card = document.createElement('button');
    card.style.cssText = `
      aspect-ratio: 1; background: linear-gradient(145deg, #1a1a3a, #2d2d5a);
      border: 2px solid rgba(255,255,255,0.15); border-radius: 10px;
      cursor: pointer; overflow: hidden; position: relative; padding: 0;
      color: white; display: flex; flex-direction: column;
    `;
    card.innerHTML = `
      <div style="flex:1;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle,#3ba07233,#0000);">
        ${t.image_url ? `<img src="${t.image_url}" alt="${t.name} placeholder" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
        <span style="${t.image_url ? 'display:none;' : 'display:flex;'}width:100%;height:100%;align-items:center;justify-content:center;font-size:26px;font-weight:900;color:white;">${t.number}</span>
      </div>
      <div style="background:rgba(0,0,0,0.5);padding:4px 2px;text-align:center;">
        <p style="font-size:10px;font-weight:700;line-height:1.1;">${t.name}</p>
        <p style="font-size:9px;opacity:0.7;">#${t.number} · ${t.dominant_foot}${t.dominant_foot === 'L' ? 'eft' : 'ight'}</p>
      </div>
    `;
    card.onclick = () => {
      grid.querySelectorAll('button').forEach(button => { button.disabled = true; button.style.opacity = '0.65'; });
      onSelect(t);
    };
    grid.appendChild(card);
  });

  document.getElementById('closeSelect').onclick = () => window.history.back();
}

export function renderObjectiveBanner(objective, progress) {
  if (!objective) return '';
  const prog = progress?.progress || 0;
  const done = progress?.completed;
  const failed = progress?.failed;
  let icon = '';
  if (done) icon = '<i class="fas fa-check-circle" style="color:#10b981;"></i>';
  else if (failed) icon = '<i class="fas fa-times-circle" style="color:#ef4444;"></i>';

  return `
    <div id="objectiveBanner" style="position:absolute;top:calc(64px + env(safe-area-inset-top));left:12px;right:12px;background:rgba(0,0,0,0.7);color:white;border-radius:12px;padding:10px 14px;font-size:12px;z-index:20;backdrop-filter:blur(8px);">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span><i class="fas fa-bullseye"></i> ${objective.title}</span>
        <span>${icon}</span>
      </div>
      <p style="font-size:11px;opacity:0.8;margin-top:4px;">${objective.description || ''}</p>
      <div style="display:flex;justify-content:space-between;margin-top:6px;">
        <span>Progress: ${prog}</span>
        <span style="color:#fcd34d;">Reward: ${money(objective.reward)}</span>
      </div>
      ${done && !progress.claimed ? `
        <button id="claimObjective" style="margin-top:8px;background:var(--green);color:white;padding:6px 12px;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:12px;">Claim</button>
      ` : ''}
    </div>
  `;
}

export function renderFootballUI(state, handlers) {
  return `
    <div id="footballHud" style="position:absolute;inset:0;pointer-events:none;z-index:10;">
      <!-- Top bar -->
      <div style="position:absolute;top:0;left:0;right:0;padding:14px;padding-top:calc(14px + env(safe-area-inset-top));display:flex;justify-content:space-between;align-items:center;">
        <button id="fbClose" style="pointer-events:auto;background:rgba(0,0,0,0.55);border:none;color:white;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:16px;"><i class="fas fa-close"></i></button>
        <div style="background:rgba(0,0,0,0.55);padding:8px 14px;border-radius:20px;color:white;font-weight:700;font-size:14px;">
          <i class="fas fa-wallet"></i> ${money(state.balance)}
        </div>
        <button id="fbMore" style="pointer-events:auto;background:rgba(0,0,0,0.55);border:none;color:white;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:16px;"><i class="fas fa-ellipsis-vertical"></i></button>
      </div>

      <!-- Goal flash -->
      <div id="goalFlash" style="position:absolute;top:40%;left:50%;transform:translate(-50%,-50%);color:white;font-size:80px;font-weight:900;text-shadow:0 4px 20px rgba(0,0,0,0.7);opacity:0;pointer-events:none;letter-spacing:6px;">GOAL</div>

      <!-- Save / miss flash -->
      <div id="missFlash" style="position:absolute;top:40%;left:50%;transform:translate(-50%,-50%);color:#ef4444;font-size:64px;font-weight:900;text-shadow:0 4px 20px rgba(0,0,0,0.7);opacity:0;pointer-events:none;letter-spacing:4px;">SAVED</div>

      <!-- Instruction -->
      <div id="swipeHint" style="position:absolute;bottom:140px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.6);color:white;padding:8px 16px;border-radius:20px;font-size:12px;pointer-events:none;">
        Swipe to shoot
      </div>

      <!-- Replay controls -->
      <div id="replayBar" style="position:absolute;bottom:20px;left:12px;right:12px;background:rgba(0,0,0,0.75);color:white;padding:10px;border-radius:14px;display:none;pointer-events:auto;">
        <div style="display:flex;align-items:center;gap:10px;">
          <button id="replayPlayPause" style="background:none;border:none;color:white;font-size:18px;cursor:pointer;"><i class="fas fa-play"></i></button>
          <div style="flex:1;height:4px;background:rgba(255,255,255,0.2);border-radius:2px;position:relative;">
            <div id="replayProgress" style="height:100%;width:0%;background:var(--green);border-radius:2px;"></div>
          </div>
          <select id="replaySpeed" style="background:transparent;color:white;border:1px solid #666;border-radius:6px;padding:2px 6px;font-size:12px;">
            <option value="0.25">0.25x</option>
            <option value="0.5">0.5x</option>
            <option value="0.75">0.75x</option>
            <option value="1" selected>1x</option>
            <option value="1.25">1.25x</option>
          </select>
          <button id="replayCamBtn" style="background:none;border:none;color:white;font-size:14px;cursor:pointer;"><i class="fas fa-video"></i></button>
          <button id="replaySkip" style="background:none;border:none;color:white;font-size:14px;cursor:pointer;"><i class="fas fa-forward"></i></button>
        </div>
      </div>

      <!-- More menu -->
      <div id="fbMoreMenu" style="display:none;pointer-events:auto;position:absolute;top:calc(70px + env(safe-area-inset-top));right:14px;background:rgba(20,20,20,0.95);color:white;border-radius:12px;padding:8px;min-width:220px;">
        <button class="fbMenuBtn" data-action="replay" style="display:block;width:100%;text-align:left;background:none;border:none;color:white;padding:10px;border-radius:8px;cursor:pointer;font-size:14px;"><i class="fas fa-history"></i> Replay last shot</button>
        <button class="fbMenuBtn" data-action="toggleLines" style="display:block;width:100%;text-align:left;background:none;border:none;color:white;padding:10px;border-radius:8px;cursor:pointer;font-size:14px;"><i class="fas fa-eye"></i> <span id="linesLabel">Don't Show Lines</span></button>
        <button class="fbMenuBtn" data-action="toggleMode" style="display:block;width:100%;text-align:left;background:none;border:none;color:white;padding:10px;border-radius:8px;cursor:pointer;font-size:14px;"><i class="fas fa-user"></i> <span id="modeLabel">FPT Mode</span></button>
        <button class="fbMenuBtn" data-action="exit" style="display:block;width:100%;text-align:left;background:none;border:none;color:#ef4444;padding:10px;border-radius:8px;cursor:pointer;font-size:14px;"><i class="fas fa-sign-out-alt"></i> Exit</button>
      </div>
    </div>
  `;
}
