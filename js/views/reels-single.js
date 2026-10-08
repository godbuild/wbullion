import { navigate } from '../router.js';
import { showToast } from '../modal.js';
import { compact } from '../format.js';

export async function renderReelSingle(id) {
  const el = document.getElementById('viewContainer');
  el.style.padding = '0';
  el.innerHTML = `<div style="padding:40px;text-align:center;color:#888;background:#000;min-height:100dvh;">Loading...</div>`;

  try {
    const res = await fetch(`/api/reels/${id}`);
    const data = await res.json();
    if (!res.ok) {
      el.innerHTML = `<div style="padding:60px 20px;text-align:center;color:#888;background:#000;min-height:100dvh;">${data.error || 'Reel not found'}</div>`;
      return;
    }
    const r = data.reel;
    el.innerHTML = `
      <div style="background:#000;min-height:100dvh;color:white;position:relative;padding-top:env(safe-area-inset-top);">
        <button id="closeSingle" style="position:absolute;top:16px;right:16px;background:rgba(0,0,0,0.5);border:none;color:white;width:40px;height:40px;border-radius:50%;font-size:18px;z-index:5;cursor:pointer;">
          <i class="fas fa-close"></i>
        </button>
        <video src="${r.cloudinary_secure_url}" controls autoplay playsinline loop style="width:100%;height:100dvh;object-fit:contain;background:#000;"></video>
        <div style="position:absolute;bottom:20px;left:12px;right:12px;">
          <p style="font-weight:700;font-size:16px;">${r.username}</p>
          ${r.caption ? `<p style="font-size:14px;font-weight:600;margin-top:4px;">${r.caption}</p>` : ''}
          ${r.description ? `<p style="font-size:13px;opacity:0.9;margin-top:4px;">${r.description}</p>` : ''}
          <p style="font-size:12px;opacity:0.7;margin-top:8px;"><i class="fas fa-thumbs-up"></i> ${compact((r.likes || []).length)} · <i class="fas fa-eye"></i> ${compact(r.views || 0)}</p>
        </div>
      </div>
    `;
    document.getElementById('closeSingle').onclick = () => navigate('/reels');
  } catch {
    el.innerHTML = `<div style="padding:60px;text-align:center;color:#888;background:#000;min-height:100dvh;">Reel not found. Might be deleted by the creator.</div>`;
  }
}
