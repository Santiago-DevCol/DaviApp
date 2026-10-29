import { useCallback, useEffect, useState } from 'react';
import { applyTheme, persistTheme, resolveTheme, type Theme } from './theme';

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(resolveTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    persistTheme(next);
    setTheme(next);
  }, [theme]);

  return { theme, toggle };
}
