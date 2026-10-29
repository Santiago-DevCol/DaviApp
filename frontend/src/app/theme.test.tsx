import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveTheme, THEME_STORAGE_KEY } from './theme';
import { useTheme } from './useTheme';

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

function ThemeProbe() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" aria-pressed={theme === 'dark'} onClick={toggle}>
      Tema: {theme}
    </button>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveTheme', () => {
  it('prefers the stored theme over the system preference', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    stubMatchMedia(false);
    expect(resolveTheme()).toBe('dark');
  });

  it('falls back to the system preference when nothing is stored', () => {
    stubMatchMedia(true);
    expect(resolveTheme()).toBe('dark');
  });

  it('defaults to light when matchMedia is not available', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(resolveTheme()).toBe('light');
  });

  it('ignores a stored value that is not a theme', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    stubMatchMedia(true);
    expect(resolveTheme()).toBe('dark');
  });
});

describe('useTheme', () => {
  it('applies the theme to the document and toggles it both ways', async () => {
    stubMatchMedia(false);
    const user = userEvent.setup();
    render(<ThemeProbe />);

    const toggle = screen.getByRole('button', { name: /Tema:/ });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.dataset.theme).toBe('light');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });
});

describe('index.html', () => {
  // `import.meta.url` is an http URL under jsdom; vite-node still injects `__dirname`.
  const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');

  it('resolves the theme before the first paint', () => {
    expect(html).toContain("localStorage.getItem('techdocs.theme')");
    expect(html).toContain('dataset.theme');
  });

  it('declares the favicon and the theme colors', () => {
    expect(html).toContain('rel="icon"');
    expect(html).toContain('name="theme-color"');
  });
});
