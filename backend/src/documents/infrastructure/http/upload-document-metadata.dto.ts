import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

/** One entry of the `metadata` JSON array sent alongside the multipart files. */
export class UploadDocumentMetadataDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  author!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  category!: string;

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(50, { each: true })
  tags!: string[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  version!: string;
}

/**
 * Multipart bodies arrive as flat string fields, so the metadata array travels
 * JSON-encoded in a single `metadata` field and is parsed by the controller.
 */
export class UploadDocumentsBodyDto {
  @IsString()
  @IsNotEmpty()
  metadata!: string;
}
