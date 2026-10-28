import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestQueryClient } from '@/test/render';
import { SEARCH_DEBOUNCE_MS, useSearch } from './useSearch';

const location = { search: '' };

function LocationSpy() {
  location.search = useLocation().search;
  return null;
}

function wrapperFor(route: string) {
  const client = createTestQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[route]}>
          <LocationSpy />
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe('useSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    location.search = '';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initialises the input from the URL', () => {
    const { result } = renderHook(() => useSearch(), { wrapper: wrapperFor('/search?q=kubernetes&page=2') });
    expect(result.current.input).toBe('kubernetes');
    expect(result.current.q).toBe('kubernetes');
    expect(result.current.page).toBe(2);
  });

  it('debounces the input before committing it to the URL', () => {
    const { result } = renderHook(() => useSearch(), { wrapper: wrapperFor('/search') });

    act(() => result.current.setInput('kube'));
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1));
    expect(result.current.q).toBe('');
    expect(location.search).toBe('');

    act(() => result.current.setInput('kubernetes'));
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1));
    expect(result.current.q).toBe('');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.q).toBe('kubernetes');
    expect(location.search).toBe('?q=kubernetes');
  });

  it('keeps the page in the URL and resets it when the query changes', () => {
    const { result } = renderHook(() => useSearch(), { wrapper: wrapperFor('/search?q=kubernetes') });

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);
    expect(location.search).toBe('?q=kubernetes&page=3');

    act(() => result.current.setInput('docker'));
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(result.current.page).toBe(1);
    expect(location.search).toBe('?q=docker');
  });

  it('does not query while the input is empty', () => {
    const { result } = renderHook(() => useSearch(), { wrapper: wrapperFor('/search') });
    expect(result.current.q).toBe('');
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});
