import { DocumentStatus } from '@techdocs/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { TrackedUploadView } from '../useTrackedUploads';
import { TrackedUploadsList } from './TrackedUploadsList';

function entry(overrides: Partial<TrackedUploadView> = {}): TrackedUploadView {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    fileName: 'k8s-guide.md',
    title: 'Guía de despliegue en Kubernetes',
    acceptedAt: '2026-10-01T10:00:00.000Z',
    status: DocumentStatus.INDEXED,
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
  it('shows an indexed upload with its status, a link to the document and a remove control', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const indexed = entry();
    renderWithProviders(<TrackedUploadsList entries={[indexed]} onRemove={onRemove} onClear={() => {}} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Cargas recientes' })).toBeInTheDocument();
    expect(screen.getByText(indexed.title)).toBeInTheDocument();
    expect(screen.getByText(indexed.fileName)).toBeInTheDocument();
    expect(screen.getByText('Indexado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver documento' })).toHaveAttribute('href', `/documents/${indexed.id}`);

    await user.click(screen.getByRole('button', { name: `Dejar de seguir ${indexed.fileName}` }));
    expect(onRemove).toHaveBeenCalledWith(indexed.id);
  });

  it('shows a processing upload without a document link', () => {
    renderWithProviders(
      <TrackedUploadsList
        entries={[entry({ id: '22222222-2222-4222-8222-222222222222', status: DocumentStatus.PROCESSING })]}
        onRemove={() => {}}
        onClear={() => {}}
      />,
    );

    expect(screen.getByText('Procesando')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ver documento' })).toBeNull();
  });

  it('shows the error message of a failed upload', () => {
    renderWithProviders(
      <TrackedUploadsList
        entries={[entry({ status: DocumentStatus.ERROR, errorMessage: 'No se pudo extraer texto' })]}
        onRemove={() => {}}
        onClear={() => {}}
      />,
    );

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('No se pudo extraer texto')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ver documento' })).toBeNull();
  });

  it('marks the status as unknown when the document could not be fetched', () => {
    renderWithProviders(
      <TrackedUploadsList
        entries={[entry({ status: null, loadError: 'Network error' })]}
        onRemove={() => {}}
        onClear={() => {}}
      />,
    );

    expect(screen.getByText('Desconocido')).toBeInTheDocument();
    expect(screen.getByText(/No se pudo consultar el estado/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ver documento' })).toBeNull();
  });

  it('clears the whole list from the section header', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    renderWithProviders(<TrackedUploadsList entries={[entry()]} onRemove={() => {}} onClear={onClear} />);

    await user.click(screen.getByRole('button', { name: 'Limpiar lista' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('renders nothing without tracked uploads', () => {
    const { container } = renderWithProviders(
      <TrackedUploadsList entries={[]} onRemove={() => {}} onClear={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a duplicate upload with a link to the existing document and no spinner', () => {
    renderList([entry({ id: 'existing-1', status: null, duplicateOf: { id: 'existing-1', version: '1.2.0' } })]);

    expect(screen.getByText('Duplicado')).toBeInTheDocument();
    expect(screen.getByText('Ya existía como versión 1.2.0')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver documento' })).toHaveAttribute('href', '/documents/existing-1');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText('Consultando estado')).toBeNull();
  });

  it('shows the assigned version only when it differs from the one sent', () => {
    renderList([
      entry({ id: 'bumped', fileName: 'a.txt', status: null, sentVersion: '1.0.0', version: '1.0.1' }),
      entry({ id: 'same', fileName: 'b.txt', status: null, sentVersion: '2.0.0', version: '2.0.0' }),
    ]);

    expect(screen.getByText(/Versión asignada: v1\.0\.1/)).toHaveTextContent('enviada v1.0.0');
    expect(screen.getAllByText(/Versión asignada/)).toHaveLength(1);
  });

  it('still renders entries persisted before versioning existed', () => {
    const legacy = entry({ status: DocumentStatus.INDEXED });
    renderList([legacy]);

    expect(screen.getByText(legacy.title)).toBeInTheDocument();
    expect(screen.getByText('Indexado')).toBeInTheDocument();
    expect(screen.queryByText(/Versión asignada/)).toBeNull();
    expect(screen.queryByText('Duplicado')).toBeNull();
  });
});
