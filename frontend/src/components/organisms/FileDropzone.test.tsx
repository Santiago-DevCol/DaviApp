import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FileDropzone } from './FileDropzone';

const ACCEPT = '.md,.txt';

describe('FileDropzone', () => {
  it('exposes the file picker through its visible label', () => {
    render(<FileDropzone onFiles={vi.fn()} accept={ACCEPT} />);
    const input = screen.getByLabelText('Seleccionar archivos');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('accept', ACCEPT);
  });

  it('hands the picked files to onFiles', async () => {
    const user = userEvent.setup();
    const onFiles = vi.fn();
    render(<FileDropzone onFiles={onFiles} accept={ACCEPT} />);
    const files = [
      new File(['a'], 'a.md', { type: 'text/markdown' }),
      new File(['b'], 'b.txt', { type: 'text/plain' }),
    ];

    await user.upload(screen.getByLabelText('Seleccionar archivos'), files);

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0]?.[0].map((file: File) => file.name)).toEqual(['a.md', 'b.txt']);
  });

  it('shows the hint under the picker', () => {
    render(<FileDropzone onFiles={vi.fn()} accept={ACCEPT} hint="Hasta 10 archivos" />);
    expect(screen.getByText('Hasta 10 archivos')).toBeInTheDocument();
  });

  it('disables the picker when the dropzone is disabled', () => {
    render(<FileDropzone onFiles={vi.fn()} accept={ACCEPT} disabled />);
    expect(screen.getByLabelText('Seleccionar archivos')).toBeDisabled();
  });
});
