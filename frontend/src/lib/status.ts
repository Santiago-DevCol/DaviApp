import { DocumentStatus } from '@techdocs/shared';

export type StatusTone = 'info' | 'success' | 'danger';

export interface StatusPresentation {
  label: string;
  tone: StatusTone;
}

const PRESENTATION: Record<DocumentStatus, StatusPresentation> = {
  [DocumentStatus.PROCESSING]: { label: 'Procesando', tone: 'info' },
  [DocumentStatus.INDEXED]: { label: 'Indexado', tone: 'success' },
  [DocumentStatus.ERROR]: { label: 'Error', tone: 'danger' },
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
