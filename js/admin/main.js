// W Bullion Admin — Main entry

const API = '/api';
let deviceId = localStorage.getItem('wb_admin_device');
if (!deviceId) {
  deviceId = 'admin_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem('wb_admin_device', deviceId);
}

const adminFetch = (path, opts = {}) => fetch(path, {
  ...opts,
  headers: {
    'Content-Type': 'application/json',
    'x-admin-device': deviceId,
    ...(opts.headers || {})
  }
});

// ============ Toast ============
function toast(msg) {
  const root = document.getElementById('toastRoot');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2500);
}

// ============ Auth ============
async function initAuth() {
  const res = await fetch(`${API}/admin?action=session`, {
    headers: { 'x-admin-device': deviceId }
  });
  const data = await res.json();
  if (data.authenticated) return showDashboard(data);
  renderAuth(data);
}

function renderAuth(sessionData) {
  const body = document.getElementById('authBody');
  const hasAccount = sessionData?.hasAdminAccount;
  body.innerHTML = `
    <input id="adPass" type="password" placeholder="Admin password" autocomplete="current-password">
    ${hasAccount ? `<input id="adAccPass" type="password" placeholder="Admin account password (required on new devices)">` : ''}
    <button class="btn btn-primary" id="loginBtn"><i class="fas fa-lock"></i> Access Admin Panel</button>
    ${!hasAccount ? `
      <div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--border);">
        <p class="muted" style="font-size:12px;margin-bottom:8px;">First time? Bind your W Bullion account:</p>
        <input id="bindEmail" type="email" placeholder="Your W Bullion email">
        <input id="bindPass" type="password" placeholder="Your W Bullion account password">
        <button class="btn btn-ghost" id="bindBtn" style="width:100%;">Continue with W Bullion</button>
      </div>` : `
      <div style="margin-top:24px;text-align:center;">
        <button class="btn btn-ghost" style="width:100%;" onclick="window.location.href='/login'">
          Continue with W Bullion
        </button>
      </div>`}
  `;

  document.getElementById('loginBtn').onclick = async () => {
    const password = document.getElementById('adPass').value;
    const adminAccountPassword = document.getElementById('adAccPass')?.value || '';
    const res = await fetch(`${API}/admin?action=auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-device': deviceId },
      body: JSON.stringify({ password, adminAccountPassword, deviceId })
    });
    const data = await res.json();
    if (!res.ok) return toast(data.error || 'Login failed');
    initAuth();
  };

  if (!hasAccount) {
    document.getElementById('bindBtn').onclick = async () => {
      const bindAccountEmail = document.getElementById('bindEmail').value;
      const adminAccountPassword = document.getElementById('bindPass').value;
      const res = await fetch(`${API}/admin?action=auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-device': deviceId },
        body: JSON.stringify({ bindAccountEmail, adminAccountPassword, deviceId })
      });
      const data = await res.json();
      if (!res.ok) return toast(data.error || 'Bind failed');
      toast('Admin account bound');
      initAuth();
    };
  }
}

function showDashboard(sessionData) {
  document.getElementById('authLayer').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  document.getElementById('adminIdentity').textContent = sessionData.adminUser
    ? `${sessionData.adminUser.full_name} (${sessionData.adminUser.username})`
    : 'Password-authenticated admin';

  startStatusBar();
  loadStats();
  loadQuickActions();
  loadAdminEarnings();
  loadPayments('pending');
  loadUsers();
  loadGallery();
  loadNominees();
  loadBroadcasts();
  loadNotificationReaders();
  loadStatistics('hour');

  setInterval(loadStats, 10000);
  setInterval(loadAdminEarnings, 15000);
  setInterval(loadPayments.bind(null, currentPaymentTab), 8000);
}

// ============ Status bar ============
let batteryObj = null;
function startStatusBar() {
  updateClock();
  setInterval(updateClock, 1000);
  updateNetwork();
  window.addEventListener('online', updateNetwork);
  window.addEventListener('offline', updateNetwork);
  navigator.getBattery?.().then(b => { batteryObj = b; renderBattery(); b.addEventListener('levelchange', renderBattery); b.addEventListener('chargingchange', renderBattery); });
  updateWeather();
}

