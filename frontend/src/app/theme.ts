export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'techdocs.theme';

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

/** The theme the user chose explicitly, or null when none (or storage is unavailable). */
export function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** The operating-system preference; light when the environment cannot report it (e.g. jsdom). */
export function systemTheme(): Theme {
  if (typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(): Theme {
  return readStoredTheme() ?? systemTheme();
}

/** Night-mode tokens hang off `:root[data-theme="dark"]` in index.css. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export function persistTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode or a full quota: the choice simply does not survive a reload.
  }
}
