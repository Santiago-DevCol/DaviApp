import { DocumentStatus } from '@techdocs/shared';

export type StatusTone = 'info' | 'success' | 'danger';

export interface StatusPresentation {
  label: string;
  tone: StatusTone;
}

const PRESENTATION: Record<DocumentStatus, StatusPresentation> = {
  [DocumentStatus.PROCESSING]: { label: 'PROCESANDO', tone: 'info' },
  [DocumentStatus.INDEXED]: { label: 'INDEXADO', tone: 'success' },
  [DocumentStatus.ERROR]: { label: 'ERROR', tone: 'danger' },
};

/** Maps the API status enum to its Spanish label and visual tone. */
export function presentStatus(status: DocumentStatus): StatusPresentation {
  return PRESENTATION[status];
}

export function statusLabel(status: DocumentStatus): string {
  return presentStatus(status).label;
}

export function isDocumentStatus(value: unknown): value is DocumentStatus {
  return typeof value === 'string' && value in PRESENTATION;
}