function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent = now.toLocaleTimeString('en-US', { hour12: true });
  document.getElementById('dateLabel').textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function updateNetwork() {
  const el = document.getElementById('networkLabel');
  if (!navigator.onLine) { el.innerHTML = '<i class="fas fa-wifi" style="color:#ef4444"></i> Offline'; return; }
  const conn = navigator.connection || {};
  el.innerHTML = `<i class="fas fa-wifi"></i> ${conn.type === 'cellular' ? 'Mobile' : 'WiFi'}`;
}

function renderBattery() {
  if (!batteryObj) return;
  const pct = Math.round(batteryObj.level * 100);
  const icon = document.querySelector('#batteryBtn i');
  if (batteryObj.charging) icon.className = 'fas fa-bolt';
  else if (pct >= 80) icon.className = 'fas fa-battery-full';
  else if (pct >= 50) icon.className = 'fas fa-battery-three-quarters';
  else if (pct >= 30) icon.className = 'fas fa-battery-half';
  else icon.className = 'fas fa-battery-quarter';
  document.getElementById('batteryPct').textContent = pct + '%';
}

document.getElementById('batteryBtn').onclick = async () => {
  if (!batteryObj) return toast('Battery info unavailable');
  const hrs = batteryObj.chargingTime !== Infinity ? `Charging: full in ~${Math.round(batteryObj.chargingTime / 60)}m` : '';
  const rem = batteryObj.dischargingTime !== Infinity ? `Remaining: ~${Math.round(batteryObj.dischargingTime / 60)}m` : '';
  toast([hrs, rem].filter(Boolean).join(' · ') || 'Battery info unavailable');
};

async function updateWeather() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(async pos => {
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true`);
      const d = await r.json();
      document.getElementById('weatherLabel').innerHTML = `<i class="fas fa-cloud-sun"></i> ${Math.round(d.current_weather.temperature)}°C`;
    } catch {}
  }, () => {});
}

// ============ Stats ============
async function loadStats() {
  const r = await adminFetch(`${API}/admin?action=stats`);
  const d = await r.json();
  const grid = document.getElementById('statsGrid');
  grid.innerHTML = `
    <div class="stat-card"><div class="value">${d.totalUsers || 0}</div><div class="label">Total Users</div></div>
    <div class="stat-card"><div class="value">${d.activatedUsers || 0}</div><div class="label">Activated</div></div>
    <div class="stat-card"><div class="value">${d.pendingPayments || 0}</div><div class="label">Pending Payments</div></div>
    <div class="stat-card"><div class="value">NGN ${(d.adminEarnings || 0).toLocaleString()}</div><div class="label">Game Loss Revenue</div></div>
    <div class="stat-card"><div class="value">${d.confirmedActivations || 0}</div><div class="label">Activations Confirmed</div></div>
    <div class="stat-card"><div class="value">NGN ${(d.totalActivationRevenue || 0).toLocaleString()}</div><div class="label">Activation Revenue</div></div>
  `;
}

// ============ Quick actions ============
function loadQuickActions() {
  const el = document.getElementById('quickActions');
  el.innerHTML = `
    <button onclick="document.getElementById('paymentsPanel').scrollIntoView({behavior:'smooth'})"><i class="fas fa-bell" style="color:var(--warning)"></i><div>Pending Payments</div></button>
    <button onclick="location.reload()"><i class="fas fa-sync-alt" style="color:#3b82f6"></i><div>Refresh Data</div></button>
    <button id="exportUsersBtn"><i class="fas fa-download" style="color:var(--success)"></i><div>Export Users</div></button>
    <button id="resetAllBtn" style="color:var(--danger)"><i class="fas fa-trash"></i><div>Reset All Accounts</div></button>
    <button id="banAccountsBtn" style="color:var(--danger)"><i class="fas fa-ban"></i><div>Ban Account(s)</div></button>
  `;
  document.getElementById('exportUsersBtn').onclick = async () => {
    const r = await adminFetch(`${API}/admin?action=users-list&limit=5000`);
    const d = await r.json();
    const blob = new Blob([JSON.stringify(d.users, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `wbullion-users-${Date.now()}.json`; a.click();
  };
  document.getElementById('resetAllBtn').onclick = async () => {
    if (!confirm('Delete ALL accounts? This cannot be undone.')) return;
    if (!confirm('FINAL WARNING: All users, balances, and data will be permanently removed.')) return;
    const r = await adminFetch(`${API}/admin?action=reset-all`, { method: 'POST' });
    const d = await r.json();
    if (!r.ok) return toast(d.error || 'Reset failed');
    toast('All accounts cleared'); loadStats(); loadUsers();
  };
  document.getElementById('banAccountsBtn').onclick = showBanModal;
}

// ============ Admin earnings ============
let earningsTab = 'losses';
function loadAdminEarnings() {
  adminFetch(`${API}/admin?action=stats`).then(r => r.json()).then(d => {
    document.getElementById('adminBalanceBig').textContent = 'NGN ' + (d.adminEarnings || 0).toLocaleString();
  });
  renderEarningsContent();
  document.querySelectorAll('#earningsTabs button').forEach(b => {
    b.onclick = () => {
      earningsTab = b.dataset.tab;
      document.querySelectorAll('#earningsTabs button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      renderEarningsContent();
    };
  });
  renderEarningsContent();
}

async function renderEarningsContent() {
  const el = document.getElementById('earningsContent');
  if (earningsTab === 'activations') {
    const r = await adminFetch(`${API}/admin?action=stats`);
    const d = await r.json();
    el.innerHTML = `
      <div style="padding:20px;border:1px solid var(--border);border-radius:12px;margin-top:12px;">
        <p class="muted">Confirmed activations × NGN 500</p>
        <p style="font-size:22px;font-weight:bold;margin-top:6px;">
          ${d.confirmedActivations || 0} × 500 = NGN ${(d.totalActivationRevenue || 0).toLocaleString()}
        </p>
      </div>`;
  } else {
    const r = await adminFetch(`${API}/admin?action=earnings-history`);
    const d = await r.json();
    if (!r.ok) { el.innerHTML = `<p class="muted">${escapeAdminHtml(d.error || 'Unable to load earnings history')}</p>`; return; }
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">
        <div class="wb-card"><span class="muted">Credits</span><strong style="display:block;color:#10b981;margin-top:4px;">+NGN ${Number(d.credits || 0).toLocaleString()}</strong></div>
        <div class="wb-card"><span class="muted">Debits</span><strong style="display:block;color:#ef4444;margin-top:4px;">-NGN ${Number(d.debits || 0).toLocaleString()}</strong></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px;">
        ${(d.transactions || []).map(t => `<div class="wb-card" style="display:flex;justify-content:space-between;gap:12px;padding:12px;"><span>${escapeAdminHtml(t.description || 'Admin transaction')}<small class="muted" style="display:block;margin-top:3px;">${new Date(t.created_at).toLocaleString()}</small></span><strong style="color:${t.type === 'credit' ? '#10b981' : '#ef4444'}">${t.type === 'credit' ? '+' : '-'}NGN ${Number(t.amount || 0).toLocaleString()}</strong></div>`).join('') || '<p class="muted">No admin transactions yet.</p>'}
      </div>`;
  }
}

