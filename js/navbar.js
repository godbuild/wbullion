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

  // Use direct window path & local cache as a fallback if getCurrentPath/getCurrentUser aren't ready
  const path = (typeof getCurrentPath === 'function' ? getCurrentPath() : window.location.pathname) || '/';
  const user = (typeof getCurrentUser === 'function' ? getCurrentUser() : null) || JSON.parse(localStorage.getItem('wb_currentUser') || 'null');

  const shouldHide = !user || (path !== '/home' && HIDE_ON.some(p => path === p || path.startsWith(p + '/')));

  nav.classList.toggle('hidden', shouldHide);

  nav.querySelectorAll('.nav-item').forEach(btn => {
    const route = btn.dataset.route;
    const isMore = route === '/more';
    const matches = isMore
      ? ['/more', '/settings', '/withdrawal', '/permissions', '/terms', '/help', '/badges', '/hoep', '/er', '/referral'].includes(path)
      : path === route || path.startsWith(route + '/');
    btn.classList.toggle('active', matches);
  });
}
