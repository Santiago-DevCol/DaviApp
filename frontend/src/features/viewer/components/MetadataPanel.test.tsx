import { DocumentStatus } from '@techdocs/shared';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { INDEXED_DOC, OLD_VERSION_DOC } from '@/test/msw/handlers';
import { renderWithProviders } from '@/test/render';
import { MetadataPanel } from './MetadataPanel';

describe('MetadataPanel', () => {
  it('lists every version newest first, marks the current one and links the others', () => {
    renderWithProviders(<MetadataPanel document={OLD_VERSION_DOC} />);

    const list = within(screen.getByRole('list', { name: 'Versiones' }));
    const items = list.getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('v2.1.0'),
      expect.stringContaining('v2.0.0'),
    ]);
    expect(items[1]).toHaveTextContent('actual');
    expect(within(items[1]!).queryByRole('link')).toBeNull();
    expect(within(items[0]!).getByRole('link', { name: /v2\.1\.0/ })).toHaveAttribute(
      'href',
      `/documents/${INDEXED_DOC.id}`,
    );
    expect(within(items[0]!).getByText('INDEXADO')).toBeInTheDocument();
  });

  it('shows the shortened content hash as a fingerprint and never the document key', () => {
    renderWithProviders(<MetadataPanel document={INDEXED_DOC} />);

    expect(screen.getByText('Huella')).toBeInTheDocument();
    expect(screen.getByText(INDEXED_DOC.contentHash!.slice(0, 12))).toBeInTheDocument();
    expect(screen.queryByText(INDEXED_DOC.documentKey!)).toBeNull();
  });

  it('renders documents without versioning fields', () => {
    const { versions: _versions, contentHash: _hash, ...legacy } = INDEXED_DOC;
    renderWithProviders(<MetadataPanel document={{ ...legacy, status: DocumentStatus.INDEXED }} />);

    expect(screen.queryByRole('list', { name: 'Versiones' })).toBeNull();
    expect(screen.queryByText('Huella')).toBeNull();
  });
});
