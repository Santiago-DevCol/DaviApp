import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFiles,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { DocumentDetail, MAX_FILE_SIZE_BYTES, UploadAcceptedResponse } from '@techdocs/shared';
import { memoryStorage } from 'multer';
import { GetDocumentUseCase } from '../../application/get-document.use-case';
import { UploadDocumentsUseCase } from '../../application/upload-documents.use-case';
import { DomainErrorFilter } from './domain-error.filter';
import { UploadDocumentsBodyDto } from './upload-document-metadata.dto';
import { parseUploadMetadata } from './upload-metadata.parser';

export const MAX_FILES_PER_UPLOAD = 20;

@Controller('documents')
@UseFilters(DomainErrorFilter)
export class DocumentsController {
  constructor(
    private readonly uploadDocuments: UploadDocumentsUseCase,
    private readonly getDocument: GetDocumentUseCase,
  ) {}

  /**
   * Multipart: repeated `files` parts plus one `metadata` field holding a JSON
   * array aligned by index with the files. Files are buffered in memory and
   * capped by multer at the hard limit shared with the frontend; the configured
   * `MAX_FILE_SIZE_BYTES` (never above that) is enforced by the use case.
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES_PER_UPLOAD, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      // Multer decodes part-header parameters as latin1 unless told otherwise,
      // which turns "Guía técnica.txt" into mojibake; browsers send UTF-8.
      defParamCharset: 'utf8',
    }),
  )
  async upload(
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Body() body: UploadDocumentsBodyDto,
  ): Promise<UploadAcceptedResponse> {
    const metadata = parseUploadMetadata(body.metadata);
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required in the "files" field');
    }
    if (files.length !== metadata.length) {
      throw new BadRequestException(
        `Received ${files.length} file(s) but ${metadata.length} metadata entry(ies); they must be aligned`,
      );
    }

    return this.uploadDocuments.execute({
      files: files.map((file) => ({
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        buffer: file.buffer,
      })),
      metadata,
    });
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<DocumentDetail> {
    return this.getDocument.execute(id);
  }
}
