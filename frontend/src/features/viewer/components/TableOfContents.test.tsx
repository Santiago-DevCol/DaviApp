import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Heading } from '@/lib/markdownOutline';
import { TableOfContents } from './TableOfContents';

const headings: Heading[] = [
  { id: 'instalacion', text: 'Instalación', line: 3 },
  { id: 'requisitos', text: 'Requisitos', line: 9 },
];

/** Exposes the router location so the tests can read the hash and the state after a jump. */
function LocationProbe() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '';
  return (
    <>
      <output data-testid="hash">{location.hash}</output>
      <output data-testid="from">{from}</output>
    </>
  );
}

function renderInRouter(ui: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/documents/x', state: { from: '/search?q=k8s' } }]}>
      {ui}
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('TableOfContents', () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  afterEach(() => {
    scrollIntoView.mockReset();
  });

  it('renders a navigation landmark with one anchor per heading', () => {
    renderInRouter(<TableOfContents headings={headings} />);
    const nav = screen.getByRole('navigation', { name: 'En este documento' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Instalación' })).toHaveAttribute('href', '#instalacion');
    expect(screen.getByRole('link', { name: 'Requisitos' })).toHaveAttribute('href', '#requisitos');
  });

  it('renders nothing when there are no headings', () => {
    const { container } = renderInRouter(<TableOfContents headings={[]} />);
    expect(screen.queryByRole('navigation', { name: 'En este documento' })).toBeNull();
    expect(container.querySelector('nav')).toBeNull();
  });

  it('jumps to the section without dropping the router state', async () => {
    const user = userEvent.setup();
    renderInRouter(
      <>
        <h2 id="requisitos">Requisitos</h2>
        <TableOfContents headings={headings} />
      </>,
    );

    await user.click(screen.getByRole('link', { name: 'Requisitos' }));

    expect(screen.getByTestId('hash')).toHaveTextContent('#requisitos');
    expect(screen.getByTestId('from')).toHaveTextContent('/search?q=k8s');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById('requisitos'));
  });

  it('leaves modified clicks to the browser', async () => {
    const user = userEvent.setup();
    renderInRouter(<TableOfContents headings={headings} />);

    await user.keyboard('{Control>}');
    await user.click(screen.getByRole('link', { name: 'Requisitos' }));
    await user.keyboard('{/Control}');

    expect(screen.getByTestId('hash')).toHaveTextContent('');
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
