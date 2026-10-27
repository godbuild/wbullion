function safeMarkup(html) {
  const template = document.createElement('template');
  template.innerHTML = html || '';
  template.content.querySelectorAll('script, iframe, object, embed, form').forEach(node => node.remove());
  template.content.querySelectorAll('*').forEach(node => {
    [...node.attributes].forEach(attribute => {
      if (/^on/i.test(attribute.name) || /^(javascript|data):/i.test(attribute.value)) node.removeAttribute(attribute.name);
    });
  });
  return template.innerHTML;
}

function closePopup() {
  document.getElementById('broadcastPopup')?.remove();
  document.body.classList.remove('broadcast-open');
}

function renderBroadcast(broadcast) {
  const isFullscreen = broadcast.kind === 'fullscreen';
  const popup = document.createElement('div');
  popup.id = 'broadcastPopup';
  popup.className = `broadcast-popup ${isFullscreen ? 'broadcast-popup-fullscreen' : 'broadcast-popup-bottom'}`;
  const image = broadcast.cover_image || broadcast.inline_image;
  popup.innerHTML = `
    <div class="broadcast-popup-card" ${broadcast.background_image ? `style="background-image:linear-gradient(rgba(255,255,255,.72),rgba(255,255,255,.9)),url('${broadcast.background_image.replace(/'/g, '%27')}')"` : ''}>
      <button class="broadcast-popup-close" type="button" aria-label="Close announcement">&times;</button>
      ${image ? `<img class="broadcast-popup-image" src="${image.replace(/"/g, '&quot;')}" alt="Announcement image">` : ''}
      ${broadcast.title ? `<h2>${safeMarkup(broadcast.title)}</h2>` : ''}
      <div class="broadcast-popup-body">${safeMarkup(broadcast.body_html)}</div>
    </div>`;
  popup.querySelector('.broadcast-popup-close').addEventListener('click', closePopup);
  popup.addEventListener('click', event => { if (event.target === popup) closePopup(); });
  document.body.appendChild(popup);
}

export async function showLatestBroadcast() {
  try {
    const response = await fetch('/api/broadcasts', { cache: 'no-store' });
    if (!response.ok) return;
    const { broadcast } = await response.json();
    if (broadcast) renderBroadcast(broadcast);
  } catch {
    // Announcements must never block the app from loading.
  }
}
