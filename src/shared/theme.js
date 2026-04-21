export function getEffectiveTheme(mode) {
  if (mode === 'light' || mode === 'dark') {
    return mode;
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function applyTheme(mode, root = document.documentElement) {
  const effective = getEffectiveTheme(mode);
  root.classList.remove('theme-light', 'theme-dark');
  root.classList.add(`theme-${effective}`);
  root.dataset.themeMode = mode;
  return effective;
}

export function watchSystemTheme(callback) {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => {};
  }
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = (e) => callback(e.matches ? 'dark' : 'light');
  mq.addEventListener('change', listener);
  return () => mq.removeEventListener('change', listener);
}
