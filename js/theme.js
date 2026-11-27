const THEME_KEY = 'wb_theme';
const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

function resolveTheme(preference) {
  if (preference !== 'system') return preference === 'dark' ? 'dark' : 'light';
  return window.matchMedia?.(SYSTEM_DARK_QUERY).matches ? 'dark' : 'light';
}

export function applyTheme(preference) {
  const safePreference = ['light', 'dark', 'system'].includes(preference) ? preference : 'system';
  const activeTheme = resolveTheme(safePreference);
  localStorage.setItem(THEME_KEY, safePreference);
  document.documentElement.setAttribute('data-theme', activeTheme);

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = activeTheme === 'dark' ? '#112717' : '#3ba072';
}

export function watchSystemTheme() {
  const media = window.matchMedia?.(SYSTEM_DARK_QUERY);
  if (!media) return;

  const updateTheme = () => {
    if (localStorage.getItem(THEME_KEY) === 'system') applyTheme('system');
  };

  if (media.addEventListener) media.addEventListener('change', updateTheme);
  else media.addListener(updateTheme);
}
