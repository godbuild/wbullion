import { navigate } from '../router.js';
import { getDeviceId } from '../auth.js';
import { showToast, showAlert } from '../modal.js';
import { money } from '../format.js';
import { apiFetch } from '../lib/api.js';

export async function renderTasks() {
  const el = document.getElementById('viewContainer');
  el.innerHTML = `<div style="padding:40px;text-align:center;"><i class="fas fa-spinner fa-spin"></i></div>`;

  const deviceId = getDeviceId();
  const [allRes, mineRes] = await Promise.all([
    fetch(`/api/tasks?action=list&deviceId=${encodeURIComponent(deviceId)}`),
    fetch(`/api/tasks?action=list&deviceId=${encodeURIComponent(deviceId)}&mode=mine`)
  ]);
  const all = (await allRes.json()).tasks || [];
  const mine = (await mineRes.json()).tasks || [];

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h2 style="font-size:22px;font-weight:bold;">Tasks</h2>
      <div style="display:flex;gap:8px;">
        <button id="newTask" class="wb-close" style="font-size:13px;font-weight:600;">+ Create</button>
        <button id="closeTasks" class="wb-close"><i class="fas fa-close"></i></button>
      </div>
    </div>

    <div style="display:flex;gap:6px;margin-bottom:16px;">
      <button class="taskTab active" data-tab="available" style="flex:1;padding:10px;border-radius:10px;border:none;font-weight:600;cursor:pointer;background:var(--green);color:white;">Available (${all.length})</button>
      <button class="taskTab" data-tab="mine" style="flex:1;padding:10px;border-radius:10px;border:none;font-weight:600;cursor:pointer;background:var(--bg-secondary);color:var(--text-primary);">My Tasks (${mine.length})</button>
    </div>

    <div id="taskList"></div>
  `;

  function renderList(tab) {
    const list = tab === 'available' ? all : mine;
    const wrap = document.getElementById('taskList');
    if (list.length === 0) {
      wrap.innerHTML = `<p style="text-align:center;color:var(--text-secondary);padding:40px;">No tasks ${tab === 'mine' ? 'created' : 'available'}</p>`;
      return;
    }
    wrap.innerHTML = list.map(t => `
      <div class="wb-card" style="margin-bottom:10px;">
        <h3 style="font-size:15px;font-weight:700;">${t.title}</h3>
        <div style="font-size:13px;color:var(--text-secondary);margin-top:6px;">${t.description_html || ''}</div>
        ${t.button_label && t.button_url ? `
          <a href="${t.button_url}" target="_blank" rel="noopener" style="display:inline-block;margin-top:10px;padding:8px 16px;background:var(--purple);color:white;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;">${t.button_label}</a>
        ` : ''}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;">
          <span style="font-size:12px;color:var(--text-secondary);">Reward: <strong style="color:var(--green);">${money(t.reward_click || 150)}</strong></span>
          ${tab === 'available' ? `<button class="completeTask" data-id="${t.id}" data-url="${t.button_url || ''}" style="padding:8px 16px;background:var(--green);color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:13px;">Complete</button>` : `<button class="deleteTask" data-id="${t.id}" style="padding:8px 16px;background:#ef4444;color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:13px;">Delete</button>`}
        </div>
      </div>
    `).join('');

    document.querySelectorAll('.deleteTask').forEach(btn => btn.onclick = async () => {
      if (!confirm('Delete this task? It will no longer be available to users.')) return;
      const r = await apiFetch('/api/tasks?action=delete', { method:'POST', body: JSON.stringify({ deviceId, taskId: btn.dataset.id }) });
      const d = await r.json();
      if (!r.ok) return showAlert(d.error || 'Unable to delete task', 'Error');
      showToast('Task deleted');
      renderTasks();
    });

    document.querySelectorAll('.completeTask').forEach(btn => btn.onclick = async () => {
      if (btn.dataset.url) window.open(btn.dataset.url, '_blank');
      const r = await fetch('/api/tasks?action=complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, taskId: btn.dataset.id })
      });
      const d = await r.json();
      if (!r.ok) return showToast(d.error);
      showToast(`+${money(d.reward)}`);
      renderTasks();
    });
  }

  renderList('available');

  document.querySelectorAll('.taskTab').forEach(t => {
    t.onclick = () => {
      document.querySelectorAll('.taskTab').forEach(x => {
        x.classList.remove('active');
        x.style.background = 'var(--bg-secondary)';
        x.style.color = 'var(--text-primary)';
      });
      t.classList.add('active');
      t.style.background = 'var(--green)';
      t.style.color = 'white';
      renderList(t.dataset.tab);
    };
  });

  document.getElementById('closeTasks').onclick = () => history.back();
  document.getElementById('newTask').onclick = () => showCreateTask();
}

function showCreateTask() {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-box">
      <h3 style="margin-bottom:16px;">Create Task</h3>
      <input id="tTitle" class="wb-input" placeholder="Task title" style="margin-bottom:10px;">
      <textarea id="tDesc" class="wb-input" placeholder="Description (links will be auto-detected)" style="min-height:100px;margin-bottom:10px;"></textarea>
      <input id="tBtnLabel" class="wb-input" placeholder="Button label (optional)" style="margin-bottom:10px;">
      <input id="tBtnUrl" class="wb-input" placeholder="Button URL (optional)" style="margin-bottom:10px;">
      <input id="tReward" class="wb-input" type="number" placeholder="Reward per completion (default 150)" value="150" style="margin-bottom:10px;">
      <input id="tCPC" class="wb-input" type="number" placeholder="Pay-per-click cost (deducts from you per click)" value="0" style="margin-bottom:12px;">
      <div class="modal-actions">
        <button type="button" class="modal-btn ghost" id="cancelTask">Cancel</button>
        <button type="button" class="modal-btn primary" id="saveTask">Create (Earn NGN 500)</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#cancelTask').onclick = () => modal.remove();
  modal.querySelector('#saveTask').onclick = async () => {
    const r = await apiFetch('/api/tasks?action=create', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: getDeviceId(),
        title: document.getElementById('tTitle').value,
        descriptionHtml: document.getElementById('tDesc').value,
        buttonLabel: document.getElementById('tBtnLabel').value,
        buttonUrl: document.getElementById('tBtnUrl').value,
        rewardClick: Number(document.getElementById('tReward').value) || 150,
        payPerClick: Number(document.getElementById('tCPC').value) || 0
      })
    });
    showToast('Task created! +NGN 500');
    modal.remove();
    renderTasks();
  };
}
