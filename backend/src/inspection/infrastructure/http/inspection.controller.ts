import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFiles,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { InspectResponse, MAX_FILE_SIZE_BYTES } from '@techdocs/shared';
import { memoryStorage } from 'multer';
import { DomainErrorFilter } from '../../../documents/infrastructure/http/domain-error.filter';
import { InspectFilesUseCase } from '../../application/inspect-files.use-case';

/** Same batch size as the upload endpoint, so what can be inspected can be uploaded. */
export const MAX_FILES_PER_INSPECTION = 20;

/**
 * `POST /documents/inspect`: multipart `files` only (no metadata field).
 * Answers 200 with suggestions and persists nothing. Errors reuse the
 * documents mapping (400 unsupported format, 413 too large) so the frontend
 * handles both endpoints the same way.
 */
@Controller('documents/inspect')
@UseFilters(DomainErrorFilter)
export class InspectionController {
  constructor(private readonly inspectFiles: InspectFilesUseCase) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES_PER_INSPECTION, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      // Browsers send UTF-8 part headers; multer defaults to latin1.
      defParamCharset: 'utf8',
    }),
  )
  inspect(@UploadedFiles() files: Express.Multer.File[] | undefined): Promise<InspectResponse> {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required in the "files" field');
    }
    return this.inspectFiles.execute(
      files.map((file) => ({
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        buffer: file.buffer,
      })),
    );
  }
}
