import { getCurrentPath } from './router.js';
import { getCurrentUser } from './auth.js';

const HIDE_ON = [
  '/reels',
  '/games',
  '/profile',
  '/login',
  '/signup',
  '/activation',
  '/terms'
];

export function updateNavbar() {
  const nav = document.getElementById('bottomNav');
  if (!nav) return;

  const path = getCurrentPath();
  const user = getCurrentUser();

  const shouldHide =
    !user ||
    HIDE_ON.some(p => path === p || path.startsWith(p + '/'));

  if (shouldHide) {
    nav.classList.add('hidden');
    return;
  }
  nav.classList.remove('hidden');

  nav.querySelectorAll('.nav-item').forEach(btn => {
    const route = btn.dataset.route;
    const isActive = route === '/more'
      ? ['/more', '/settings', '/withdrawal', '/permissions', '/terms', '/help', '/badges', '/hoep', '/er', '/referral'].includes(path)
      : path === route || path.startsWith(route + '/');
    btn.classList.toggle('active', isActive);
  });
}
