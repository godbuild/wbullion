import { navigate } from '../router.js';
import { getDeviceId, getCurrentUser } from '../auth.js';
import { showAlert, showToast } from '../modal.js';

const MAX_CAPTION = 80;
const MAX_DESC = 600;
const MAX_BYTES = 100 * 1024 * 1024;

export function renderReelsCreate() {
  const el = document.getElementById('viewContainer');
  el.style.padding = '0';
  el.innerHTML = `
    <div style="min-height:100dvh;background:#000;color:white;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top);">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:16px;">
        <button id="createClose" style="background:none;border:none;color:white;font-size:20px;cursor:pointer;"><i class="fas fa-close"></i></button>
        <h2 style="font-size:18px;font-weight:600;">Create Reel</h2>
        <div style="width:24px;"></div>
      </div>

      <div style="padding:0 16px;flex:1;">
        <div style="background:#111;border-radius:14px;padding:20px;text-align:center;margin-bottom:20px;">
          <input type="file" id="reelFile" accept="video/*" style="display:none;">
          <button id="pickFile" style="background:white;color:#2c0941;border:none;padding:12px 24px;border-radius:12px;font-weight:600;cursor:pointer;">
            <i class="fas fa-video"></i> Select Video
          </button>
          <p id="fileInfo" style="font-size:13px;color:#888;margin-top:12px;">Max 100 MB · 5 minutes</p>
          <video id="preview" style="display:none;width:100%;max-height:240px;border-radius:10px;margin-top:16px;background:black;" controls muted></video>
        </div>

        <div style="margin-bottom:16px;">
          <label style="font-size:13px;opacity:0.8;">Caption (max ${MAX_CAPTION})</label>
          <input id="reelCaption" maxlength="${MAX_CAPTION}" placeholder="Enter caption" style="width:100%;padding:12px;border-radius:10px;background:#1a1a1a;color:white;border:1px solid #333;outline:none;margin-top:6px;font-size:15px;">
          <p id="capCount" style="font-size:11px;color:#666;text-align:right;margin-top:4px;">0 / ${MAX_CAPTION}</p>
        </div>

        <div style="margin-bottom:16px;">
          <label style="font-size:13px;opacity:0.8;">Description (max ${MAX_DESC})</label>
          <textarea id="reelDesc" maxlength="${MAX_DESC}" rows="5" placeholder="Enter description" style="width:100%;padding:12px;border-radius:10px;background:#1a1a1a;color:white;border:1px solid #333;outline:none;margin-top:6px;font-size:15px;resize:vertical;"></textarea>
          <p id="descCount" style="font-size:11px;color:#666;text-align:right;margin-top:4px;">0 / ${MAX_DESC}</p>
        </div>

        <button id="postBtn" disabled style="width:100%;padding:16px;background:#333;color:#888;border:none;border-radius:12px;font-weight:600;font-size:16px;cursor:not-allowed;margin-bottom:24px;">Post</button>
      </div>
    </div>
  `;

  const fileInput = document.getElementById('reelFile');
  const pickBtn = document.getElementById('pickFile');
  const preview = document.getElementById('preview');
  const fileInfo = document.getElementById('fileInfo');
  const postBtn = document.getElementById('postBtn');
  let selectedFile = null;

  pickBtn.onclick = () => fileInput.click();

  fileInput.onchange = () => {
    const f = fileInput.files[0];
    if (!f) return;
    if (f.size > MAX_BYTES) {
      showAlert(`File is ${(f.size / 1024 / 1024).toFixed(1)} MB. Max is 100 MB.`, 'Too large');
      fileInput.value = '';
      return;
    }
    selectedFile = f;
    const url = URL.createObjectURL(f);
    preview.src = url;
    preview.style.display = 'block';
    fileInfo.textContent = `${f.name} · ${(f.size / 1024 / 1024).toFixed(1)} MB`;
    preview.onloadedmetadata = () => {
      if (preview.duration > 300) {
        showAlert('Video exceeds 5 minutes', 'Too long');
        selectedFile = null;
        preview.style.display = 'none';
        fileInput.value = '';
        return;
      }
      validate();
    };
    validate();
  };

  document.getElementById('reelCaption').addEventListener('input', (e) => {
    document.getElementById('capCount').textContent = `${e.target.value.length} / ${MAX_CAPTION}`;
  });
  document.getElementById('reelDesc').addEventListener('input', (e) => {
    document.getElementById('descCount').textContent = `${e.target.value.length} / ${MAX_DESC}`;
  });

  function validate() {
    const ok = !!selectedFile;
    postBtn.disabled = !ok;
    postBtn.style.background = ok ? 'var(--green)' : '#333';
    postBtn.style.color = ok ? 'white' : '#888';
    postBtn.style.cursor = ok ? 'pointer' : 'not-allowed';
  }

  postBtn.onclick = async () => {
    if (!selectedFile) return;
    postBtn.disabled = true;
    postBtn.textContent = 'Uploading...';

    try {
      const signRes = await fetch('/api/reels?action=sign-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: getDeviceId(), email: getCurrentUser()?.email || undefined })
      });
      const sign = await signRes.json();
      if (!signRes.ok) throw new Error(sign.error || 'Sign failed');

      const form = new FormData();
      form.append('file', selectedFile);
      form.append('api_key', sign.apiKey);
      form.append('timestamp', sign.timestamp);
      form.append('folder', sign.folder);
      form.append('upload_preset', sign.uploadPreset);
      form.append('signature', sign.signature);

      const cRes = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/video/upload`, {
        method: 'POST',
        body: form
      });
      const cloudinary = await cRes.json();
      if (!cRes.ok || !cloudinary.secure_url) throw new Error(cloudinary.error?.message || 'Upload failed');

      const saveRes = await fetch('/api/reels?action=create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: getDeviceId(),
          email: getCurrentUser()?.email || undefined,
          caption: document.getElementById('reelCaption').value,
          description: document.getElementById('reelDesc').value,
          cloudinary: {
            public_id: cloudinary.public_id,
            secure_url: cloudinary.secure_url,
            url: cloudinary.url,
            duration: cloudinary.duration,
            bytes: cloudinary.bytes
          }
        })
      });
      const save = await saveRes.json();
      if (!saveRes.ok) throw new Error(save.error || 'Save failed');

      showToast('Reel posted! +NGN 500');
      navigate('/reels');
    } catch (err) {
      showAlert(err.message, 'Upload Failed');
      postBtn.disabled = false;
      postBtn.textContent = 'Post';
    }
  };

  document.getElementById('createClose').onclick = () => navigate('/reels');
}
