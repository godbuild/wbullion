// Lightweight SPA router. Handles dynamic segments like /profile/:username and /reels/:id

const routes = [];
let _currentPath = null;
let _onChange = null;

export function registerRoute(pattern, handler) {
  // pattern example: "/profile/:username" or "/reels/:id" or "/home"
  const keys = [];
  const regexStr = pattern
    .replace(/\/:([^/]+)/g, (_, key) => { keys.push(key); return '/([^/]+)'; })
    .replace(/\//g, '\\/');
  routes.push({ pattern, regex: new RegExp(`^${regexStr}$`), keys, handler });
}

export function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState({}, '', path);
  else history.pushState({}, '', path);
  resolve();
}

export function getCurrentPath() {
  return window.location.pathname;
}

export function onRouteChange(cb) { _onChange = cb; }

function resolve() {
  const path = window.location.pathname;
  _currentPath = path;

  for (const route of routes) {
    const match = path.match(route.regex);
    if (match) {
      const params = {};
      route.keys.forEach((k, i) => { params[k] = decodeURIComponent(match[i + 1]); });
      if (_onChange) _onChange(path, params);
      route.handler(params);
      return;
    }
  }
  // No match → fallback to /login (or /home if authenticated — handled in main.js)
  navigate('/login', { replace: true });
}

export function startRouter() {
  window.addEventListener('popstate', resolve);
  // Intercept link clicks
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-route]');
    if (link && link.dataset.route) {
      e.preventDefault();
      navigate(link.dataset.route);
    }
  });
  resolve();
}
