import { navigate } from '../router.js';
import { money } from '../format.js';
import { apiFetch } from '../lib/api.js';

const LABELS = [
  { key: 'all', label: 'All' },
  { key: 'referrals', label: 'Referrals' },
  { key: 'follows', label: 'Follows' },
  { key: 'reels', label: 'Reels' },
  { key: 'games', label: 'Games' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'bonus', label: 'Bonus' }
];

export async function renderER(label = 'all') {
  const el = document.getElementById('viewContainer');
  el.innerHTML = `<div style="padding:40px;text-align:center;"><i class="fas fa-spinner fa-spin"></i></div>`;

  let data;
  try {
    data = await apiFetch(`/api/users?action=er&label=${encodeURIComponent(label)}`);
  } catch (error) {
    el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-secondary);">${error.message || 'Unable to load earning records'}</div>`;
    return;
  }

  const summary = data.summary || {};
  const active = label === 'all'
    ? { items: data.all || [], total: (data.all || []).reduce((s, t) => s + Number(t.amount), 0) }
    : data.data || { items: [], total: 0 };

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h2 style="font-size:22px;font-weight:bold;">Earning Records</h2>
      <button id="closeER" class="wb-close"><i class="fas fa-close"></i></button>
    </div>

    <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:10px;margin-bottom:16px;">
      ${LABELS.map(l => `
        <button class="erTab" data-label="${l.key}" style="flex-shrink:0;padding:8px 14px;border-radius:20px;border:none;background:${label === l.key ? 'var(--green)' : 'var(--bg-secondary)'};color:${label === l.key ? 'white' : 'var(--text-primary)'};font-weight:600;font-size:13px;cursor:pointer;">${l.label}</button>
      `).join('')}
    </div>

    <div class="wb-card" style="background:linear-gradient(135deg,#3ba072,#154c00);color:white;text-align:center;margin-bottom:16px;">
      <p style="font-size:13px;opacity:0.9;">Total (${label})</p>
      <p style="font-size:32px;font-weight:bold;">${money(active.total)}</p>
    </div>

    <div id="erList">
      ${active.items.length === 0 ? '<p style="text-align:center;color:var(--text-secondary);padding:40px;">No earnings in this category</p>' :
        active.items.map(t => `
          <div class="wb-card" style="display:flex;justify-content:space-between;padding:14px;margin-bottom:8px;">
            <div style="flex:1;">
              <p style="font-weight:600;font-size:14px;">${t.description || 'Earning'}</p>
              <p style="font-size:11px;color:var(--text-secondary);margin-top:2px;">${new Date(t.created_at).toLocaleString()}</p>
            </div>
            <p style="font-weight:bold;color:#10b981;font-size:15px;">+${money(t.amount)}</p>
          </div>
        `).join('')}
    </div>
  `;

  document.getElementById('closeER').onclick = () => navigate('/settings');
  document.querySelectorAll('.erTab').forEach(t => {
    t.onclick = () => renderER(t.dataset.label);
  });
}
