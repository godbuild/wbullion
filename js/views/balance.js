import { getDeviceId } from '../auth.js';
import { money, comma } from '../format.js';

export async function renderBalance(type = 'all') {
  const el = document.getElementById('viewContainer');
  el.innerHTML = `<div style="padding:40px;text-align:center;"><i class="fas fa-spinner fa-spin"></i></div>`;

  const deviceId = getDeviceId();
  let txs = [];
  try {
    const res = await fetch(`/api/users?action=transactions&deviceId=${encodeURIComponent(deviceId)}&type=${type === 'all' ? '' : type}`);
    const data = await res.json();
    txs = data.transactions || [];
  } catch {}

  const credits = txs.filter(t => t.type === 'credit');
  const debits = txs.filter(t => t.type === 'debit');
  const totalCredits = credits.reduce((s, t) => s + Number(t.amount), 0);
  const totalDebits = debits.reduce((s, t) => s + Number(t.amount), 0);

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h2 style="font-size:22px;font-weight:bold;">Balance History</h2>
      <button id="closeBal" class="wb-close"><i class="fas fa-close"></i></button>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <button class="bal-tab ${type === 'all' ? 'active' : ''}" data-type="all" style="flex:1;padding:10px;border-radius:10px;border:none;font-weight:600;cursor:pointer;">All</button>
      <button class="bal-tab ${type === 'credit' ? 'active' : ''}" data-type="credit" style="flex:1;padding:10px;border-radius:10px;border:none;font-weight:600;cursor:pointer;">Credits</button>
      <button class="bal-tab ${type === 'debit' ? 'active' : ''}" data-type="debit" style="flex:1;padding:10px;border-radius:10px;border:none;font-weight:600;cursor:pointer;">Debits</button>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
      <div class="wb-card" style="text-align:center;">
        <p style="font-size:12px;color:var(--text-secondary);">Credits</p>
        <p style="font-size:16px;font-weight:bold;color:#10b981;">+${money(totalCredits)}</p>
      </div>
      <div class="wb-card" style="text-align:center;">
        <p style="font-size:12px;color:var(--text-secondary);">Debits</p>
        <p style="font-size:16px;font-weight:bold;color:#ef4444;">-${money(totalDebits)}</p>
      </div>
    </div>

    <div id="txList" style="display:flex;flex-direction:column;gap:8px;"></div>
  `;

  const list = document.getElementById('txList');
  if (txs.length === 0) {
    list.innerHTML = `<div class="wb-card" style="text-align:center;color:var(--text-secondary);">No transactions yet</div>`;
  } else {
    list.innerHTML = txs.map(t => {
      const isCredit = t.type === 'credit';
      return `
        <div class="wb-card" style="display:flex;justify-content:space-between;align-items:center;padding:14px;">
          <div style="flex:1;">
            <p style="font-weight:600;font-size:14px;">${t.description || 'Transaction'}</p>
            <p style="font-size:11px;color:var(--text-secondary);margin-top:2px;">${new Date(t.created_at).toLocaleString()}</p>
          </div>
          <div style="text-align:right;">
            <p style="font-weight:bold;font-size:15px;color:${isCredit ? '#10b981' : '#ef4444'};">
              <i class="fas fa-arrow-${isCredit ? 'up' : 'down'}"></i>
              ${isCredit ? '+' : '-'}${money(t.amount)}
            </p>
          </div>
        </div>
      `;
    }).join('');
  }

  document.querySelectorAll('.bal-tab').forEach(btn => {
    btn.style.background = btn.classList.contains('active') ? 'var(--green)' : 'var(--bg-secondary)';
    btn.style.color = btn.classList.contains('active') ? 'white' : 'var(--text-primary)';
    btn.addEventListener('click', () => renderBalance(btn.dataset.type));
  });

  document.getElementById('closeBal').addEventListener('click', () => history.back());
}
