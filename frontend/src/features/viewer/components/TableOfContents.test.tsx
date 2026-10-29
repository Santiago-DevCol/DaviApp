import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Heading } from '@/lib/markdownOutline';
import { TableOfContents } from './TableOfContents';

const headings: Heading[] = [
  { id: 'instalacion', text: 'Instalación', line: 3 },
  { id: 'uso', text: 'Uso', line: 9 },
];

describe('TableOfContents', () => {
  it('renders a navigation landmark with one anchor per heading', () => {
    render(<TableOfContents headings={headings} />);
    const nav = screen.getByRole('navigation', { name: 'En este documento' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Instalación' })).toHaveAttribute('href', '#instalacion');
    expect(screen.getByRole('link', { name: 'Uso' })).toHaveAttribute('href', '#uso');
  });

  it('renders nothing when there are no headings', () => {
    const { container } = render(<TableOfContents headings={[]} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('navigation', { name: 'En este documento' })).toBeNull();
  });
});
