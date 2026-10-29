import { InspectedFile, InspectResponse, MAX_FILE_SIZE_BYTES } from '@techdocs/shared';
import { resolveDocumentFormat } from '../../documents/domain/document-format';
import { FileTooLargeError } from '../../documents/domain/errors';
import { fileNameFallback, MetadataInspection } from '../domain/metadata-suggestion';
import { MetadataExtractor } from '../domain/ports/metadata-extractor';

export interface InspectFileInput {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
}

export interface InspectFilesDependencies {
  extractor: MetadataExtractor;
  /** Defaults to the shared hard limit; must never exceed it. */
  maxFileSizeBytes?: number;
}

/**
 * Pre-upload inspection: validates each file the same way the upload does
 * (format by extension, size) and returns metadata suggestions so the
 * frontend can pre-fill the form. Nothing is stored or queued.
 */
export class InspectFilesUseCase {
  private readonly extractor: MetadataExtractor;
  private readonly maxFileSizeBytes: number;

  constructor(deps: InspectFilesDependencies) {
    this.extractor = deps.extractor;
    this.maxFileSizeBytes = Math.min(deps.maxFileSizeBytes ?? MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_BYTES);
  }

  async execute(files: InspectFileInput[]): Promise<InspectResponse> {
    // Validate the whole batch first so a bad file fails fast without parsing the rest.
    const resolved = files.map((file) => {
      const format = resolveDocumentFormat(file.fileName, file.mimeType);
      if (file.sizeBytes > this.maxFileSizeBytes) {
        throw new FileTooLargeError(file.fileName, file.sizeBytes, this.maxFileSizeBytes);
      }
      return { file, format };
    });

    const items: InspectedFile[] = [];
    for (const { file, format } of resolved) {
      const inspection = await this.inspectSafely(file, format);
      items.push({
        fileName: file.fileName,
        format,
        sizeBytes: file.sizeBytes,
        ...(inspection.pages !== undefined ? { pages: inspection.pages } : {}),
        source: inspection.source,
        suggested: inspection.suggested,
      });
    }
    return { items };
  }

  /** An extractor bug on one file must not hide the suggestions of the others. */
  private async inspectSafely(
    file: InspectFileInput,
    format: InspectedFile['format'],
  ): Promise<MetadataInspection> {
    try {
      return await this.extractor.inspect(file.buffer, format, file.fileName);
    } catch {
      return fileNameFallback(file.fileName);
    }
  }
}