// ============ Payments ============
let currentPaymentTab = 'pending';
let lastPendingPaymentCount = null;

function updatePaymentNotification(count) {
  const badge = document.getElementById('adminPaymentBadge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  }
  if (lastPendingPaymentCount !== null && count > lastPendingPaymentCount) {
    const added = count - lastPendingPaymentCount;
    toast(`${added} new payment${added === 1 ? '' : 's'} waiting for confirmation`);
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('W Bullion: pending payment', { body: `${added} new payment${added === 1 ? '' : 's'} need confirmation.` });
    }
  }
  lastPendingPaymentCount = count;
}

document.getElementById('adminPaymentAlert')?.addEventListener('click', async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch (_) { /* in-app alerts remain available */ }
  }
  document.getElementById('paymentsPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  currentPaymentTab = 'pending';
  document.querySelectorAll('#paymentTabs .tab').forEach(x => x.classList.toggle('active', x.dataset.tab === 'pending'));
  loadPayments('pending');
});

document.querySelectorAll('#paymentTabs .tab').forEach(t => {
  t.onclick = () => {
    currentPaymentTab = t.dataset.tab;
    document.querySelectorAll('#paymentTabs .tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    loadPayments(currentPaymentTab);
  };
});

async function loadPayments(status) {
  const el = document.getElementById('paymentsList');
  if (status === 'nonactivated') {
    const r = await adminFetch(`${API}/admin?action=users-list&limit=500`);
    const d = await r.json();
    const nonAct = (d.users || []).filter(u => !u.activated);
    el.innerHTML = nonAct.length === 0 ? `<p class="muted">No non-activated accounts</p>` :
      nonAct.map(u => `
        <div class="payment-card">
          <div class="payment-info">
            <h3>${u.full_name}</h3>
            <p>${u.username} · ${u.email}</p>
            <div class="payment-grid">
              <div><span>Ref Code:</span> ${u.unique_id}</div>
              <div><span>Signed up:</span> ${new Date(u.created_at).toLocaleDateString()}</div>
            </div>
          </div>
          <div class="payment-actions">
            <button class="btn btn-danger" onclick="resetUser('${u.id}')">Reset</button>
            <button class="btn btn-ghost" onclick="viewUser('${u.id}')">View</button>
          </div>
        </div>`).join('');
    return;
  }

  const r = await adminFetch(`${API}/admin?action=payments-list&status=${status}`);
  const d = await r.json();
  const payments = d.payments || [];
  if (status === 'pending') updatePaymentNotification(payments.length);
  if (payments.length === 0) {
    el.innerHTML = `<p class="muted">No ${status} payments</p>`;
    return;
  }
  el.innerHTML = payments.map(p => `
    <div class="payment-card">
      <div class="payment-info">
        <h3>${p.name || 'Unknown'}</h3>
        <p>${p.email} · ${p.users?.username || ''}</p>
        <div class="payment-grid">
          <div><span>Account:</span> ${p.account_number || '—'}</div>
          <div><span>Bank:</span> ${p.bank_name || '—'}</div>
          <div><span>Amount:</span> <strong style="color:var(--success)">NGN 500</strong></div>
          <div><span>Date:</span> ${new Date(p.submitted_at).toLocaleString()}</div>
        </div>
        <span class="status-pill ${p.status}" style="margin-top:8px;">${p.status.toUpperCase()}</span>
      </div>
      <div class="payment-actions">
        <button class="btn btn-ghost" onclick="viewScreens('${p.sms_screenshot || ''}', '${p.receipt_screenshot || ''}')">View</button>
        ${p.status === 'pending' ? `
          <button class="btn btn-primary" onclick="confirmPayment('${p.id}')">Confirm</button>
          <button class="btn btn-danger" onclick="rejectPayment('${p.id}')">Reject</button>
        ` : `
          <button class="btn btn-ghost" onclick="generateReceipt('${p.id}')">Generate Receipt</button>
          <button class="btn btn-primary" onclick="sendEmail('${p.id}')">Send Email</button>
        `}
      </div>
    </div>`).join('');
}

window.viewScreens = (sms, receipt) => {
  document.getElementById('modalSms').src = sms;
  document.getElementById('modalReceipt').src = receipt;
  document.getElementById('screenshotModal').classList.remove('hidden');
};

window.confirmPayment = async (id) => {
  if (!confirm('Confirm this payment? User will be activated.')) return;
  const r = await adminFetch(`${API}/admin?action=payments-single&id=${id}`, { method: 'POST', body: JSON.stringify({ action: 'confirm' }) });
  const d = await r.json();
  if (!r.ok) return toast(d.error);
  toast('Payment confirmed'); loadPayments(currentPaymentTab); loadStats();
};

window.rejectPayment = async (id) => {
  const reason = prompt('Reason for rejection:');
  if (reason === null) return;
  const r = await adminFetch(`${API}/admin?action=payments-single&id=${id}`, { method: 'POST', body: JSON.stringify({ action: 'reject', rejectionReason: reason }) });
  const d = await r.json();
  if (!r.ok) return toast(d.error);
  toast('Payment rejected'); loadPayments(currentPaymentTab); loadStats();
};

window.generateReceipt = (id) => {
  window.open(`${API}/admin?action=receipt&paymentId=${id}&deviceId=${deviceId}`, '_blank');
};

window.sendEmail = async (id) => {
  const r = await adminFetch(`${API}/admin?action=send-email`, { method: 'POST', body: JSON.stringify({ paymentId: id }) });
  const d = await r.json();
  if (!r.ok) return toast(d.error);
  toast('Email sent with receipt attached');
};

// ============ Users ============
let _userSearchTimer;
document.getElementById('userSearch').addEventListener('input', e => {
  clearTimeout(_userSearchTimer);
  _userSearchTimer = setTimeout(() => loadUsers(e.target.value), 300);
});

async function loadUsers(q = '') {
  const el = document.getElementById('usersList');
  const r = await adminFetch(`${API}/admin?action=users-list&q=${encodeURIComponent(q)}&limit=100`);
  const d = await r.json();
  const users = d.users || [];
  if (users.length === 0) { el.innerHTML = `<p class="muted">No users found</p>`; return; }
  el.innerHTML = users.map(u => `
    <div class="user-row">
      <div class="user-avatar">${(u.username || 'U')[1]?.toUpperCase() || 'U'}</div>
      <div class="user-info">
        <div class="uname">${u.full_name} <span class="muted">${u.username}</span>${u.admin ? ' <span class="status-pill confirmed">Admin</span>' : ''}${u.banned ? ' <span class="status-pill rejected">Banned</span>' : ''}${u.badge_awarded ? ' <i class="fas fa-check-circle" style="color:#3b82f6"></i>' : ''}</div>
        <div class="uemail">${u.email} · Ref: ${u.unique_id} · NGN ${Math.floor(u.balance).toLocaleString()}</div>
      </div>
      <div class="user-actions">
        <button class="btn btn-ghost" onclick="viewUser('${u.id}')">View</button>
        ${u.banned
          ? `<button class="btn btn-primary" onclick="unbanUser('${u.id}')">Unban</button>`
          : `<button class="btn btn-danger" onclick="banUser('${u.id}')">Ban</button>`}
      </div>
    </div>`).join('');
}

window.viewUser = async (id) => {
  const r = await adminFetch(`${API}/admin?action=users-single&id=${id}`);
  const d = await r.json();
  const u = d.user;
  const html = `
    <div style="font-size:14px;line-height:1.7;">
      <h3>${u.full_name} <span class="muted">${u.username}</span></h3>
      <p><strong>Email:</strong> ${u.email}</p>
      <p><strong>Ref Code:</strong> ${u.unique_id}</p>
      <p><strong>Balance:</strong> NGN <span id="detailBalance">${Math.floor(u.balance || 0).toLocaleString()}</span></p>
      <div style="display:flex;gap:8px;align-items:center;margin:10px 0;flex-wrap:wrap;">
        <input id="balanceAmount" type="number" min="1" step="1" placeholder="Amount" style="flex:1;min-width:110px;">
        <select id="balanceOperation" style="padding:8px;border-radius:6px;border:1px solid var(--border);">
          <option value="credit">Credit</option>
          <option value="debit">Debit</option>
        </select>
        <input id="balanceDescription" type="text" placeholder="Reason (optional)" style="flex:1;min-width:150px;">
        <button class="btn btn-primary" id="updateBalanceBtn">Update balance</button>
      </div>
      <p><strong>Referral Earnings:</strong> NGN ${Math.floor(u.referral_earnings || 0).toLocaleString()}</p>
      <p><strong>Status:</strong> ${u.activated ? '✅ Activated' : '⏳ Not Activated'}${u.banned ? ' · 🚫 Banned' : ''}</p>
      <p><strong>Signed up:</strong> ${new Date(u.created_at).toLocaleString()}</p>
      <p><strong>Streak Day:</strong> ${u.streak_day || 0}</p>
      <hr style="margin:12px 0">
      <h4>Recent Transactions (${d.transactions.length})</h4>
      <div style="max-height:200px;overflow-y:auto;">
        ${d.transactions.slice(0,20).map(t => `<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;"><span>${t.description}</span><strong style="color:${t.type==='credit'?'#10b981':'#ef4444'}">${t.type==='credit'?'+':'-'}NGN ${Math.floor(t.amount).toLocaleString()}</strong></div>`).join('') || '<p class="muted">No transactions</p>'}
      </div>
    </div>`;
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `<div class="modal-box"><div class="modal-head"><h3>User Details</h3><button class="close-btn"><i class="fas fa-close"></i></button></div>${html}</div>`;
  modal.querySelector('.close-btn').onclick = () => modal.remove();
  modal.querySelector('#updateBalanceBtn').onclick = async () => {
    const amount = Number(modal.querySelector('#balanceAmount').value);
    const operation = modal.querySelector('#balanceOperation').value;
    const description = modal.querySelector('#balanceDescription').value.trim();
    if (!Number.isFinite(amount) || amount <= 0) return toast('Enter a positive amount');
    const button = modal.querySelector('#updateBalanceBtn');
    button.disabled = true;
    const r = await adminFetch(`${API}/admin?action=balance-adjust`, {
      method: 'POST',
      body: JSON.stringify({ userId: id, operation, amount, description })
    });
    const d = await r.json();
    button.disabled = false;
    if (!r.ok) return toast(d.error || 'Balance update failed');
    modal.querySelector('#detailBalance').textContent = Math.floor(d.balance).toLocaleString();
    modal.querySelector('#balanceAmount').value = '';
    modal.querySelector('#balanceDescription').value = '';
    toast(`${operation === 'credit' ? 'Credit' : 'Debit'} applied`);
    loadUsers(document.getElementById('userSearch').value);
  };
  document.body.appendChild(modal);
};

window.banUser = async (id) => {
  const reason = prompt('Ban reason:');
  if (!reason) return;
  const r = await adminFetch(`${API}/admin?action=ban`, { method: 'POST', body: JSON.stringify({ userIds: [id], reason, action: 'ban' }) });
  const d = await r.json();
  if (!r.ok) return toast(d.error);
  toast('User banned'); loadUsers();
};

window.unbanUser = async (id) => {
  const r = await adminFetch(`${API}/admin?action=ban`, { method: 'POST', body: JSON.stringify({ userIds: [id], action: 'unban' }) });
  const d = await r.json();
  if (!r.ok) return toast(d.error);
  toast('User unbanned'); loadUsers();
};

window.resetUser = async (id) => {
  if (!confirm('Reset this non-activated account? Email and username will be freed.')) return;
  const r = await adminFetch(`${API}/admin?action=reset`, { method: 'POST', body: JSON.stringify({ userId: id }) });
  const d = await r.json();
  if (!r.ok) return toast(d.error);
  toast('Account reset'); loadPayments('nonactivated');
};

// ============ Ban modal ============
async function showBanModal() {
  const r = await adminFetch(`${API}/admin?action=users-list&limit=500`);
  const d = await r.json();
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-head">
        <h3>Ban Accounts</h3>
        <button class="close-btn"><i class="fas fa-close"></i></button>
      </div>
      <div style="margin-bottom:12px;display:flex;gap:12px;">
        <button class="btn btn-ghost" id="selectAll">Select all</button>
        <button class="btn btn-ghost" id="deselectAll">Deselect all</button>
      </div>
      <input id="banReason" placeholder="Reason for ban (required)" style="width:100%;padding:12px;border:2px solid var(--border);border-radius:10px;margin-bottom:12px;">
      <div style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:10px;padding:8px;">
        ${d.users.map(u => `<label style="display:flex;gap:8px;align-items:center;padding:6px;"><input type="checkbox" class="banChk" value="${u.id}"> ${u.full_name} (${u.username}) ${u.banned ? '· already banned' : ''}</label>`).join('')}
      </div>
      <button class="btn btn-danger" id="doBan" style="margin-top:12px;width:100%;">Ban Selected</button>
    </div>`;
  modal.querySelector('.close-btn').onclick = () => modal.remove();
  modal.querySelector('#selectAll').onclick = () => modal.querySelectorAll('.banChk').forEach(c => c.checked = true);
  modal.querySelector('#deselectAll').onclick = () => modal.querySelectorAll('.banChk').forEach(c => c.checked = false);
  modal.querySelector('#doBan').onclick = async () => {
    const userIds = [...modal.querySelectorAll('.banChk:checked')].map(c => c.value);
    const reason = modal.querySelector('#banReason').value.trim();
    if (!userIds.length) return toast('Select at least one user');
    if (!reason) return toast('Reason required');
    const res = await adminFetch(`${API}/admin?action=ban`, { method: 'POST', body: JSON.stringify({ userIds, reason, action: 'ban' }) });
    const dd = await res.json();
    if (!res.ok) return toast(dd.error);
    toast(`Banned ${userIds.length} users`);
    modal.remove(); loadUsers();
  };
  document.body.appendChild(modal);
}

// ============ Gallery ============
let galleryImages = [];
let galleryIndex = 0;

window.openGallery = (index = 0) => {
  if (!galleryImages.length) return;
  galleryIndex = index;
  const modal = document.getElementById('galleryModal');
  modal.classList.remove('hidden');
  renderGalleryImage();
};

window.closeGallery = () => {
  document.getElementById('galleryModal').classList.add('hidden');
  document.getElementById('galleryModalImage').src = '';
};

window.changeGalleryImage = (direction) => {
  if (!galleryImages.length) return;
  galleryIndex = (galleryIndex + direction + galleryImages.length) % galleryImages.length;
  renderGalleryImage();
};

document.addEventListener('keydown', (event) => {
  if (document.getElementById('galleryModal')?.classList.contains('hidden')) return;
  if (event.key === 'ArrowLeft') changeGalleryImage(-1);
  if (event.key === 'ArrowRight') changeGalleryImage(1);
  if (event.key === 'Escape') closeGallery();
});

function renderGalleryImage() {
  const image = galleryImages[galleryIndex];
  document.getElementById('galleryModalImage').src = image.src;
  document.getElementById('galleryModalImage').alt = image.label;
  document.getElementById('galleryModalCaption').textContent = `${image.label} · ${galleryIndex + 1} of ${galleryImages.length}`;
}

async function loadGallery() {
  const el = document.getElementById('galleryGrid');
  try {
    const r = await adminFetch(`${API}/admin?action=payments-list&status=all`);
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Unable to load gallery');
    galleryImages = (d.payments || []).flatMap(p => [
      p.sms_screenshot ? { src: p.sms_screenshot, label: `SMS alert · ${p.email || 'Unknown'}` } : null,
      p.receipt_screenshot ? { src: p.receipt_screenshot, label: `Receipt · ${p.email || 'Unknown'}` } : null
    ]).filter(Boolean);
    const button = document.getElementById('openGalleryButton');
    if (button) {
      button.disabled = !galleryImages.length;
      button.onclick = () => openGallery(0);
    }
    el.innerHTML = galleryImages.length
      ? `<p class="muted gallery-ready"><i class="fas fa-check-circle"></i> ${galleryImages.length} snapshot${galleryImages.length === 1 ? '' : 's'} ready to view</p>`
      : '<p class="muted">No receipt images available</p>';
  } catch (error) {
    el.innerHTML = `<p class="muted">${error.message || 'Unable to load gallery'}</p>`;
  }
}

// ============ Nominees ============
async function loadNominees() {
  const r = await adminFetch(`${API}/admin?action=badges`);
  const d = await r.json();
  const el = document.getElementById('nomineesList');
  const list = (d.nominees || []).filter(n => n.status === 'pending');
  if (list.length === 0) { el.innerHTML = `<p class="muted">No pending badge nominees</p>`; return; }
  el.innerHTML = list.map(n => `
    <div class="nominee-row">
      <div class="user-avatar">${(n.users?.username || 'U')[1]?.toUpperCase() || 'U'}</div>
      <div style="flex:1;">
        <strong>${n.users?.full_name}</strong> <span class="muted">${n.users?.username}</span>
        <p class="muted" style="font-size:12px;">Balance: NGN ${Math.floor(n.users?.balance || 0).toLocaleString()}</p>
      </div>
      <button class="btn btn-primary" onclick="confirmBadge('${n.id}')">Confirm</button>
      <button class="btn btn-ghost" onclick="ignoreBadge('${n.id}')">Ignore</button>
    </div>`).join('');
}

window.confirmBadge = async (id) => {
  const r = await adminFetch(`${API}/admin?action=badges`, { method: 'POST', body: JSON.stringify({ nomineeId: id, action: 'confirm' }) });
  const d = await r.json();
  if (!r.ok) return toast(d.error);
  toast('Badge awarded'); loadNominees();
};
window.ignoreBadge = async (id) => {
  const r = await adminFetch(`${API}/admin?action=badges`, { method: 'POST', body: JSON.stringify({ nomineeId: id, action: 'ignore' }) });
  const d = await r.json();
  if (!r.ok) return toast(d.error);
  toast('Nominee ignored'); loadNominees();
};

// ============ Broadcast ============
document.querySelectorAll('#bcToolbar button').forEach(b => {
  b.onclick = () => {
    const cmd = b.dataset.cmd;
    if (cmd === 'fontSizeUp') document.execCommand('fontSize', false, '5');
    else if (cmd === 'fontSizeDown') document.execCommand('fontSize', false, '2');
    else document.execCommand(cmd, false, null);
    document.getElementById('bcBody').focus();
  };
});
document.getElementById('bcColor').oninput = (e) => document.execCommand('foreColor', false, e.target.value);

document.getElementById('bcSend').onclick = async () => {
  const payload = {
    kind: document.getElementById('bcKind').value,
    title: document.getElementById('bcTitle').value,
    body_html: document.getElementById('bcBody').innerHTML,
    publish: document.getElementById('bcPublish').checked,
    sendAsNotification: document.getElementById('bcSendNotif').checked
  };
  const r = await adminFetch(`${API}/admin?action=broadcast`, { method: 'POST', body: JSON.stringify(payload) });
  const d = await r.json();
  if (!r.ok) return toast(d.error);
  toast('Broadcast sent');
  document.getElementById('bcTitle').value = '';
  document.getElementById('bcBody').innerHTML = '';
  loadBroadcasts();
};

async function loadNotificationReaders() {
  const el = document.getElementById('notificationReaders');
  if (!el) return;
  const r = await adminFetch(`${API}/admin?action=notification-readers`);
  const d = await r.json();
  if (!r.ok) { el.innerHTML = `<p class="muted">${d.error || 'Unable to load read receipts'}</p>`; return; }
  const rows = d.notifications || [];
  if (rows.length === 0) { el.innerHTML = '<p class="muted">No user notifications have been sent yet.</p>'; return; }
  el.innerHTML = rows.map(n => `
    <div class="broadcast-item">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
        <strong>${escapeAdminHtml(n.title || 'Notification')}</strong>
        <span class="status-pill ${n.read ? 'confirmed' : 'pending'}">${n.read ? 'Read' : 'Unread'}</span>
      </div>
      <p class="muted" style="font-size:12px;margin-top:4px;">${escapeAdminHtml(n.user?.full_name || n.user?.username || n.user?.email || 'Unknown user')} · ${escapeAdminHtml(n.user?.email || '')}</p>
      <p class="muted" style="font-size:12px;margin-top:4px;">${new Date(n.created_at).toLocaleString()}</p>
    </div>`).join('');
}

function escapeAdminHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}

