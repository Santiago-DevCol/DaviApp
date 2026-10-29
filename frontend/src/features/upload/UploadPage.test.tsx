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

describe('UploadPage metadata suggestions', () => {
  const file = (name: string, type = 'text/plain') => new File(['x'], name, { type });

  it('prefills untouched fields from the inspection and marks them with the source hint', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UploadPage />, { route: '/upload', path: '/upload' });

    await user.upload(screen.getByLabelText('Seleccionar archivos'), file('fm-guide.md', 'text/markdown'));

    expect(await screen.findByDisplayValue('Guía desde front matter')).toBeInTheDocument();
    expect(screen.getByLabelText(/Autor/)).toHaveValue('Autora FM');
    expect(screen.getByLabelText(/Versión/)).toHaveValue('3.2.0');
    expect(screen.getByText('fm')).toBeInTheDocument();
    expect(screen.getAllByText('Sugerido desde el front matter')).toHaveLength(4);
    expect(screen.queryByText('Analizando archivos…')).toBeNull();
  });

  it('shows the page count and the PDF hint for pdf-info suggestions', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UploadPage />, { route: '/upload', path: '/upload' });

    await user.upload(screen.getByLabelText('Seleccionar archivos'), file('manual.pdf', 'application/pdf'));

    expect(await screen.findByText('12 páginas')).toBeInTheDocument();
    expect(screen.getByLabelText(/Título/)).toHaveValue('Título del PDF');
    expect(screen.getAllByText('Sugerido desde el PDF')).toHaveLength(2);
  });

  it('uses the content hint for heuristic suggestions and no hint when there is none', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UploadPage />, { route: '/upload', path: '/upload' });

    await user.upload(screen.getByLabelText('Seleccionar archivos'), [file('heur-notes.txt'), file('plain.txt')]);

    expect(await screen.findByDisplayValue('Título heurístico')).toBeInTheDocument();
    expect(screen.getByDisplayValue('plain')).toBeInTheDocument();
    expect(screen.getAllByText(/^Sugerido/)).toHaveLength(1);
    expect(screen.getByText('Sugerido del contenido')).toBeInTheDocument();
  });

  it('never overwrites a title the user typed while the inspection was pending', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UploadPage />, { route: '/upload', path: '/upload' });

    await user.upload(screen.getByLabelText('Seleccionar archivos'), file('slow-fm-guide.md', 'text/markdown'));
    expect(screen.getByText('Analizando archivos…')).toBeInTheDocument();
    const title = screen.getByLabelText(/Título/);
    await user.clear(title);
    await user.type(title, 'Mi título');

    expect(await screen.findByDisplayValue('Autora FM', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(title).toHaveValue('Mi título');
    expect(screen.queryByText('Analizando archivos…')).toBeNull();
    // Only the fields that were actually prefilled carry the hint.
    expect(screen.getAllByText('Sugerido desde el front matter')).toHaveLength(3);
  });

  it('keeps the form usable and shows a note when the inspection fails', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UploadPage />, { route: '/upload', path: '/upload' });

    await user.upload(screen.getByLabelText('Seleccionar archivos'), file('fail-doc.txt'));

    expect(await screen.findByText('No se pudieron sugerir metadatos')).toBeInTheDocument();
    expect(screen.getByLabelText(/Título/)).toHaveValue('fail-doc');
    expect(screen.getByLabelText(/Título/)).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Enviar 1 archivo' })).toBeInTheDocument();
  });

  it('prefers the file suggestion over values carried over from the previous file', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UploadPage />, { route: '/upload', path: '/upload' });
    const input = screen.getByLabelText('Seleccionar archivos');

    await user.upload(input, file('first.txt'));
    await user.type(screen.getByLabelText(/Autor/), 'Carmen Vega');
    await user.upload(input, file('fm-second.md', 'text/markdown'));

    expect(await screen.findByDisplayValue('Autora FM')).toBeInTheDocument();
    const authors = screen.getAllByLabelText(/Autor/);
    expect(authors[0]).toHaveValue('Carmen Vega');
    expect(authors[1]).toHaveValue('Autora FM');
  });

  it('clears the hint once the user edits a suggested field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UploadPage />, { route: '/upload', path: '/upload' });

    await user.upload(screen.getByLabelText('Seleccionar archivos'), file('manual.pdf', 'application/pdf'));
    await screen.findByDisplayValue('Título del PDF');
    await user.type(screen.getByLabelText(/Título/), ' 2');

    expect(screen.getAllByText('Sugerido desde el PDF')).toHaveLength(1);
  });
});
