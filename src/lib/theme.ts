/**
 * Dark/light theme on <html>: the `dark` class (Tailwind's dark variant) and the colour-scheme
 * (native controls, scrollbars). Applied before paint by the inline script in the root layout and
 * again by ThemeSync whenever React mounts the app, because a client re-render of the whole
 * document (React resets the attributes of <html>) would otherwise drop it.
 */
export const THEME_STORAGE_KEY = 'famvac_theme';

/** The saved choice, else the system preference */
export function resolveDarkTheme(): boolean {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // storage blocked: follow the system
  }
  if (stored === 'dark') return true;
  if (stored === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(dark: boolean): void {
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
}

/** Same logic as resolveDarkTheme/applyTheme, for the inline <head> script (runs before React) */
export const THEME_INIT_SCRIPT = `try {
  var t = localStorage.getItem('${THEME_STORAGE_KEY}');
  var d = t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', d);
  document.documentElement.style.colorScheme = d ? 'dark' : 'light';
} catch (_) {}`;