document.getElementById('refreshNotificationReaders')?.addEventListener('click', loadNotificationReaders);

async function loadBroadcasts() {
  const r = await adminFetch(`${API}/admin?action=broadcast`);
  const d = await r.json();
  const el = document.getElementById('broadcastHistory');
  const list = d.broadcasts || [];
  if (list.length === 0) { el.innerHTML = `<p class="muted">No broadcasts yet</p>`; return; }
  el.innerHTML = `<h3 style="font-size:15px;margin-bottom:8px;">History</h3>` + list.map(b => `
    <div class="broadcast-item">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong>${b.title || '(no title)'}</strong>
        <span class="status-pill ${b.published ? 'confirmed' : 'pending'}">${b.published ? 'Published' : 'Draft'}</span>
      </div>
      <p class="muted" style="font-size:12px;margin-top:4px;">${new Date(b.created_at).toLocaleString()} · ${b.kind}</p>
    </div>`).join('');
}

// ============ Statistics ============
document.querySelectorAll('#statsTabs button').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('#statsTabs button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    loadStatistics(b.dataset.range);
  };
});

async function loadStatistics(range) {
  const r = await adminFetch(`${API}/admin?action=statistics`);
  const d = await r.json();
  const scope = d[range] || { total: 0, byAction: {}, byGame: {} };
  const el = document.getElementById('statsContent');
  el.innerHTML = `
    <p style="margin-bottom:12px;"><strong>${scope.total}</strong> actions in this period</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;">
      ${Object.entries(scope.byAction).map(([k,v]) => `<div class="stat-card"><div class="value">${v}</div><div class="label">${k.replace(/_/g,' ')}</div></div>`).join('')}
    </div>
    ${Object.keys(scope.byGame).length ? `
      <h3 style="font-size:14px;margin:16px 0 8px;">Games played</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;">
        ${Object.entries(scope.byGame).map(([g,v]) => `<div class="stat-card"><div class="value">${v}</div><div class="label">${g}</div></div>`).join('')}
      </div>` : ''}
    <p class="muted" style="margin-top:16px;font-size:13px;">Total game losses: NGN ${(d.gameLosses || 0).toLocaleString()}</p>
  `;
}

// ============ Logout ============
document.getElementById('logoutBtn').onclick = async () => {
  if (!confirm('Logout from admin?')) return;
  await fetch(`${API}/admin?action=logout`, { method: 'POST', headers: { 'x-admin-device': deviceId }, body: JSON.stringify({ deviceId }) });
  location.reload();
};

// ============ Init ============
initAuth();
