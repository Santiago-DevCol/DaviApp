import { BadRequestException } from '@nestjs/common';
import { DocumentMetadataInput } from '@techdocs/shared';
import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';
import { UploadDocumentMetadataDto } from './upload-document-metadata.dto';

const INVALID_SHAPE = 'metadata must be a JSON array with one entry per uploaded file';

/**
 * Parses and validates the JSON-encoded `metadata` field. Produces the same
 * `BadRequestException(string[])` shape as Nest's ValidationPipe so the global
 * filter renders it as `{ message: 'Validation failed', details: [...] }`.
 */
export function parseUploadMetadata(raw: string): DocumentMetadataInput[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadRequestException(INVALID_SHAPE);
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new BadRequestException(INVALID_SHAPE);
  }

  const details: string[] = [];
  const items = parsed.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      details.push(`metadata[${index}] must be an object`);
      return null;
    }
    const dto = plainToInstance(UploadDocumentMetadataDto, entry);
    const errors = validateSync(dto, { whitelist: true, forbidNonWhitelisted: true });
    details.push(...flatten(errors, `metadata[${index}].`));
    return dto;
  });

  if (details.length > 0) {
    throw new BadRequestException(details);
  }

  return items.map((dto) => {
    const { title, author, category, tags, version } = dto as UploadDocumentMetadataDto;
    return { title, author, category, tags, version };
  });
}

function flatten(errors: ValidationError[], prefix: string): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}).map((message) => `${prefix}${message}`),
    ...flatten(error.children ?? [], `${prefix}${error.property}.`),
  ]);
}
