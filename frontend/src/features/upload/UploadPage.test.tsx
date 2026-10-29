import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocumentStatus } from '@techdocs/shared';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { UploadPage, summarizeAccepted } from './UploadPage';
import { MAX_FILES_PER_UPLOAD } from './validation';

function textFiles(count: number, prefix = 'doc'): File[] {
  return Array.from({ length: count }, (_, index) => new File(['x'], `${prefix}-${index + 1}.txt`, { type: 'text/plain' }));
}

describe('UploadPage', () => {
  it('reports how many files were dropped beyond the per-batch limit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UploadPage />, { route: '/upload', path: '/upload' });

    await user.upload(screen.getByLabelText('Seleccionar archivos'), textFiles(MAX_FILES_PER_UPLOAD + 3));

    expect(
      screen.getByText(`Se omitieron 3 archivos: el máximo por lote es ${MAX_FILES_PER_UPLOAD}.`),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/^doc-\d+\.txt$/)).toHaveLength(MAX_FILES_PER_UPLOAD);
    expect(screen.getByText(`doc-${MAX_FILES_PER_UPLOAD}.txt`)).toBeInTheDocument();
    expect(screen.queryByText(`doc-${MAX_FILES_PER_UPLOAD + 1}.txt`)).toBeNull();
  });

  it('uses the singular form for one omitted file and clears the notice on the next addition', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UploadPage />, { route: '/upload', path: '/upload' });
    const input = screen.getByLabelText('Seleccionar archivos');

    await user.upload(input, textFiles(MAX_FILES_PER_UPLOAD - 1));
    expect(screen.queryByText(/Se omiti/)).toBeNull();

    await user.upload(input, textFiles(2, 'extra'));
    expect(screen.getByText(`Se omitió 1 archivo: el máximo por lote es ${MAX_FILES_PER_UPLOAD}.`)).toBeInTheDocument();

    // Freeing a slot and adding a file that fits clears the notice.
    await user.click(screen.getAllByRole('button', { name: 'Quitar' })[0]!);
    await user.upload(input, textFiles(1, 'fits'));
    expect(screen.queryByText(/Se omiti/)).toBeNull();
    expect(screen.getByText('fits-1.txt')).toBeInTheDocument();
  });

  it('summarizes a batch made only of duplicates as already existing', () => {
    const duplicate = {
      id: 'x',
      status: DocumentStatus.INDEXED,
      fileName: 'a.txt',
      duplicateOf: { id: 'x', version: '1.0.0' },
    };
    expect(summarizeAccepted([duplicate, { ...duplicate, fileName: 'b.txt' }]).title).toBe('2 archivos ya existían');
    expect(summarizeAccepted([duplicate]).title).toBe('1 archivo ya existía');
    expect(summarizeAccepted([duplicate, { id: 'y', status: DocumentStatus.PROCESSING, fileName: 'c.txt' }])).toEqual({
      title: '1 documento aceptado',
      description: 'La indexación continúa en segundo plano. 1 archivo ya existía.',
    });
  });
});
