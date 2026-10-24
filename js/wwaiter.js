// W Waiter — floating clipboard. Only active when permission granted and on mobile.

const STORAGE_KEY = 'wb_wwaiter_items';
const PERM_KEY = 'wb_perms';

let _container = null;
let _items = [];
let _visible = false;

// Keep a reference to the browser clipboard method before the global capture hook runs.
const nativeClipboardWrite = navigator.clipboard?.writeText?.bind(navigator.clipboard);

export async function copyToClipboard(text) {
  const value = String(text);
  if (nativeClipboardWrite) {
    try { return await nativeClipboardWrite(value); } catch {}
  }
  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:-9999px;opacity:0;';
  document.body.appendChild(area);
  area.select();
  const copied = document.execCommand('copy');
  area.remove();
  if (!copied) throw new Error('Clipboard access is unavailable');
}

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function permissionGranted() {
  try {
    const perms = JSON.parse(localStorage.getItem(PERM_KEY) || '{}');
    return perms.background === true;
  } catch { return false; }
}

export function isWWaiterActive() {
  return isMobile() && permissionGranted();
}

function load() {
  try { _items = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { _items = []; }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_items));
}

function mount() {
  if (_container) return;
  _container = document.createElement('div');
  _container.id = 'wwaiterRoot';
  _container.style.cssText = `
    position: fixed;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    z-index: 9000;
    display: none;
    touch-action: none;
  `;
  document.body.appendChild(_container);
  _container.addEventListener('pointerdown', onPointerDown);
}

function render() {
  if (!_container) return;
  if (_items.length === 0) {
    _container.style.display = 'none';
    _visible = false;
    return;
  }
  _container.style.display = 'block';
  _visible = true;
  _container.innerHTML = `
    <div id="wwaiterBubble" style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#3ba072,#154c00);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.35);position:relative;margin-right:8px;">
      <img src="/images/logo.png" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
      <span style="display:none;color:white;font-weight:900;font-size:18px;">W</span>
      <span id="wwaiterCount" style="position:absolute;top:-4px;right:-4px;background:#ef4444;color:white;font-size:10px;font-weight:700;padding:2px 6px;border-radius:10px;min-width:16px;text-align:center;">${_items.length}</span>
    </div>
  `;
  document.getElementById('wwaiterBubble').onclick = openPanel;
}

function onPointerDown(e) {
  // Long-press → close button
  const startX = e.clientX, startY = e.clientY;
  const timer = setTimeout(() => {
    showCloseButton();
  }, 700);
  const cancel = () => {
    clearTimeout(timer);
    document.removeEventListener('pointerup', cancel);
    document.removeEventListener('pointermove', cancel);
  };
  document.addEventListener('pointerup', cancel);
  document.addEventListener('pointermove', cancel);
}

function showCloseButton() {
  const existing = document.getElementById('wwaiterClose');
  if (existing) existing.remove();
  const btn = document.createElement('button');
  btn.id = 'wwaiterClose';
  btn.innerHTML = '<i class="fas fa-times"></i>';
  btn.style.cssText = `
    position:fixed;
    top:calc(50% - 40px);
    right:60px;
    width:32px;height:32px;border-radius:50%;
    background:#ef4444;color:white;border:none;
    cursor:pointer;font-size:14px;z-index:9001;
    box-shadow:0 4px 12px rgba(0,0,0,0.3);
  `;
  document.body.appendChild(btn);
  btn.onclick = () => {
    _items = [];
    save();
    render();
    btn.remove();
    if (_panelOpen) closePanel();
  };
  setTimeout(() => {
    if (document.body.contains(btn)) btn.remove();
  }, 4000);
}

// ----- Panel -----
let _panel = null;
let _panelOpen = false;

function openPanel() {
  if (_panelOpen) return closePanel();
  _panelOpen = true;
  _panel = document.createElement('div');
  _panel.style.cssText = `
    position:fixed;
    right:8px;
    top:50%;
    transform:translateY(-50%);
    width:280px;
    max-height:70vh;
    background:var(--bg-primary);
    color:var(--text-primary);
    border-radius:14px;
    box-shadow:0 12px 40px rgba(0,0,0,0.35);
    padding:16px;
    z-index:9002;
    display:flex;
    flex-direction:column;
  `;
  renderPanel();
  document.body.appendChild(_panel);
}

function renderPanel() {
  if (!_panel) return;
  _panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <h3 style="font-size:16px;font-weight:700;">W Waiter</h3>
      <button id="wwaiterPanelClose" style="background:none;border:none;color:var(--text-primary);font-size:18px;cursor:pointer;"><i class="fas fa-times"></i></button>
    </div>
    <div style="overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:8px;">
      ${_items.map((item, idx) => `
        <div style="background:var(--bg-secondary);border-radius:10px;padding:10px;">
          <p style="font-size:12px;word-break:break-all;line-height:1.4;">${escapeHtml(item.text)}</p>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">
            <span style="font-size:10px;color:var(--text-secondary);">${item.source || 'Text'}</span>
            <button class="wwaiterCutBtn" data-idx="${idx}" style="background:var(--green);color:white;border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer;">Cut</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  _panel.querySelector('#wwaiterPanelClose').onclick = closePanel;
  _panel.querySelectorAll('.wwaiterCutBtn').forEach(btn => {
    btn.onclick = async () => {
      const idx = Number(btn.dataset.idx);
      const item = _items[idx];
      try {
        await copyToClipboard(item.text);
      } catch {
        return;
      }
      _items.splice(idx, 1);
      save();
      render();
      if (_items.length === 0) closePanel();
      else renderPanel();
    };
  });
}

function closePanel() {
  _panel?.remove();
  _panel = null;
  _panelOpen = false;
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// ----- Public API -----
export function wwaiterCopy(text, source = 'Text') {
  if (!isWWaiterActive() || !text) return false;
  load();
  // Cap at 10 items
  if (_items.length >= 10) _items.shift();
  _items.push({ text: String(text), source, ts: Date.now() });
  save();
  mount();
  render();
  return true;
}

export function initWWaiter() {
  if (!isWWaiterActive()) return;
  load();
  mount();
  render();
}
