import { navigate, getCurrentPath } from './router.js';

const HIDE_ON = ['/reels', '/games', '/profile'];

export function updateNavbar() {
  const nav = document.getElementById('bottomNav');
  const path = getCurrentPath();

  const shouldHide = HIDE_ON.some(p => path === p || path.startsWith(p + '/'));
  if (shouldHide) {
    nav.classList.add('hidden');
    return;
  }
  nav.classList.remove('hidden');

  // Highlight active tab
  nav.querySelectorAll('.nav-item').forEach(btn => {
    const route = btn.dataset.route;
    const isActive = route === '/more'
      ? ['/more', '/settings', '/withdrawal', '/permissions', '/terms', '/help', '/badges', '/hoep', '/er', '/referral'].includes(path)
      : path === route || path.startsWith(route + '/');
    btn.classList.toggle('active', isActive);
  });
}
