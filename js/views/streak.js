import { getDeviceId } from '../auth.js';
import { money } from '../format.js';

export async function renderStreak() {
  const el = document.getElementById('viewContainer');
  el.innerHTML = `<div style="padding:40px;text-align:center;"><i class="fas fa-spinner fa-spin"></i></div>`;

  const deviceId = getDeviceId();
  let data;
  try {
    const res = await fetch(`/api/bonus/streak?deviceId=${encodeURIComponent(deviceId)}`);
    data = await res.json();
  } catch { data = { weeks: [] }; }

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h2 style="font-size:22px;font-weight:bold;">Streaks & Streak Record</h2>
      <button id="closeStreak" class="wb-close"><i class="fas fa-close"></i></button>
    </div>

    <div class="wb-card" style="background:linear-gradient(135deg,#3ba072,#154c00);color:white;text-align:center;margin-bottom:16px;">
      <p style="font-size:13px;opacity:0.9;">Current Streak</p>
      <p style="font-size:40px;font-weight:bold;">Day ${data.streakDay || 0}</p>
      <p style="font-size:13px;opacity:0.9;margin-top:8px;">Total earned from streaks: ${money(data.totalEarned || 0)}</p>
    </div>

    <div id="weeksWrap" style="display:flex;flex-direction:column;gap:12px;"></div>
  `;

  const wrap = document.getElementById('weeksWrap');

  if (!data.weeks || data.weeks.length === 0) {
    wrap.innerHTML = `<div class="wb-card" style="text-align:center;color:var(--text-secondary);">No streaks yet. Claim your daily bonus to start!</div>`;
  } else {
    data.weeks.forEach(w => {
      const card = document.createElement('div');
      card.className = 'wb-card';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;" class="week-head">
          <div style="display:flex;align-items:center;gap:8px;">
            <strong>${w.label}</strong>
            ${w.pendingCount > 0 ? `<span style="background:#ef4444;color:white;font-size:11px;padding:2px 8px;border-radius:10px;">${w.pendingCount}</span>` : ''}
          </div>
          <i class="fas fa-chevron-down week-arrow" style="transition:transform 0.2s;"></i>
        </div>
        <div class="week-body" style="display:none;margin-top:14px;border-top:1px solid var(--border-color);padding-top:12px;">
          ${w.days.map(d => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;${d.claimed ? 'opacity:0.5;' : ''}">
              <div style="display:flex;align-items:center;gap:8px;">
                ${d.claimed ? '<i class="fas fa-check-circle" style="color:#10b981;"></i>' : '<i class="far fa-circle" style="color:var(--text-secondary);"></i>'}
                <span>Day ${d.day}</span>
              </div>
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-weight:600;">${money(d.amount)}</span>
                ${!d.claimed ? `<button class="claim-day" data-day="${d.day}" style="padding:6px 12px;background:var(--green);color:white;border:none;border-radius:8px;font-size:12px;cursor:pointer;">Claim</button>` : ''}
              </div>
            </div>
          `).join('')}
          <p style="margin-top:12px;font-size:13px;color:var(--text-secondary);text-align:center;">
            ${w.allClaimed ? 'All rewards claimed' : `${w.pendingCount} are not claimed`}
          </p>
        </div>
      `;
      const head = card.querySelector('.week-head');
      const body = card.querySelector('.week-body');
      const arrow = card.querySelector('.week-arrow');
      head.addEventListener('click', () => {
        const open = body.style.display === 'block';
        body.style.display = open ? 'none' : 'block';
        arrow.style.transform = open ? '' : 'rotate(180deg)';
      });
      wrap.appendChild(card);
    });
  }

  document.getElementById('closeStreak').addEventListener('click', () => history.back());
}
