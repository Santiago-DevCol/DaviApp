import { DocumentStatus } from '@techdocs/shared';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { TrackedUploadView } from '../useTrackedUploads';
import { TrackedUploadsList } from './TrackedUploadsList';

function entry(overrides: Partial<TrackedUploadView> = {}): TrackedUploadView {
  return {
    id: 'doc-1',
    fileName: 'notas.txt',
    title: 'Notas',
    acceptedAt: '2026-10-28T10:00:00.000Z',
    status: null,
    errorMessage: null,
    loadError: null,
    ...overrides,
  };
}

function renderList(entries: TrackedUploadView[]) {
  return renderWithProviders(<TrackedUploadsList entries={entries} onRemove={vi.fn()} onClear={vi.fn()} />, {
    route: '/upload',
    path: '/upload',
  });
}

describe('TrackedUploadsList', () => {
  it('renders a duplicate upload with a link to the existing document and no spinner', () => {
    renderList([entry({ id: 'existing-1', duplicateOf: { id: 'existing-1', version: '1.2.0' } })]);

    expect(screen.getByText('Duplicado')).toBeInTheDocument();
    expect(screen.getByText('Ya existía como versión 1.2.0')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver documento' })).toHaveAttribute('href', '/documents/existing-1');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText('Consultando estado')).toBeNull();
  });

  it('shows the assigned version only when it differs from the one sent', () => {
    renderList([
      entry({ id: 'bumped', fileName: 'a.txt', sentVersion: '1.0.0', version: '1.0.1' }),
      entry({ id: 'same', fileName: 'b.txt', sentVersion: '2.0.0', version: '2.0.0' }),
    ]);

    expect(screen.getByText(/Versión asignada: v1\.0\.1/)).toHaveTextContent('enviada v1.0.0');
    expect(screen.getAllByText(/Versión asignada/)).toHaveLength(1);
  });

  it('still renders entries persisted before versioning existed', () => {
    renderList([entry({ status: DocumentStatus.INDEXED })]);

    expect(screen.getByText('Notas')).toBeInTheDocument();
    expect(screen.getByText('INDEXADO')).toBeInTheDocument();
    expect(screen.queryByText(/Versión asignada/)).toBeNull();
    expect(screen.queryByText('Duplicado')).toBeNull();
  });
});
