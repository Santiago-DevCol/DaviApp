import type { DocumentFormat } from '@techdocs/shared';
import type { MetadataInspection } from '../metadata-suggestion';

export const METADATA_EXTRACTOR = Symbol('METADATA_EXTRACTOR');

/**
 * Reads whatever metadata a file carries (PDF info dictionary, Markdown front
 * matter) or can be guessed from its content, without persisting anything.
 * Implementations must not throw for malformed content: they degrade to the
 * file-name fallback with `source: 'none'`.
 */
export interface MetadataExtractor {
  inspect(buffer: Buffer, format: DocumentFormat, fileName: string): Promise<MetadataInspection>;
}
