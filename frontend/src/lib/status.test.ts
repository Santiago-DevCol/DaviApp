import { DocumentStatus } from '@techdocs/shared';
import { describe, expect, it } from 'vitest';
import { isDocumentStatus, presentStatus, statusLabel } from './status';

describe('status presentation', () => {
  it('maps every API status to its Spanish label and tone', () => {
    expect(presentStatus(DocumentStatus.PROCESSING)).toEqual({ label: 'Procesando', tone: 'info' });
    expect(presentStatus(DocumentStatus.INDEXED)).toEqual({ label: 'Indexado', tone: 'success' });
    expect(presentStatus(DocumentStatus.ERROR)).toEqual({ label: 'Error', tone: 'danger' });
  });

  it('covers the whole enum', () => {
    for (const status of Object.values(DocumentStatus)) {
      expect(statusLabel(status)).toMatch(/^(Procesando|Indexado|Error)$/);
    }
  });

  it('guards unknown values', () => {
    expect(isDocumentStatus('INDEXED')).toBe(true);
    expect(isDocumentStatus('DONE')).toBe(false);
    expect(isDocumentStatus(undefined)).toBe(false);
  });
});
