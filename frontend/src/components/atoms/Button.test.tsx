import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders a plain button by default so it never submits a form by accident', () => {
    render(<Button>Guardar</Button>);
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveAttribute('type', 'button');
  });

  it('passes an explicit submit type through', () => {
    render(<Button type="submit">Enviar</Button>);
    expect(screen.getByRole('button', { name: 'Enviar' })).toHaveAttribute('type', 'submit');
  });

  it('disables itself and announces busy state while loading', () => {
    render(<Button loading>Subiendo</Button>);
    const button = screen.getByRole('button', { name: /Subiendo/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(within(button).getByRole('status')).toBeInTheDocument();
  });

  it('renders the quiet variant as an accessible button', () => {
    render(<Button variant="quiet">Quitar</Button>);
    expect(screen.getByRole('button', { name: 'Quitar' })).toBeEnabled();
  });
});
