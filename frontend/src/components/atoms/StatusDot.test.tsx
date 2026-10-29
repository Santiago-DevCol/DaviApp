import { DocumentStatus } from '@techdocs/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusDot } from './StatusDot';

describe('StatusDot', () => {
  it('renders the sentence-case word for a document status', () => {
    render(<StatusDot status={DocumentStatus.INDEXED} />);
    expect(screen.getByText('Indexado')).toBeInTheDocument();
  });

  it('accepts a custom label with a neutral tone', () => {
    render(<StatusDot tone="neutral" label="Desconocido" />);
    expect(screen.getByText('Desconocido')).toBeInTheDocument();
  });

  it('hides the dot from assistive technology', () => {
    const { container } = render(<StatusDot status={DocumentStatus.PROCESSING} />);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByText('Procesando')).toBeInTheDocument();
  });

  it('renders nothing without a status or a label', () => {
    const { container } = render(<StatusDot />);
    expect(container).toBeEmptyDOMElement();
  });
});
