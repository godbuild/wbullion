const root = () => document.getElementById('modalRoot');

function buildModal({ title, message, buttons }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;';
  backdrop.innerHTML = `
    <div class="modal-box" style="pointer-events:auto;">
      ${title ? `<h3>${title}</h3>` : ''}
      ${message ? `<p>${message}</p>` : ''}
      <div class="modal-actions"></div>
    </div>
  `;
  const actions = backdrop.querySelector('.modal-actions');
  const close = () => backdrop.remove();

  buttons.forEach(btn => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `modal-btn ${btn.style || 'primary'}`;
    el.textContent = btn.label;
    el.style.cursor = 'pointer';
    el.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      close();
      try { btn.onClick?.(); } catch (e) { console.error(e); }
    });
    actions.appendChild(el);
  });

  return { backdrop, close };
}

export function showAlert(message, title = '') {
  return new Promise(resolve => {
    const { backdrop } = buildModal({
      title, message,
      buttons: [{ label: 'OK', style: 'primary', onClick: resolve }]
    });
    root().appendChild(backdrop);
  });
}

export function showConfirm(message, title = 'Confirm') {
  return new Promise(resolve => {
    const { backdrop } = buildModal({
      title, message,
      buttons: [
        { label: 'Cancel', style: 'ghost', onClick: () => resolve(false) },
        { label: 'Confirm', style: 'primary', onClick: () => resolve(true) }
      ]
    });
    root().appendChild(backdrop);
  });
}

export function showPrompt(message, title = '', defaultValue = '') {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;';
    backdrop.innerHTML = `
      <div class="modal-box" style="pointer-events:auto;">
        ${title ? `<h3>${title}</h3>` : ''}
        <p>${message}</p>
        <input type="text" class="modal-input" value="${defaultValue}"
               style="width:100%;padding:12px;border:2px solid var(--border-color);border-radius:10px;background:var(--bg-primary);color:var(--text-primary);font-size:15px;outline:none;margin-bottom:16px;">
        <div class="modal-actions">
          <button type="button" class="modal-btn ghost" style="cursor:pointer;">Cancel</button>
          <button type="button" class="modal-btn primary" style="cursor:pointer;">OK</button>
        </div>
      </div>
    `;
    const input = backdrop.querySelector('.modal-input');
    const [cancelBtn, okBtn] = backdrop.querySelectorAll('.modal-btn');
    const close = (val) => { backdrop.remove(); resolve(val); };
    cancelBtn.addEventListener('click', (ev) => { ev.preventDefault(); close(null); });
    okBtn.addEventListener('click', (ev) => { ev.preventDefault(); close(input.value); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') close(input.value); });
    root().appendChild(backdrop);
    input.focus();
  });
}

export function showToast(message, duration = 2000) {
  const el = document.createElement('div');
  el.textContent = message;
  Object.assign(el.style, {
    position: 'fixed',
    bottom: '100px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.85)',
    color: 'white',
    padding: '10px 20px',
    borderRadius: '20px',
    fontSize: '14px',
    zIndex: 10000,
    opacity: '0',
    transition: 'opacity 0.25s',
    pointerEvents: 'none'
  });
  document.body.appendChild(el);
  requestAnimationFrame(() => el.style.opacity = '1');
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 250);
  }, duration);
}
