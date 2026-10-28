import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { UploadPage } from './UploadPage';
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
});
