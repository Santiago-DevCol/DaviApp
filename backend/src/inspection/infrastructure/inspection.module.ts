import { Module } from '@nestjs/common';
import { InspectFilesUseCase } from '../application/inspect-files.use-case';
import { METADATA_EXTRACTOR, MetadataExtractor } from '../domain/ports/metadata-extractor';
import { FormatDispatchingMetadataExtractor } from './extraction/format-dispatching-metadata.extractor';
import { MarkdownMetadataExtractor } from './extraction/markdown-metadata.extractor';
import { PdfMetadataExtractor } from './extraction/pdf-metadata.extractor';
import { TextMetadataExtractor } from './extraction/text-metadata.extractor';
import { InspectionController } from './http/inspection.controller';

/**
 * Composition root of the pre-upload inspection capability. Stateless: no
 * repository, storage or queue, so it needs nothing from the documents module
 * beyond its domain rules (format resolution, error mapping).
 */
@Module({
  controllers: [InspectionController],
  providers: [
    PdfMetadataExtractor,
    MarkdownMetadataExtractor,
    TextMetadataExtractor,
    { provide: METADATA_EXTRACTOR, useClass: FormatDispatchingMetadataExtractor },
    {
      provide: InspectFilesUseCase,
      inject: [METADATA_EXTRACTOR],
      useFactory: (extractor: MetadataExtractor) => new InspectFilesUseCase({ extractor }),
    },
  ],
})
export class InspectionModule {}
