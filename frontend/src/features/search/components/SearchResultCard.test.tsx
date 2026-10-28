import { DocumentStatus, type SearchResultItem } from '@techdocs/shared';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SearchResultCard } from './SearchResultCard';

const item: SearchResultItem = {
  id: 'doc-1',
  title: 'Guía de Kubernetes',
  author: 'Ana',
  category: 'Infraestructura',
  tags: ['k8s', 'ops'],
  version: '1.2.0',
  status: DocumentStatus.INDEXED,
  highlight: 'Despliegue en <mark>Kubernetes</mark> … <script>alert(1)</script> <img src=x onerror=alert(1)>',
  rank: 0.5,
};

function renderCard(override: Partial<SearchResultItem> = {}) {
  return render(
    <MemoryRouter>
      <SearchResultCard item={{ ...item, ...override }} to="/documents/doc-1" />
    </MemoryRouter>,
  );
}

describe('SearchResultCard', () => {
  it('turns <mark> tokens into real mark elements', () => {
    const { container } = renderCard();
    const marks = container.querySelectorAll('mark');
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveTextContent('Kubernetes');
  });

  it('never injects other HTML from the highlight', () => {
    const { container } = renderCard();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText(/<script>alert\(1\)<\/script>/)).toBeInTheDocument();
  });

  it('shows metadata, status badge and tags', () => {
    renderCard();
    expect(screen.getByRole('link', { name: 'Guía de Kubernetes' })).toHaveAttribute('href', '/documents/doc-1');
    expect(screen.getByText('INDEXADO')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('v1.2.0')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Etiquetas' })).toHaveTextContent('k8s');
  });
});
