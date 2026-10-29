import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SearchBar } from './SearchBar';

function renderBar(props: Partial<Parameters<typeof SearchBar>[0]> = {}) {
  const onChange = vi.fn();
  const onClear = vi.fn();
  render(<SearchBar value="" onChange={onChange} onClear={onClear} {...props} />);
  return { onChange, onClear };
}

describe('SearchBar', () => {
  it('labels the field visibly and uses a search input', () => {
    renderBar();
    expect(screen.getByLabelText('Término de búsqueda')).toHaveAttribute('type', 'search');
  });

  it('reports typing through onChange', async () => {
    const user = userEvent.setup();
    const { onChange } = renderBar();
    await user.type(screen.getByLabelText('Término de búsqueda'), 'k');
    expect(onChange).toHaveBeenCalledWith('k');
  });

  it('offers a clear control only when there is a value', async () => {
    const user = userEvent.setup();
    const { onClear } = renderBar({ value: 'kubernetes' });
    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('hides the clear control when the field is empty', () => {
    renderBar({ value: '' });
    expect(screen.queryByRole('button', { name: 'Limpiar búsqueda' })).toBeNull();
  });

  it('announces the busy state as text without a status role', () => {
    renderBar({ value: 'kubernetes', busy: true });
    expect(screen.getByText('Buscando…')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
